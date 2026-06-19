## 4. Active State
- **SDLC Phase**: Trakt Bidirectional Scrobbling implemented (`/start`, `/pause`, `/stop`). Progress bars synced natively and in the cloud. Player persistence uses multi-layer approach alongside Trakt sync.

---

## 1. Repository Topology
```
react project/
├── backend/                        ← Node.js API server
│   ├── src/
│   │   ├── routes/
│   │   │   ├── stream.js           ← GET /api/stream/:tmdb_id pipeline handler (TMDB -> Torrentio+RD)
│   │   │   └── skip.js             ← GET /api/skip/:tmdb_id skip timestamps (intro/recap/credits)
│   │   ├── services/
│   │   │   ├── torrentio.js        ← Torrentio API integration (native Real-Debrid resolver)
│   │   │   ├── torbox.js           ← (DEPRECATED) TorBox debrid polling
│   │   │   └── tmdb.js             ← TMDB metadata resolution (IMDB ID lookup)
│   │   └── server.js               ← Express entry point, CORS, health check
│   ├── .env.example                ← Environment variable template
│   ├── Dockerfile                  ← Docker image (node:20-alpine, non-root)
│   └── package.json                ← scripts: start / dev
├── docker-compose.yml              ← Orchestrates backend
├── public/
│   ├── avatar.svg                  ← Profile avatar SVG (Notionists)
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── FloatingNav.tsx     ← Fixed Rules of Hooks violation; hides on /login and /profiles
│   │   └── media/
│   │       ├── ContinueWatchingCard.tsx  ← Card UI with logo, progress bar, and remaining time
│   │       ├── ContinueWatchingCarousel.tsx ← Built-in navigation to /player on click
│   │       ├── HeroBanner.tsx
│   │       ├── MediaCard.tsx
│   │       └── MediaCarousel.tsx
│   ├── pages/
│   │   ├── Discover.tsx
│   │   ├── Home.tsx               ← Uses localCW (watchProgress) when Trakt is not connected
│   │   ├── Login.tsx               ← Glass UI buttons; redirects to /profiles on any credential
│   │   ├── Player.tsx              ← Crash-proof progress: 10s interval + beforeunload + pagehide + visibilitychange
│   │   ├── Profiles.tsx            ← "Who's watching?" screen; glass buttons; sets Zustand activeProfile
│   │   ├── Search.tsx
│   │   └── TitleDetails.tsx        ← Play button navigates to /player/:id?type=movie|tv
│   ├── services/
│   │   ├── tmdb.ts                 ← TMDB API client with in-memory cache
│   │   ├── trakt.ts                ← Trakt scrobbling
│   │   ├── traktAuth.ts            ← Trakt OAuth device flow + ContinueWatching from Trakt API
│   │   └── watchProgress.ts        ← LOCAL crash-proof watch progress registry (localStorage)
│   ├── store/
│   │   └── useStore.ts             ← activeProfile, Trakt state, scroll positions
│   ├── App.tsx                     ← Routes: / /login /profiles /discover /title /search /player
│   ├── index.css                   ← glass-button-active/hover with centered top-glow lighting
│   └── main.tsx
├── vite.config.ts                  ← Dev proxy: /api → http://localhost:3001
└── tailwind.config.js
```

---

## 2. File Manifest

### Backend
- **`backend/src/server.js`**: Express app. CORS locked to `FRONTEND_URL`. Mounts `/api/stream` router. Health endpoint at `/health`.
- **`backend/src/routes/stream.js`**: 2-stage pipeline: TMDB → Torrentio+RealDebrid. In-memory cache (12h TTL). Completely bypasses slow Debrid polling by fetching instantly resolved HTTP URLs.
- **`backend/src/services/torrentio.js`**: Queries Torrentio's cloud API using the Real-Debrid token (`REAL_DEBRID_KEY`). Filters explicitly for `[RD+]` instant-cached links, applies browser codec compatibility scores, and returns direct video URLs.
- **`backend/src/services/torbox.js`**: Deprecated. Replaced by direct Torrentio Debrid resolution.
- **`backend/src/services/tmdb.js`**: Resolves TMDB ID → `{ title, year, type, imdb_id }` required by Torrentio.

