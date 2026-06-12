const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const BASE_URL = 'https://api.themoviedb.org/3';

// In-memory cache for API requests
const fetchCache = new Map();

async function cachedFetch(url: string, options?: RequestInit) {
  if (fetchCache.has(url)) {
    const data = fetchCache.get(url);
    return { ok: true, json: async () => data } as any;
  }
  const response = await fetch(url, options);
  if (!response.ok) return response;
  const data = await response.json();
  fetchCache.set(url, data);
  return { ok: true, json: async () => data } as any;
}

export const fetchTrending = async () => {
  if (!TMDB_API_KEY) return [];
  const response = await cachedFetch(`${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US`);
  const data = await response.json();
  return data.results;
};

export const getImageUrl = (path: string, size: 'w500' | 'original' = 'original') => {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const fetchLogo = async (id: number | string, type: 'movie' | 'tv' = 'movie') => {
  if (!TMDB_API_KEY || !id) return null;
  try {
    const response = await cachedFetch(`${BASE_URL}/${type}/${id}/images?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    const logos = data.logos || [];
    const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
    return enLogo ? enLogo.file_path : (logos[0] ? logos[0].file_path : null);
  } catch (error) {
    return null;
  }
};

export const fetchMovieBackdrops = async (id: number | string) => {
  if (!TMDB_API_KEY || !id) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/movie/${id}/images?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.backdrops || [];
  } catch (error) {
    return [];
  }
};

export const fetchIsNetflixOriginal = async (id: number | string, type: 'movie' | 'tv' = 'movie') => {
  if (!TMDB_API_KEY || !id) return false;
  try {
    const response = await cachedFetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    
    const hasNetflixProd = data.production_companies?.some(
      (c: any) => c.name && c.name.toLowerCase().includes('netflix')
    );
    
    const hasNetflixNetwork = data.networks?.some(
      (n: any) => n.name && n.name.toLowerCase().includes('netflix')
    );

    return !!(hasNetflixProd || hasNetflixNetwork);
  } catch (error) {
    return false;
  }
};

export const fetchEpisodeDetails = async (showId: number | string, seasonNumber: number, episodeNumber: number) => {
  if (!TMDB_API_KEY || !showId) return null;
  try {
    const response = await cachedFetch(`${BASE_URL}/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}`);
    return await response.json();
  } catch (error) {
    return null;
  }
};

export const fetchSeasonDetails = async (tvId: string, seasonNumber: number) => {
    if (!TMDB_API_KEY) return null;
    try {
        const url = `${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`;
        const response = await cachedFetch(url);
        return await response.json();
    } catch (e) { return null; }
};

export const fetchDetails = async (id: number | string, type: 'movie' | 'tv' = 'movie') => {
  if (!TMDB_API_KEY || !id) return null;
  try {
    const response = await cachedFetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=images,credits,videos`);
    const data = await response.json();
    if (!data || !data.id) return null;
    return { ...data, media_type: type };
  } catch (error) {
    return null;
  }
};

export const STREAMING_PROVIDERS = {
    netflix: { id: 8, name: 'Netflix', color: '#E50914', networkId: 213, companyId: '213|420' },
    prime: { id: 119, name: 'Amazon Prime Video', color: '#00A8E1', networkId: 1024, companyId: '20580|7420|14' },
    disney: { id: 337, name: 'Disney+', color: '#113CCF', networkId: '2739|54', companyId: '2|420|1|3' },
    apple: { id: 350, name: 'Apple TV+', color: '#ffffff', networkId: 2552, companyId: '194232|10149' },
    hbo: { id: 1899, name: 'Max', color: '#5A00E6', networkId: '3186|49|80', companyId: '429|174|1184' },
    paramount: { id: 531, name: 'Paramount+', color: '#0064FF', networkId: '4330|43', companyId: '4|1088' },
    crunchyroll: { id: 283, name: 'Crunchyroll', color: '#F47521', networkId: 1112, companyId: '1112' },
    hulu: { id: 15, name: 'Hulu', color: '#1CE783', networkId: 453, companyId: '453' }
};
export type StreamingProviderKey = keyof typeof STREAMING_PROVIDERS;

export const TMDB_GENRE_IDS = {
    Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
    Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
    Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749, ScienceFiction: 878,
    TVMovie: 10770, Thriller: 53, War: 10752, Western: 37
};

export const fetchDiscoverByProvider = async (providerId: number, type: 'movie' | 'tv' = 'movie', page = 1, genreId?: number | string, sortBy = 'popularity.desc', customParams = '') => {
    if (!TMDB_API_KEY) return [];
    try {
        const region = (providerId === 15 || providerId === 384) ? 'US' : 'BR';
        let url = `${BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&with_watch_providers=${providerId}&watch_region=${region}&language=en-US&sort_by=${sortBy}&page=${page}`;
        if (genreId) url += `&with_genres=${genreId}`;
        if (customParams) url += customParams;
        const response = await cachedFetch(url);
        const data = await response.json();
        return data.results.map((item: any) => ({ ...item, media_type: type }));
    } catch (e) { return []; }
};

export const fetchRecentByProviderData = async (networkId: string | number, companyId: string) => {
    if (!TMDB_API_KEY) return [];
    try {
        const todayObj = new Date();
        const todayStr = todayObj.toISOString().split('T')[0];
        const startOfLastMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() - 1, 1).toISOString().split('T')[0];
        
        const tvUrl = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_networks=${networkId}&language=en-US&sort_by=first_air_date.desc&first_air_date.gte=${startOfLastMonth}&first_air_date.lte=${todayStr}`;
        const movieUrl = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_companies=${companyId}&language=en-US&sort_by=release_date.desc&release_date.gte=${startOfLastMonth}&release_date.lte=${todayStr}&with_release_type=4`;
        
        const [tvRes, movieRes] = await Promise.all([cachedFetch(tvUrl), cachedFetch(movieUrl)]);
        const tvData = await tvRes.json();
        const movieData = await movieRes.json();
        
        const combined = [
            ...(tvData.results || []).map((item: any) => ({ ...item, media_type: 'tv' })),
            ...(movieData.results || []).map((item: any) => ({ ...item, media_type: 'movie' }))
        ];
        
        combined.sort((a, b) => {
            const dateA = new Date(a.first_air_date || a.release_date).getTime();
            const dateB = new Date(b.first_air_date || b.release_date).getTime();
            return dateB - dateA;
        });
        return combined;
    } catch (e) { return []; }
};

