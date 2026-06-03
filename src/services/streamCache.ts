// ─────────────────────────────────────────────────────────────────
// Stream URL Cache
// ─────────────────────────────────────────────────────────────────
// WHY: Real-Debrid / TorBox links are HTTP URLs valid for 6–12h.
// Caching them locally means the SECOND play of the same content
// skips the entire Torrentio → Debrid pipeline (which takes 2–8s).
// The URL is validated with a HEAD request before use (~50ms) to
// ensure it hasn't expired.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'stremio_stream_cache_v6';
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (conservative; RD links last 6–12h)

export interface CachedStream {
  url: string;
  filename: string;
  size: number;
  metadata?: {
    name: string;
    quality: string;
    audio: string;
    scraper: string;
    debrid: string;
  };
  cachedAt: number;
}

/** Deterministic cache key per content unit */
function makeKey(tmdbId: string, type: string, season?: string | null, episode?: string | null, lang: string = 'en'): string {
  if (type === 'tv' && season && episode) {
    return `${type}:${tmdbId}:S${season}E${episode}:${lang}`;
  }
  return `${type}:${tmdbId}:${lang}`;
}

/** Read the full cache registry */
function readCache(): Record<string, CachedStream> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Write the full cache registry */
function writeCache(cache: Record<string, CachedStream>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[streamCache] Write failed', e);
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Save a resolved stream URL to the cache.
 * Called after a successful stream resolution in Player.tsx.
 */
export function cacheStream(
  tmdbId: string,
  type: string,
  season: string | null,
  episode: string | null,
  stream: Omit<CachedStream, 'cachedAt'>,
  lang: string = 'en'
): void {
  const cache = readCache();
  const key = makeKey(tmdbId, type, season, episode, lang);

  // Evict expired entries while we're here (keeps localStorage clean)
  const now = Date.now();
  for (const k of Object.keys(cache)) {
    if (now - cache[k].cachedAt > TTL_MS) {
      delete cache[k];
    }
  }

  cache[key] = { ...stream, cachedAt: now };
  writeCache(cache);
}

/**
 * Retrieve a cached stream if it exists and hasn't expired.
 * Does NOT validate the URL — call `validateCachedStream` for that.
 */
export function getCachedStream(
  tmdbId: string,
  type: string,
  season?: string | null,
  episode?: string | null,
  lang: string = 'en'
): CachedStream | null {
  const cache = readCache();
  const key = makeKey(tmdbId, type, season, episode, lang);
  const entry = cache[key];

  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    // Expired — clean it up
    delete cache[key];
    writeCache(cache);
    return null;
  }

  return entry;
}

/**
 * Validate a cached URL.
 * Since Real-Debrid download URLs block HEAD requests via CORS,
 * we bypass the active fetch and rely entirely on the conservative
 * 4-hour TTL enforced by getCachedStream.
 */
export async function validateCachedStream(url: string): Promise<boolean> {
  return true;
}

/**
 * Remove a specific entry from the cache.
 */
export function invalidateStream(
  tmdbId: string,
  type: string,
  season?: string | null,
  episode?: string | null,
  lang: string = 'en'
): void {
  const key = makeKey(tmdbId, type, season, episode, lang);
  const cache = readCache();
  delete cache[key];
  writeCache(cache);
}

/**
 * Get all cached stream keys (for pre-warming logic).
 */
export function getAllCachedKeys(): string[] {
  return Object.keys(readCache());
}
