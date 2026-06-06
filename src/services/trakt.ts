import { fetchDetails } from './tmdb';

const TRAKT_API_KEY = import.meta.env.VITE_TRAKT_CLIENT_ID || 'baeb434b79085ee2ea0134a94aa4377b771f750f0e69676658ceb1c410b1fd83';

const headers = {
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': TRAKT_API_KEY,
};

// We will fetch from Trakt, extract TMDB IDs, and then fetch from TMDB.
export const fetchTraktListWithTMDB = async (endpoint: string, type: 'movie' | 'tv' = 'movie', page = 1, limit = 20) => {
  if (!TRAKT_API_KEY) return [];
  
  try {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `https://api.trakt.tv${endpoint}${separator}page=${page}&limit=${limit}`;
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
        console.error(`Trakt API error: ${response.status}`);
        return [];
    }
    
    const data = await response.json();
    
    const tmdbIds = data.map((item: any) => {
      if (item.movie) return item.movie.ids?.tmdb;
      if (item.show) return item.show.ids?.tmdb;
      return item.ids?.tmdb; // For endpoints that directly return items without movie/show wrapper
    }).filter(Boolean);

    // Inflate using TMDB in smaller batches to avoid 429 Rate Limit
    const batchSize = 5;
    const tmdbItems = [];
    
    for (let i = 0; i < tmdbIds.length; i += batchSize) {
      const batch = tmdbIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((id: number) => fetchDetails(id, type))
      );
      tmdbItems.push(...batchResults);
    }
    
    // Filtra itens nulos e garante que o campo genre_ids seja populado
    return tmdbItems.filter(Boolean).map(item => {
        if (!item.genre_ids && item.genres) {
            item.genre_ids = item.genres.map((g: any) => g.id);
        }
        return item;
    });
  } catch (error) {
    console.error("Trakt/TMDB Hybrid Fetch Error:", error);
    return [];
  }
};

export const getTraktProviderSlug = (provider: string) => {
  const map: Record<string, string> = {
    netflix: 'netflix',
    prime: 'amazon_prime_video',
    disney: 'disney_plus',
    apple: 'apple_tv_plus',
    hbo: 'max',
    paramount: 'paramount_plus',
    peacock: 'peacock',
    hulu: 'hulu'
  };
  return map[provider] || 'netflix';
};

