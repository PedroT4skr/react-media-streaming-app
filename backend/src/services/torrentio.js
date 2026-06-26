const axios = require('axios');

const TORRENTIO_BASE = 'https://torrentio.strem.fun';
const RD_KEY = process.env.REAL_DEBRID_KEY || 'GYDUFPJ2OTUYRBMMFGMJGYC4UMV7XMELXOEFS5YN44VJU4FDY5OA';

const isBrowserCompatible = (item) => {
  const t = (item.title || '').toLowerCase() + ' ' + (item.name || '').toLowerCase();
  
  // 1. HEVC / H265 / 10bit are strictly incompatible with most browsers natively
  const isHEVC = t.includes('x265') || t.includes('hevc') || t.includes('h.265') || t.includes('h265') || t.includes('10bit');
  if (isHEVC) return false;

  // 2. Reject bad packs/extras
  if (t.includes('moviesbyrizzo') || t.includes('best pictures') || t.includes('trilogy')) return false;
  if (t.includes('behind the scenes') || t.includes('making of') || t.includes('bonus') || t.includes('extra') || t.includes('featurette')) return false;

  return true;
};

const calculateScore = (item, langPref = 'en') => {
  const t = (item.title || '').toLowerCase() + ' ' + (item.name || '').toLowerCase();
  let score = 0;

  // A. Resolution
  if (t.includes('1080p')) score += 100;
  else if (t.includes('720p')) score += 50;
  else if (t.includes('2160p') || t.includes('4k')) score += 10; // 4K plays poorly on web, demote below 1080p/720p

  if (t.includes('mp4')) score += 5000; // Native browser container
  if (t.includes('aac') || t.includes('mp3')) score += 5000; // Native browser audio codec
  
  
  // C. Source Reliability
  if (item.name && item.name.includes('[RD+]')) score += 10000; // Instant cache is King. MUST NEVER be beaten by uncached.
  if (t.includes('yify') || t.includes('yts') || t.includes('bokutox') || t.includes('bludv')) score += 30; // Reliable encoders

  // D. Language Logic
  const hasPTBR = t.includes('pt-br') || t.includes('dublado') || t.includes('brazilian') || t.includes('portuguese') || t.includes('bludv') || t.includes('comando') || t.includes('lapumia');
  const hasENG = t.includes('eng') || t.includes('english');
  const hasHIN = t.includes('hin') || t.includes('hindi') || t.includes('telugu') || t.includes('tamil');
  const hasITA = t.includes('ita') || t.includes('italian');
  const hasFRE = t.includes('fre') || t.includes('french') || t.includes('vff');
  const hasGER = t.includes('ger') || t.includes('german');
  const hasRUS = t.includes('rus') || t.includes('russian');
  const hasSPA = t.includes('spa') || t.includes('spanish') || t.includes('castellano') || t.includes('latino');

  // Penalize foreign dubs unless they also have PT-BR or ENG
  const hasForeign = hasHIN || hasITA || hasFRE || hasGER || hasRUS || hasSPA;
  if (hasForeign && !hasENG && !hasPTBR) {
    score -= 1000;
  }
  if (hasHIN && !hasPTBR) score -= 1000; // Heavy penalty for Indian regional dubs

  // Language Preferences
  if (langPref === 'pt-br') {
    if (hasPTBR) score += 300; // Portuguese is top priority
    if (hasENG) score -= 10;
    // For browsers, dual audio is bad for PT-BR because Track 1 is usually English and JS can't switch it.
    // So we give a massive bonus to explicit "Dublado" (single audio PT-BR).
    if (t.includes('dublado') && !t.includes('dual')) score += 500;
    if (t.includes('dual audio') || t.includes('multi') || t.includes('dual-audio')) score -= 50;
  } else {
    if (hasENG) score += 300; // English is top priority
    // For English preference, Brazilian dual audio / dublado is dangerous because they put PT-BR as Track 1
    // Generic "multi" is fine because they usually keep English as Track 1.
    if (t.includes('dublado')) score -= 2000;
    if (hasPTBR) score -= 2000;
  }
  // console.log(`[Score] ${item.title.substring(0, 30)} -> ${score}`);
  return score;
};

const extractSizeMB = (title) => {
  const match = title.match(/💾\s*([\d.]+)\s*(GB|MB)/i);
  if (!match) return 0;
  const size = parseFloat(match[1]);
  return match[2].toUpperCase() === 'GB' ? size * 1024 : size;
};

const rankStreams = (results, type, langPref) => {
  if (!results || results.length === 0) return [];
  
  return results
    .filter(r => isBrowserCompatible(r))
    .filter(r => {
      const sizeMB = extractSizeMB(r.title || '');
      if (type === 'tv') {
        return sizeMB >= 40;
      } else {
        return sizeMB >= 150;
      }
    })
    .sort((a, b) => {
      const getSeeders = (str) => {
        const match = str.match(/👤\s*(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };
      const seedersA = Math.min(getSeeders(a.title || ''), 50);
      const seedersB = Math.min(getSeeders(b.title || ''), 50);

      const totalA = calculateScore(a, langPref) + seedersA;
      const totalB = calculateScore(b, langPref) + seedersB;
      return totalB - totalA;
    });
};

async function getTorrentCandidates(imdbId, type = 'movie', season = null, episode = null, langPref = 'en') {
  let urls = [];
  
  const langPrefix = langPref === 'pt-br' ? 'language=portuguese/' : '';
  const rdPrefix = `realdebrid=${RD_KEY}/`;
  const rdLangPrefix = langPref === 'pt-br' ? `realdebrid=${RD_KEY}|language=portuguese/` : rdPrefix;

  if (type === 'tv' && season && episode && season !== 'undefined' && episode !== 'undefined' && season !== 'null' && episode !== 'null') {
    urls.push(`${TORRENTIO_BASE}/${rdLangPrefix}stream/series/${imdbId}:${season}:${episode}.json`);
    urls.push(`${TORRENTIO_BASE}/${langPrefix}stream/series/${imdbId}:${season}:${episode}.json`);
    urls.push(`https://knightcrawler.elfhosted.com/${rdPrefix}stream/series/${imdbId}:${season}:${episode}.json`);
    urls.push(`https://knightcrawler.elfhosted.com/stream/series/${imdbId}:${season}:${episode}.json`);
  } else {
    urls.push(`${TORRENTIO_BASE}/${rdLangPrefix}stream/movie/${imdbId}.json`);
    urls.push(`${TORRENTIO_BASE}/${langPrefix}stream/movie/${imdbId}.json`);
    urls.push(`https://knightcrawler.elfhosted.com/${rdPrefix}stream/movie/${imdbId}.json`);
    urls.push(`https://knightcrawler.elfhosted.com/stream/movie/${imdbId}.json`);
  }

  let results = [];
  const requests = urls.map(url => axios.get(url, { timeout: 15000 }).catch(e => null));
  const responses = await Promise.all(requests);
  
  for (const res of responses) {
    if (res && res.data && res.data.streams) {
      for (const stream of res.data.streams) {
        if (stream.infoHash) {
          if (!results.find(r => r.infoHash === stream.infoHash)) {
            results.push(stream);
          }
        } else if (stream.url) {
          if (!results.find(r => r.url === stream.url)) {
            results.push(stream);
          }
        } else {
          results.push(stream);
        }
      }
    }
  }

  return rankStreams(results, type, langPref);
}

module.exports = { getTorrentCandidates };