export const fetchUpcomingByProviderData = async (networkId: string | number, companyId: string) => {
    if (!TMDB_API_KEY) return [];
    try {
        const todayObj = new Date();
        const todayStr = todayObj.toISOString().split('T')[0];
        const endOfMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const tvUrl = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_networks=${networkId}&language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&first_air_date.lte=${endOfMonth}`;
        const movieUrl = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_companies=${companyId}&language=en-US&sort_by=popularity.desc&release_date.gte=${todayStr}&release_date.lte=${endOfMonth}&with_release_type=4`;
        
        const [tvRes, movieRes] = await Promise.all([cachedFetch(tvUrl), cachedFetch(movieUrl)]);
        const tvData = await tvRes.json();
        const movieData = await movieRes.json();
        
        const combined = [
            ...(tvData.results || []).map((item: any) => ({ ...item, media_type: 'tv' })),
            ...(movieData.results || []).map((item: any) => ({ ...item, media_type: 'movie' }))
        ];
        
        combined.sort((a, b) => {
            const dateA = new Date(a.first_air_date || a.release_date || 0).getTime();
            const dateB = new Date(b.first_air_date || b.release_date || 0).getTime();
            return dateA - dateB;
        });
        return combined;
    } catch (e) { return []; }
};

export const fetchTop10ByProvider = async (providerId: number, type: 'movie' | 'tv' = 'movie', genreId?: number) => {
    if (!TMDB_API_KEY) return [];
    try {
        let url = `${BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&with_watch_providers=${providerId}&watch_region=US&language=en-US&sort_by=vote_count.desc&page=1`;
        if (genreId) url += `&with_genres=${genreId}`;
        const response = await cachedFetch(url);
        const data = await response.json();
        return data.results.slice(0, 10).map((item: any) => ({ ...item, media_type: type }));
    } catch (e) { return []; }
};

