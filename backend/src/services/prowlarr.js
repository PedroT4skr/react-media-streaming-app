const axios = require('axios');

const PROWLARR_URL = process.env.PROWLARR_URL || 'http://localhost:9696';
const PROWLARR_API_KEY = process.env.PROWLARR_API_KEY;

/**
 * Search Prowlarr for a torrent by movie title + year.
 * Returns the best candidate magnet URI (magnet:btih:...) ranked by quality + seeders.
 *
 * IMPORTANT: Prowlarr returns a proxy `downloadUrl` and `magnetUrl`, not a real magnet URI.
 * The ONLY reliable field for TorBox is `infoHash` — we construct the magnet from it directly.
 */
async function searchBestTorrent(title, year, type = 'movie', season = null, episode = null) {
  let query;
  if (type === 'tv' && season && episode) {
    query = `${title} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
  } else {
    query = year ? `${title} ${year}` : title;
  }

  // NOTE: Prowlarr's /search endpoint requires categories as repeated params, NOT comma-joined.
  // Passing 2000,2040 as a string causes 400. Use URLSearchParams to append each separately.
  const params = new URLSearchParams();
  params.append('query', query);
  params.append('type', 'search');
  params.append('limit', '30');
  // Only apply movie categories; YTS is auto-assigned by Prowlarr to all movie searches.
  if (type === 'movie') {
    params.append('categories', '2000');
    params.append('categories', '2040');
  } else {
    params.append('categories', '5000');
    params.append('categories', '5040');
  }

  const response = await axios.get(`${PROWLARR_URL}/api/v1/search?${params.toString()}`, {
    headers: { 'X-Api-Key': PROWLARR_API_KEY },
    timeout: 20000,
  });

  const results = response.data;

  if (!results || results.length === 0) {
    throw new Error(`No torrents found for: "${query}"`);
  }

  // Ranking: browser compatibility first, then quality, then seeders.
  //
  // WHY: Browsers (Chrome/Firefox) do not support HEVC/x265 natively.
  // 4K releases from YTS and most indexers use x265 10-bit → MEDIA_ERR_SRC_NOT_SUPPORTED.
  // 1080p releases use x264 (H.264) → plays natively in all browsers without transcoding.
  // Priority: 1080p-x264 > 720p-x264 > 4K-x265 > other
  const qualityScore = (item) => {
    const t = (item.title || '').toLowerCase();
    const isHEVC = t.includes('x265') || t.includes('hevc') || t.includes('h.265') || t.includes('10bit');
    const is4K   = t.includes('2160p') || t.includes('4k');
    const is1080 = t.includes('1080p');
    const is720  = t.includes('720p');
    
    // YTS/YIFY explicitly release highly-compatible MP4 files
    const isMP4 = t.includes('.mp4') || t.includes('yify') || t.includes('yts');

    // Penalize x265/4K — browser cannot play without transcoding
    if (is1080 && !isHEVC && isMP4) return 10; // Best: 1080p H.264 MP4 (Web Optimized)
    if (is720  && !isHEVC && isMP4) return 9;  // Good: 720p H.264 MP4
    if (is1080 && !isHEVC) return 5;           // Fallback: 1080p H.264 MKV (might play, might fail)
    if (is720  && !isHEVC) return 4;           // Fallback: 720p H.264 MKV
    if (is1080 && isHEVC)  return 3;           // Marginal: 1080p x265 (unlikely to play)
    if (is4K   && isHEVC)  return 2;           // Poor: 4K x265 (unplayable)
    if (is4K)              return 2;           // Poor: any 4K
    return 1;                                  // Unknown
  };

  const ranked = results
    .filter(r => r.infoHash) // Must have a hash to build magnet URI
    .sort((a, b) => {
      const qDiff = qualityScore(b) - qualityScore(a);
      return qDiff !== 0 ? qDiff : (b.seeders || 0) - (a.seeders || 0);
    });

  if (ranked.length === 0) {
    throw new Error(`No results with a valid infoHash for: "${query}"`);
  }

  const best = ranked[0];

  // Construct a proper magnet URI from the infoHash + tracker list
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.tracker.cl:1337/announce',
    'udp://9.rarbg.com:2810/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
  ].map(t => `&tr=${encodeURIComponent(t)}`).join('');

  const magnetUrl = `magnet:?xt=urn:btih:${best.infoHash}&dn=${encodeURIComponent(best.title)}${trackers}`;


  return magnetUrl;
}

module.exports = { searchBestTorrent };