### Frontend
- **`src/services/watchProgress.ts`**: **NEW.** Crash-proof local watch progress service. localStorage-backed registry keyed by `{tmdbId}` or `{tmdbId}_s{season}e{episode}`. `saveProgress()` is called every 10s + on browser exit events. `getLocalContinueWatching()` returns enriched `ContinueWatchingItem[]` for the carousel. Auto-removes entries at ≥95% completion. Ignores entries at <2% progress.
- **`src/pages/Player.tsx`**: `progressSnapshotRef` holds the latest `{currentTime, duration, title, backdropPath, episodeTitle}`. `flushProgress()` writes to both `watchProgress` service and legacy localStorage key. Called via: 10s `setInterval`, `beforeunload`, `pagehide`, `visibilitychange`, and React unmount cleanup.
- **`src/pages/Home.tsx`**: When Trakt is connected, uses Trakt API for ContinueWatching. When not connected, loads from `getLocalContinueWatching()` (real watch history). Removed fake mock data.
- **`src/components/media/ContinueWatchingCarousel.tsx`**: Now includes built-in `useNavigate` click handler. Extracts tmdbId/season/episode from the CW item ID and navigates to `/player/:tmdbId?type=...&season=...&episode=...`.
- **`src/pages/Login.tsx`**: Fake auth → redirects to `/profiles`. Glass buttons with mouse-tracker spotlight.
- **`src/pages/Profiles.tsx`**: 4 profile cards + Add Profile (glass). Click sets Zustand `activeProfile` → animated selection → navigate `/`.
- **`src/components/layout/FloatingNav.tsx`**: All hooks called unconditionally; single conditional `return null` after all hooks for `/login`, `/profiles`, `/title/*`.

---

## 3. Feature & Function Ledger

### `src/services/watchProgress.ts`
- **`saveProgress(entry)`**: Writes a `WatchProgressEntry` to the localStorage registry. Auto-removes at ≥95%, skips at <2% and <30s. Keyed by `{tmdbId}[_s{season}e{episode}]`.
- **`getProgress(tmdbId, type, season?, episode?)`**: Returns saved entry or null.
- **`getAllProgress()`**: Returns all entries sorted by `lastWatchedAt` DESC, filtered 2–95% range.
- **`getLocalContinueWatching()`**: Async. Deduplicates TV shows (most recent ep only). Enriches with episode stills and movie backdrops from TMDB. Returns `ContinueWatchingItem[]`.

### `src/services/streamCache.ts`
- **`cacheStream(tmdbId, type, season, episode, stream)`**: Saves a resolved Debrid HTTP URL to `localStorage` with a 4-hour TTL.
- **`getCachedStream(...)`**: Retrieves a cached stream if it exists and hasn't expired.
- **`validateCachedStream(url)`**: Performs a HEAD request with a 3s timeout to ensure the cached URL is still alive (HTTP 200/206).

### `src/services/traktAuth.ts`
- **`scrobbleToTrakt(accessToken, action, payload)`**: Handles bidirectional `/scrobble/start`, `/pause`, and `/stop` endpoints to sync local player progress back to the Trakt cloud.

### `src/pages/Player.tsx`
- **`progressSnapshotRef`**: Ref updated on every `onTimeUpdate`. Contains `{currentTime, duration, title, backdropPath, episodeTitle}`.
- **`flushProgress()`**: Reads snapshot ref → calls `saveProgress()` + writes legacy `localStorage` key. Additionally dispatches `/scrobble/pause` or `/scrobble/stop` (if >= 90%) to Trakt.
- **`onPlaying`**: Dispatches `/scrobble/start` to Trakt on playback initialization/resume.
- **`useEffect` (persistence lifecycle)**: 10s interval + `beforeunload` + `pagehide` + `visibilitychange` listeners. Final flush on unmount.
- **`useStreamUrl(tmdbId, type)`**: Custom hook. Implements **fast-path caching**: Checks `streamCache` first, validates via HEAD, and if successful, completely bypasses the 2-8s backend Torrentio pipeline. Saves newly resolved streams to cache.

### `src/pages/Home.tsx`
- **Stream Pre-Warming**: A background `useEffect` that sequentially fires `/api/stream/:id` for each item in the ContinueWatching carousel. This pre-populates the `streamCache`, allowing instant (<200ms) playback when a user clicks a ContinueWatching card.

### `backend/src/routes/stream.js`
- **`GET /:tmdb_id`**: Checks in-memory cache first (Map, 4h TTL). Calls `getMediaInfo` → `searchBestTorrent` → `getMagnetStreamUrl`. Returns `{ url, filename, size, cached }`.

### `backend/src/services/torrentio.js`
- **`searchBestTorrent(title, year, type)`**: Queries Torrentio cloud API with RD token. Filters `[RD+]` cached links. Ranks by codec compatibility. Returns direct HTTP URLs.