export const fetchMDBListRatings = async (id: number | string, type: 'movie' | 'tv' = 'movie') => {
    if (!id || !TMDB_API_KEY) return { imdb: null, rt: null };
    const cacheKey = `ratings_${type}_${id}`;
    
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
        
        // 1. Find IMDb ID from TMDB
        const extRes = await fetch(`${BASE_URL}/${type}/${id}/external_ids?api_key=${TMDB_API_KEY}`);
        if (!extRes.ok) return { imdb: null, rt: null };
        const extData = await extRes.json();
        const imdbId = extData.imdb_id;
        
        if (!imdbId) return { imdb: null, rt: null };
        
        // 2. Fetch Rotten Tomatoes and IMDb from OMDb API (much higher rate limit)
        const omdbRes = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=33c7fdb3`);
        if (!omdbRes.ok) return { imdb: null, rt: null };
        const omdbData = await omdbRes.json();
        
        let rtScore = null;
        if (omdbData.Ratings) {
            const rt = omdbData.Ratings.find((r: any) => r.Source === 'Rotten Tomatoes');
            if (rt) {
                rtScore = parseInt(rt.Value.replace('%', ''));
            }
        }
        
        const imdbScore = omdbData.imdbRating && omdbData.imdbRating !== 'N/A' ? omdbData.imdbRating : null;
        
        const result = { imdb: imdbScore, rt: rtScore };
        localStorage.setItem(cacheKey, JSON.stringify(result));
        return result;
    } catch (e) { return { imdb: null, rt: null }; }
};

export const fetchTrailerKey = async (id: number | string, type: 'movie' | 'tv' = 'movie') => {
  if (!TMDB_API_KEY || !id) return null;
  try {
    const response = await cachedFetch(`${BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    const videos = data.results || [];
    
    // Prioritize official trailers, then any trailer, then teasers, then just any video
    const officialTrailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official);
    if (officialTrailer) return officialTrailer.key;
    
    const trailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    if (trailer) return trailer.key;
    
    const teaser = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Teaser');
    if (teaser) return teaser.key;
    
    const anyVideo = videos.find((v: any) => v.site === 'YouTube');
    return anyVideo ? anyVideo.key : null;
  } catch (error) {
    return null;
  }
};

export const fetchNetflixOriginals = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_networks=213`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'tv' }));
  } catch (e) { return []; }
};

export const fetchPopularMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchTopRated = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchActionMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28&vote_count.gte=1000`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchComedyMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35&without_genres=16,28,12,14,878&vote_count.gte=1000`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchHorrorMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&vote_count.gte=1000`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchSciFiMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878&vote_count.gte=1000`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchRomanceMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10749&vote_count.gte=1000`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchAnimationMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&vote_count.gte=1000`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchDocumentaries = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    // Fetches True Crime Documentaries (TV Series)
    const response = await cachedFetch(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=99,80&vote_count.gte=100`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'tv' }));
  } catch (e) { return []; }
};

export const fetchTrendingMovies = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=en-US`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
  } catch (e) { return []; }
};

export const fetchTrendingSeries = async () => {
  if (!TMDB_API_KEY) return [];
  try {
    const response = await cachedFetch(`${BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}&language=en-US`);
    const data = await response.json();
    return data.results.map((item: any) => ({ ...item, media_type: 'tv' }));
  } catch (e) { return []; }
};