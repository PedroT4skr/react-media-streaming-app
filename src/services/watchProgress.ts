import { getImageUrl, fetchDetails, fetchLogo, fetchEpisodeDetails, fetchMovieBackdrops } from './tmdb';
import type { ContinueWatchingItem } from '../components/media/ContinueWatchingCard';

// ─────────────────────────────────────────────────────────────────
// WHY: Trakt depends on an API call that only triggers on explicit
// pause/stop. An Alt+F4, browser crash, or system sleep will lose
// all progress. This service writes directly to localStorage on a
// tight interval so the worst-case data loss is ~10 seconds.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'stremio_watch_progress';

export interface WatchProgressEntry {
  tmdbId: string;
  type: 'movie' | 'tv';
  title: string;
  backdropPath: string;      // TMDB relative path (e.g. /abc123.jpg)
  currentTime: number;        // seconds
  duration: number;           // seconds
  progress: number;           // 0-100
  season?: number;
  episode?: number;
  episodeTitle?: string;
  lastWatchedAt: number;      // Date.now() timestamp
}

/** Deterministic unique key per content unit */
function makeKey(tmdbId: string, type: string, season?: number | string | null, episode?: number | string | null): string {
  if (type === 'tv' && season && episode) {
    return `${tmdbId}_s${season}e${episode}`;
  }
  return tmdbId;
}

/** Read the full registry from localStorage */
function readRegistry(): Record<string, WatchProgressEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persist the full registry to localStorage */
function writeRegistry(registry: Record<string, WatchProgressEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('[watchProgress] Failed to persist registry', e);
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Saves (or updates) progress for a media item.
 * Designed to be called frequently (every 10s) — it's a cheap
 * synchronous localStorage write.
 */
export function saveProgress(entry: WatchProgressEntry): void {
  const key = makeKey(entry.tmdbId, entry.type, entry.season, entry.episode);
  const registry = readRegistry();

  // Auto-advance completed content (>= 95% watched)
  if (entry.progress >= 95) {
    if (entry.type === 'tv' && entry.season && entry.episode) {
      const nextKey = makeKey(entry.tmdbId, entry.type, entry.season, entry.episode + 1);
      registry[nextKey] = {
        ...entry,
        episode: entry.episode + 1,
        currentTime: 0,
        progress: 0,
        lastWatchedAt: Date.now()
      };
    }
    delete registry[key];
    writeRegistry(registry);
    return;
  }

  // Don't save if barely started (< 2% or < 30s), EXCEPT if we specifically auto-advanced it (progress === 0)
  if (entry.progress < 2 && entry.currentTime < 30 && entry.progress !== 0) {
    return;
  }

  registry[key] = { ...entry, lastWatchedAt: Date.now() };
  writeRegistry(registry);
}

/** Get progress for a specific content unit */
export function getProgress(tmdbId: string, type: string, season?: number | string | null, episode?: number | string | null): WatchProgressEntry | null {
  const key = makeKey(tmdbId, type, season, episode);
  const registry = readRegistry();
  return registry[key] || null;
}

/** Get all in-progress entries, sorted by most recently watched */
export function getAllProgress(): WatchProgressEntry[] {
  const registry = readRegistry();
  return Object.values(registry)
    .filter(e => e.progress < 95 && (e.progress >= 2 || (e.type === 'tv' && e.progress === 0)))
    .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
}

/** Remove a specific entry */
export function removeProgress(tmdbId: string, type: string, season?: number | string | null, episode?: number | string | null): void {
  const key = makeKey(tmdbId, type, season, episode);
  const registry = readRegistry();
  delete registry[key];
  writeRegistry(registry);
}

/**
 * Converts the local registry into ContinueWatchingItem[] ready
 * for the carousel. Enriches with logos and episode stills from TMDB.
 * 
 * This is the expensive async variant — call it once on Home mount,
 * not on every render.
 */
export async function getLocalContinueWatching(): Promise<ContinueWatchingItem[]> {
  const entries = getAllProgress();
  if (entries.length === 0) return [];

  // Deduplicate: for TV, keep only the most recent episode per show
  const deduped: WatchProgressEntry[] = [];
  const seenShows = new Set<string>();

  for (const entry of entries) {
    if (entry.type === 'tv') {
      if (seenShows.has(entry.tmdbId)) continue;
      seenShows.add(entry.tmdbId);
    }
    deduped.push(entry);
  }

  const items = await Promise.all(deduped.map(async (entry): Promise<ContinueWatchingItem | null> => {
    try {
      const runtime = entry.duration > 0 ? entry.duration / 60 : 0; // minutes
      const remainingMinutes = Math.round((100 - entry.progress) / 100 * runtime);

      let remainingTime: string;
      if (remainingMinutes > 59) {
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;
        remainingTime = mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
      } else {
        remainingTime = `${remainingMinutes}m left`;
      }

      // Try to get a better frame for TV episodes
      let backdropUrl = entry.backdropPath
        ? getImageUrl(entry.backdropPath, 'w500')
        : '';

      if (entry.type === 'tv' && entry.season && entry.episode) {
        try {
          const epData = await fetchEpisodeDetails(entry.tmdbId, entry.season, entry.episode);
          if (epData?.still_path) {
            backdropUrl = getImageUrl(epData.still_path, 'w500');
          }
        } catch { /* fallback to stored backdrop */ }
      } else if (entry.type === 'movie') {
        try {
          const backdrops = await fetchMovieBackdrops(entry.tmdbId);
          const clean = backdrops.filter((b: any) => b.iso_639_1 === null);
          if (clean.length > 0) {
            const idx = parseInt(entry.tmdbId, 10) % clean.length;
            backdropUrl = getImageUrl(clean[idx].file_path, 'w500');
          }
        } catch { /* fallback */ }
      }

      const id = entry.type === 'tv' && entry.season && entry.episode
        ? `cw-${entry.tmdbId}-s${entry.season}e${entry.episode}`
        : `cw-${entry.tmdbId}`;

      return {
        id,
        title: entry.title,
        backdropUrl,
        progress: Math.round(entry.progress),
        remainingTime,
        type: entry.type,
        season: entry.season,
        episode: entry.episode,
        episodeTitle: entry.episodeTitle,
      };
    } catch {
      return null;
    }
  }));

  return items.filter(Boolean) as ContinueWatchingItem[];
}
