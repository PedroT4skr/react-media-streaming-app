const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE   = 'https://api.themoviedb.org/3';

/**
 * Resolve TMDB ID to { title, year, type, imdb_id }.
 * Used to build an accurate search query or query Torrentio by IMDB ID.
 * @param {string} tmdbId
 * @param {'movie'|'tv'} type
 */
async function getMediaInfo(tmdbId, type = 'movie') {
  const url = `${TMDB_BASE}/${type}/${tmdbId}`;
  const res = await axios.get(url, {
    params: { 
      api_key: TMDB_API_KEY, 
      language: 'en-US',
      append_to_response: 'external_ids'
    },
    timeout: 8000,
  });

  const data = res.data;
  const title = type === 'movie' ? data.title : data.name;
  const rawDate = type === 'movie' ? data.release_date : data.first_air_date;
  const year = rawDate ? new Date(rawDate).getFullYear() : null;
  
  // Extract IMDB ID (it's at the root for movies, but in external_ids for TV shows)
  const imdb_id = data.imdb_id || (data.external_ids && data.external_ids.imdb_id);

  if (!imdb_id) {
    throw new Error(`No IMDB ID found for TMDB ID: ${tmdbId}. Torrentio requires an IMDB ID.`);
  }

  return { title, year, type, imdb_id };
}

module.exports = { getMediaInfo };
