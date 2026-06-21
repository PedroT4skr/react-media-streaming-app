import { fetchDetails, fetchEpisodeDetails, fetchMovieBackdrops } from './tmdb';

const TRAKT_API_KEY = import.meta.env.VITE_TRAKT_CLIENT_ID || 'baeb434b79085ee2ea0134a94aa4377b771f750f0e69676658ceb1c410b1fd83';
const TRAKT_API_SECRET = import.meta.env.VITE_TRAKT_CLIENT_SECRET || '';

const headers = {
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': TRAKT_API_KEY,
};

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export const generateDeviceCode = async (): Promise<DeviceCodeResponse | null> => {
  try {
    const response = await fetch('https://api.trakt.tv/oauth/device/code', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_id: TRAKT_API_KEY,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to generate device code');
    return await response.json();
  } catch (error) {
    console.error('Error generating device code:', error);
    return null;
  }
};

export const pollForToken = async (deviceCode: string): Promise<string | null> => {
  if (!TRAKT_API_SECRET) {
    throw new Error("Missing VITE_TRAKT_CLIENT_SECRET");
  }

  try {
    const response = await fetch('https://api.trakt.tv/oauth/device/token', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: deviceCode,
        client_id: TRAKT_API_KEY,
        client_secret: TRAKT_API_SECRET,
      }),
    });

    if (response.status === 200) {
      const data = await response.json();
      return data.access_token;
    }
    
    // 400 can mean "Pending" OR "invalid_client"
    if (response.status === 400) {
      try {
        const errorText = await response.text();
        if (!errorText) return null; // Empty body, probably pending CORS
        
        const errorData = JSON.parse(errorText);
        if (errorData.error === 'pending') {
          return null;
        }
        throw new Error(`Auth failed: ${errorData.error_description || errorData.error}`);
      } catch (e: any) {
        // If we threw a specific auth error above, rethrow it
        if (e.message && e.message.startsWith('Auth failed')) throw e;
        
        // Otherwise, if JSON parsing failed, assume it's the standard pending state
        return null; 
      }
    }
    
    // If we get 403, 401, 404, etc.
    throw new Error(`Auth failed with status ${response.status}. Please check your VITE_TRAKT_CLIENT_SECRET.`);
  } catch (error) {
    console.error('Error polling for token:', error);
    throw error;
  }
};

export const fetchTraktPlaybackProgress = async (accessToken: string) => {
  try {
    const response = await fetch('https://api.trakt.tv/sync/playback?limit=10', {
      headers: {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) throw new Error('Failed to fetch playback progress');
    return await response.json();
  } catch (error) {
    console.error('Error fetching playback progress:', error);
    return [];
  }
};

export const getTraktContinueWatching = async (accessToken: string) => {
  const playback = await fetchTraktPlaybackProgress(accessToken);
  if (!playback || !playback.length) return [];

  // Deduplicate: Keep only the most recently paused episode per TV Show
  const uniquePlayback = [];
  const seenShows = new Set();
  
  for (const item of playback) {
    if (item.type === 'episode') {
      const showId = item.show?.ids?.tmdb;
      if (showId) {
        if (seenShows.has(showId)) continue;
        seenShows.add(showId);
      }
    }
    uniquePlayback.push(item);
  }

  const results = await Promise.all(uniquePlayback.map(async (item: any) => {
    try {
      const isTv = item.type === 'episode';
      const tmdbId = isTv ? item.show.ids.tmdb : item.movie.ids.tmdb;

      
      const tmdbData = await fetchDetails(tmdbId, isTv ? 'tv' : 'movie');
      if (!tmdbData) return null;

      let specificFrame = null;
      let specificRuntime = null;
      
      if (isTv && item.episode) {
        const epData = await fetchEpisodeDetails(tmdbId, item.episode.season, item.episode.number);
        if (epData) {
          if (epData.still_path) specificFrame = epData.still_path;
          if (epData.runtime) specificRuntime = epData.runtime;
        }
      } else if (!isTv) {
        const backdrops = await fetchMovieBackdrops(tmdbId);
        // Clean textless frames usually have iso_639_1 as null
        const cleanBackdrops = backdrops.filter((b: any) => b.iso_639_1 === null);
        if (cleanBackdrops.length > 0) {
          // Use movie ID to deterministically pick a "random" frame so it doesn't flash/change every single reload
          const randomIndex = tmdbId % cleanBackdrops.length;
          specificFrame = cleanBackdrops[randomIndex].file_path;
        }
      }

      const progress = Math.round(item.progress || 0);
      const finalImage = specificFrame || tmdbData.backdrop_path || tmdbData.poster_path || '';
      const runtime = specificRuntime || tmdbData.runtime || (tmdbData.episode_run_time && tmdbData.episode_run_time[0]) || 45;
      
      const remainingTotalMinutes = Math.round((100 - progress) / 100 * runtime);
      let remainingTimeString = `${remainingTotalMinutes}m left`;
      if (remainingTotalMinutes > 59) {
        const hours = Math.floor(remainingTotalMinutes / 60);
        const mins = remainingTotalMinutes % 60;
        remainingTimeString = mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
      }

      return {
        id: isTv ? `cw-${tmdbId}-s${item.episode.season}e${item.episode.number}` : `cw-${tmdbId}`,
        title: isTv ? item.show.title : item.movie.title,
        backdropUrl: finalImage ? `https://image.tmdb.org/t/p/w500${finalImage}` : '',
        progress,
        remainingTime: remainingTimeString,
        type: isTv ? 'tv' as const : 'movie' as const,
        season: isTv ? item.episode.season : undefined,
        episode: isTv ? item.episode.number : undefined,
        episodeTitle: isTv ? item.episode.title : undefined,
      };
    } catch (err) {
      return null;
    }
  }));

  return results.filter(Boolean);
};

// ─── Scrobbling ──────────────────────────────────────────────────

export type ScrobbleAction = 'start' | 'pause' | 'stop';

export interface ScrobblePayload {
  tmdbId: string | number;
  type: 'movie' | 'tv';
  progress: number;
  season?: number;
  episode?: number;
}

export const scrobbleToTrakt = async (
  accessToken: string,
  action: ScrobbleAction,
  payload: ScrobblePayload
) => {
  if (!accessToken) return null;

  try {
    const body: any = { 
      progress: payload.progress,
      app_version: '1.0.0',
      app_date: '2024-06-11'
    };

    if (payload.type === 'movie') {
      body.movie = { ids: { tmdb: Number(payload.tmdbId) } };
    } else {
      body.show = { ids: { tmdb: Number(payload.tmdbId) } };
      body.episode = {
        season: payload.season,
        number: payload.episode,
      };
    }

    const response = await fetch(`https://api.trakt.tv/scrobble/${action}`, {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Scrobble ${action} failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error scrobbling [${action}]:`, error);
    return null;
  }
};
