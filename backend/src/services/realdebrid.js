const axios = require('axios');
const querystring = require('querystring');

const RD_API = 'https://api.real-debrid.com/rest/1.0';
const RD_KEY = process.env.REAL_DEBRID_KEY;

const headers = { Authorization: `Bearer ${RD_KEY}` };

/**
 * Check instant availability for a list of infohashes
 * @param {string[]} hashes 
 * @returns {Promise<Object>} Map of hashes to their availability
 */
async function checkInstantAvailability(hashes) {
  if (!hashes || hashes.length === 0) return {};
  try {
    const res = await axios.get(`${RD_API}/torrents/instantAvailability/${hashes.join('/')}`, { headers });
    return res.data;
  } catch (err) {
    console.error('[RealDebrid] Error checking availability:', err.message);
    return {};
  }
}

/**
 * Add a magnet to Real-Debrid
 */
async function addMagnet(magnetUrl) {
  try {
    const res = await axios.post(`${RD_API}/torrents/addMagnet`, querystring.stringify({ magnet: magnetUrl }), {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return res.data; // { id, uri }
  } catch (err) {
    console.error('[RealDebrid] Error adding magnet:', err.message);
    throw err;
  }
}

/**
 * Get torrent info (files, status, progress, links)
 */
async function getTorrentInfo(torrentId) {
  try {
    const res = await axios.get(`${RD_API}/torrents/info/${torrentId}`, { headers });
    return res.data;
  } catch (err) {
    console.error(`[RealDebrid] Error getting info for ${torrentId}:`, err.message);
    throw err;
  }
}

/**
 * Select files to download. For video, we want the largest video file.
 */
async function selectFiles(torrentId, fileId = 'all') {
  try {
    await axios.post(`${RD_API}/torrents/selectFiles/${torrentId}`, querystring.stringify({ files: fileId }), {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return true;
  } catch (err) {
    console.error(`[RealDebrid] Error selecting files for ${torrentId}:`, err.message);
    throw err;
  }
}

/**
 * Unrestrict a link to get the direct CDN URL
 */
async function unrestrictLink(link) {
  try {
    const res = await axios.post(`${RD_API}/unrestrict/link`, querystring.stringify({ link }), {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return res.data; // { download: 'cdn_url', streamable: 1, ... }
  } catch (err) {
    console.error('[RealDebrid] Error unrestricting link:', err.message);
    throw err;
  }
}

/**
 * Get all active torrents
 */
async function getActiveTorrents() {
  try {
    const res = await axios.get(`${RD_API}/torrents`, { headers });
    return res.data;
  } catch (err) {
    console.error('[RealDebrid] Error getting active torrents:', err.message);
    return [];
  }
}

/**
 * Orchestrator: Submit magnet, select largest file, return ID and status
 */
async function processMagnet(magnetUrl) {
  // 1. Add Magnet
  const addRes = await addMagnet(magnetUrl);
  const torrentId = addRes.id;
  
  // 2. Get info to see files
  let info = await getTorrentInfo(torrentId);
  
  // RD requires files to be selected before it starts downloading
  if (info.status === 'waiting_files_selection') {
    // Find the largest file (typically the video)
    const videoExts = ['.mkv', '.mp4', '.avi', '.webm'];
    let largestFile = null;
    for (const file of info.files) {
      const ext = file.path.toLowerCase().match(/\.[^.]+$/);
      if (ext && videoExts.includes(ext[0])) {
        if (!largestFile || file.bytes > largestFile.bytes) {
          largestFile = file;
        }
      }
    }
    
    // If no explicit video found, just grab the largest overall
    if (!largestFile) {
      largestFile = info.files.reduce((prev, current) => (prev.bytes > current.bytes) ? prev : current);
    }
    
    // Select it
    await selectFiles(torrentId, largestFile.id.toString());
    
    // Refresh info
    info = await getTorrentInfo(torrentId);
  }
  
  return {
    torrentId,
    info
  };
}

module.exports = {
  checkInstantAvailability,
  addMagnet,
  getTorrentInfo,
  selectFiles,
  unrestrictLink,
  getActiveTorrents,
  processMagnet
};
