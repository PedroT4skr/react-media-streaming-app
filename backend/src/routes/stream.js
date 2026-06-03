const express = require('express');
const router = express.Router();
const { getMediaInfo } = require('../services/tmdb');
const { getTorrentCandidates } = require('../services/torrentio');
const rd = require('../services/realdebrid');
const torbox = require('../services/torbox');
const axios = require('axios');

// In-memory cache to avoid re-processing the same TMDB ID
// Key: `${type}:${tmdbId}` → Value: { url, filename, size, cachedAt }
const streamCache = new Map();
const inFlight = new Map();
const activeDownloads = new Map(); // cacheKey -> { torrentId, provider: 'rd', metadata, filename }
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours for RD links

/**
 * GET /api/stream/:tmdb_id?type=movie|tv
 */
router.get('/:tmdb_id', async (req, res) => {
  const { tmdb_id } = req.params;
  const type = req.query.type === 'tv' ? 'tv' : 'movie';
  const season = req.query.season;
  const episode = req.query.episode;
  const lang = req.query.lang || 'en'; // default to english

  let cacheKey = type === 'tv' && season && episode 
    ? `${type}:${tmdb_id}:S${season}E${episode}`
    : `${type}:${tmdb_id}`;
  cacheKey += `:${lang}`;

  // --- Cache hit ---
  const cached = streamCache.get(cacheKey);
  if (cached && cached.url && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return res.json({ url: cached.url, filename: cached.filename, size: cached.size, metadata: cached.metadata, cached: true });
  }

  // --- Active Download Polling Hit ---
  if (activeDownloads.has(cacheKey)) {
    const active = activeDownloads.get(cacheKey);
    try {
      let rdInfo = { status: 'downloading', progress: 0, speed: 0 };
      try {
        rdInfo = await rd.getTorrentInfo(active.rdId);
      } catch (e) {
        rdInfo.status = 'error';
      }

      let tbInfo = { status: 'downloading', progress: 0 };
      try {
        tbInfo = await torbox.getMagnetStreamUrl(active.torboxMagnet);
      } catch (e) {
        tbInfo.status = 'error';
      }

      if (rdInfo.status === 'downloaded') {
        const link = rdInfo.links[0];
        const unrestrict = await rd.unrestrictLink(link);
        const payload = {
          url: unrestrict.download,
          filename: active.filename,
          size: unrestrict.filesize,
          metadata: { ...active.metadata, debrid: 'Real-Debrid' },
          status: 'ready'
        };
        streamCache.set(cacheKey, { ...payload, cachedAt: Date.now() });
        activeDownloads.delete(cacheKey);
        return res.json({ ...payload, cached: false });
      }

      if (tbInfo.status === 'ready') {
        const payload = {
          url: tbInfo.url,
          filename: tbInfo.filename,
          size: tbInfo.size,
          metadata: { ...active.metadata, debrid: 'TorBox' },
          status: 'ready'
        };
        streamCache.set(cacheKey, { ...payload, cachedAt: Date.now() });
        activeDownloads.delete(cacheKey);
        return res.json({ ...payload, cached: false });
      }

      if (rdInfo.status === 'error' && tbInfo.status === 'error') {
        activeDownloads.delete(cacheKey);
        return res.status(502).json({ error: `Both RD and TorBox downloads failed.` });
      }

      return res.json({
        status: 'downloading',
        progress: rdInfo.progress || 0,
        progressTorbox: tbInfo.progress || 0,
        speed: rdInfo.speed || 0,
        filename: active.filename,
        metadata: active.metadata
      });

    } catch (err) {
      console.error(`[Active Download] Error polling:`, err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  // --- In-Flight Hit ---
  if (inFlight.has(cacheKey)) {
    try {
      const data = await inFlight.get(cacheKey);
      return res.json(data);
    } catch (err) {
      return res.status(502).json(err);
    }
  }


  const pipelinePromise = (async () => {
    // Stage 1: TMDB metadata
    let mediaInfo;
    try {
      mediaInfo = await getMediaInfo(tmdb_id, type);
    } catch (err) {
      throw { error: `TMDB lookup failed: ${err.message}`, stage: 'tmdb' };
    }

    // Stage 2: Torrentio Candidates
    let candidates = [];
    try {
      candidates = await getTorrentCandidates(mediaInfo.imdb_id, type, season, episode, lang);
      if (candidates.length === 0) throw new Error("No torrents found");
    } catch (err) {
      throw { error: `Torrentio falhou: ${err.message}`, stage: 'torrentio' };
    }

    const getProvider = (title) => {
      const parts = title.split('⚙️');
      return parts.length > 1 ? parts[1].trim() : 'Unknown';
    };

    const getAudio = (title) => {
      const t = title.toLowerCase();
      if (t.includes('dublado') || t.includes('dual') || t.includes('pt-br')) return 'PT-BR / Dual';
      return 'Inglês (Original)';
    };

    const parseMetadata = (c) => {
      const t = c.behaviorHints?.filename || (c.title || 'Unknown').split('\n')[0];
      return {
        name: t,
        quality: (c.name || '').split('\n')[1] || 'Unknown',
        audio: getAudio(t),
        scraper: getProvider(c.title || ''),
        debrid: 'Real-Debrid'
      };
    };

    // Stage 3: Check if Torrentio provided a direct RD+ link
    for (const c of candidates) {
      if (c.url && (c.url.includes('.real-debrid.') || c.url.includes('/realdebrid/'))) {
        try {
          const headRes = await axios.head(c.url, { timeout: 5000 });
          const sizeMB = parseInt(headRes.headers['content-length'] || '0', 10) / (1024 * 1024);
          const minSize = type === 'tv' ? 40 : 150;
          if (sizeMB >= minSize) {
            const meta = parseMetadata(c);
            return { url: c.url, filename: meta.name, size: sizeMB * 1024 * 1024, metadata: meta, status: 'ready' };
          }
        } catch (e) {
          // ignore HEAD error, try next
        }
      }
    }

    // Stage 4: Verify Instant Availability directly on RD using InfoHashes
    const hashes = candidates.filter(c => c.infoHash).slice(0, 50).map(c => c.infoHash.toLowerCase());
    if (hashes.length > 0) {
      const availability = await rd.checkInstantAvailability(hashes);
      
      // Find the best candidate that is available
      for (const c of candidates) {
        if (!c.infoHash) continue;
        const hash = c.infoHash.toLowerCase();
        if (availability[hash] && Object.keys(availability[hash].rd || {}).length > 0) {
          // Add it to RD, select files, unrestrict
          const magnetUrl = `magnet:?xt=urn:btih:${hash}`;
          const res = await rd.processMagnet(magnetUrl);
          
          if (res.info.status === 'downloaded' && res.info.links.length > 0) {
            const unrestrict = await rd.unrestrictLink(res.info.links[0]);
            const meta = parseMetadata(c);
            return {
              url: unrestrict.download,
              filename: meta.name,
              size: unrestrict.filesize,
              metadata: meta,
              status: 'ready'
            };
          }
        }
      }
    }

    // Stage 4.5: TorBox Instant Availability Check
    const tbCachedHashes = await torbox.checkInstantAvailability(hashes);
    if (tbCachedHashes.length > 0) {
      for (const c of candidates) {
        if (!c.infoHash) continue;
        const hash = c.infoHash.toLowerCase();
        if (tbCachedHashes.includes(hash)) {
          const magnetUrl = `magnet:?xt=urn:btih:${hash}`;
          try {
            const res = await torbox.getMagnetStreamUrl(magnetUrl);
            if (res.status === 'ready') {
              const meta = parseMetadata(c);
              return {
                url: res.url,
                filename: res.filename,
                size: res.size,
                metadata: { ...meta, debrid: 'TorBox' },
                status: 'ready'
              };
            }
          } catch(e) {
          }
        }
      }
    }

    // Stage 5: Fallback - Request Download of the #1 Magnet on BOTH RD and TorBox
    const best = candidates.find(c => c.infoHash);
    if (!best) throw { error: "Nenhum magnet válido encontrado para download", stage: 'fallback' };

    const magnetUrl = `magnet:?xt=urn:btih:${best.infoHash}`;
    const meta = parseMetadata(best);
    
    // Start RD Download
    let rdId = null;
    let rdProgress = 0;
    try {
      const resRD = await rd.processMagnet(magnetUrl);
      rdId = resRD.torrentId;
      rdProgress = resRD.info.progress || 0;
    } catch (e) {
      console.error(`[Pipeline] RD Download initiate failed:`, e.message);
    }

    // Start TorBox Download
    let tbProgress = 0;
    try {
      const resTB = await torbox.getMagnetStreamUrl(magnetUrl);
      tbProgress = resTB.progress || 0;
    } catch (e) {
      console.error(`[Pipeline] TorBox Download initiate failed:`, e.message);
    }

    if (!rdId && tbProgress === 0) {
      throw { error: "Ambos Real-Debrid e TorBox falharam ao iniciar o download remoto." };
    }

    activeDownloads.set(cacheKey, {
      provider: 'dual',
      rdId: rdId,
      torboxMagnet: magnetUrl,
      filename: meta.name,
      metadata: meta
    });

    return {
      status: 'downloading',
      progress: rdProgress,
      progressTorbox: tbProgress,
      speed: 0,
      filename: meta.name,
      metadata: meta
    };

  })();

  inFlight.set(cacheKey, pipelinePromise);

  try {
    const data = await pipelinePromise;
    if (data.status === 'ready') {
      streamCache.set(cacheKey, { ...data, cachedAt: Date.now() });
    }
    inFlight.delete(cacheKey);
    return res.json({ ...data, cached: false });
  } catch (err) {
    inFlight.delete(cacheKey);
    return res.status(502).json(err);
  }
});

module.exports = router;
