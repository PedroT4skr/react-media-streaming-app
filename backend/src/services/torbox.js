const axios = require('axios');
const FormData = require('form-data');

const TORBOX_API_URL = 'https://api.torbox.app/v1/api';
const TORBOX_API_KEY = process.env.TORBOX_API_KEY;

// Polling config
const POLL_INTERVAL_MS = 5000;   // check every 5s
const POLL_TIMEOUT_MS  = 120000; // 2 minute hard limit

const authHeaders = {
  Authorization: `Bearer ${TORBOX_API_KEY}`,
};

const activeDownloads = new Map();

/**
 * Add a magnet link to TorBox and wait until the file is ready.
 *
 * TorBox API quirks documented here:
 * - POST /torrents/createtorrent expects multipart/form-data, NOT JSON
 * - GET /torrents/mylist returns an ARRAY when no id is given; single object when id is given
 * - GET /torrents/requestdl uses `token` query param (NOT Authorization header)
 *
 * @param {string} magnetUrl - valid magnet:?xt=urn:btih:... URI
 * @returns {Promise<{ streamUrl: string, filename: string, size: number, status: string, progress?: number }>}
 */
async function getMagnetStreamUrl(magnetUrl) {
  let torrentId;

  // 1. Check if we already submitted this magnet recently
  if (activeDownloads.has(magnetUrl)) {
    torrentId = activeDownloads.get(magnetUrl);
  } else {
    // Submit magnet via multipart/form-data
    const form = new FormData();
    form.append('magnet', magnetUrl);
    form.append('seed', '3');
    form.append('allow_zip', 'false');

    const createRes = await axios.post(
      `${TORBOX_API_URL}/torrents/createtorrent`,
      form,
      {
        headers: { ...authHeaders, ...form.getHeaders() },
        timeout: 20000,
      }
    );


    torrentId = createRes.data?.data?.torrent_id ?? createRes.data?.data?.id;

    if (!torrentId) {
      throw new Error(`TorBox did not return a torrent ID. Response: ${JSON.stringify(createRes.data)}`);
    }

    activeDownloads.set(magnetUrl, torrentId);
  }



  // 2. Poll /mylist ONCE to get status
  const infoRes = await axios.get(
    `${TORBOX_API_URL}/torrents/mylist`,
    {
      params: { id: torrentId, bypass_cache: 'true' },
      headers: authHeaders,
      timeout: 10000,
    }
  );

  const torrent = infoRes.data?.data;
  if (!torrent) {
    return { status: 'downloading', progress: 0 };
  }

  const status = torrent.download_state ?? torrent.status ?? 'unknown';
  const progress = torrent.progress ?? 0;

  const isDone = status === 'completed'
    || status === 'cached'
    || status === 'paused'   // TorBox marks seeding torrents as 'paused' when done
    || progress >= 1;

  if (isDone) {
    // 3. Find the largest file (the main video, not NFO/subtitle sidecar)
    const files = torrent.files ?? [];
    if (files.length === 0) throw new Error('TorBox completed but returned no files');

    const largestFile = [...files].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];

    // 4. Request CDN link — uses token as query param, NOT Bearer header
    const linkRes = await axios.get(
      `${TORBOX_API_URL}/torrents/requestdl`,
      {
        params: {
          token: TORBOX_API_KEY,
          torrent_id: torrentId,
          file_id: largestFile.id,
          zip_link: 'false',
        },
        headers: authHeaders,
        timeout: 10000,
      }
    );

    const streamUrl = linkRes.data?.data;
    if (!streamUrl || typeof streamUrl !== 'string') {
      throw new Error(`TorBox requestdl returned invalid URL: ${JSON.stringify(linkRes.data)}`);
    }

    return { url: streamUrl, filename: largestFile.name, size: largestFile.size, status: 'ready' };
  }

  if (status === 'error' || status === 'paused') {
    activeDownloads.delete(magnetUrl);
    throw new Error(`TorBox failed: ${torrent.status_message ?? status}`);
  }

  return { status: 'downloading', progress: Math.floor(progress * 100) };
}

async function checkInstantAvailability(hashes) {
  if (!hashes || hashes.length === 0) return [];
  const hashString = hashes.join(',');
  try {
    const res = await axios.get(`${TORBOX_API_URL}/torrents/checkcached`, {
      params: { hash: hashString, format: 'list' },
      headers: authHeaders,
      timeout: 10000
    });
    // TorBox returns data array of objects containing { hash, name, size } if cached
    if (res.data && res.data.success && res.data.data) {
      return res.data.data.map(item => item.hash);
    }
    return [];
  } catch (err) {
    console.error('[TorBox] Error checking Instant Availability:', err.message);
    return [];
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { getMagnetStreamUrl, checkInstantAvailability };

