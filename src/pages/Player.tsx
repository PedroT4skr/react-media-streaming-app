import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchDetails, fetchLogo, getImageUrl, fetchSeasonDetails } from '../services/tmdb';
import { ArrowLeft, AlertCircle, Loader2, Play, Pause, RotateCcw, RotateCw, Maximize, Volume2, VolumeX, Captions, PictureInPicture, Monitor, Info, ListVideo, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveProgress, getProgress } from '../services/watchProgress';
import { getCachedStream, validateCachedStream, cacheStream, invalidateStream } from '../services/streamCache';
import { scrobbleToTrakt } from '../services/traktAuth';
import { useStore } from '../store/useStore';

type StreamState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'downloading'; progress: number; progressTorbox?: number; speed: number; filename?: string }
  | { status: 'ready'; url: string; filename: string; size: number; metadata?: { name: string; quality: string; audio: string; scraper: string; debrid: string } }
  | { status: 'error'; message: string };

function useStreamUrl(
  tmdbId: string | undefined, 
  type: string | undefined, 
  season: string | null, 
  episode: string | null, 
  audioPref: string = 'en',
  preloadedStream?: { url: string; filename: string; size: number; metadata?: any }
) {
  const [state, setState] = useState<StreamState>(
    preloadedStream 
      ? { status: 'ready', url: preloadedStream.url, filename: preloadedStream.filename, size: preloadedStream.size, metadata: preloadedStream.metadata } 
      : { status: 'idle' }
  );
  const abortRef = useRef<AbortController | null>(null);

  const fetchStream = useCallback(async () => {
    if (!tmdbId || !type) return;
    
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // ─── Fast-path: check localStorage stream cache ─────────────
    const cached = getCachedStream(tmdbId, type, season, episode, audioPref);
    
    if (state.status !== 'ready') {
      setState({ status: 'loading' });
    }

    if (cached) {
      const isValid = await validateCachedStream(cached.url);
      if (isValid) {
        setState({ status: 'ready', url: cached.url, filename: cached.filename, size: cached.size, metadata: cached.metadata });
        return;
      }
      invalidateStream(tmdbId, type, season, episode, audioPref);
    } else if (preloadedStream && audioPref === 'en') {
      setState({ status: 'ready', url: preloadedStream.url, filename: preloadedStream.filename, size: preloadedStream.size, metadata: preloadedStream.metadata });
      return;
    }

    if (state.status !== 'ready') {
      setState({ status: 'loading' });
    }

    try {
      const apiBase = import.meta.env.VITE_BACKEND_URL || '';
      let url = `${apiBase}/api/stream/${tmdbId}?type=${type}&lang=${audioPref}&_t=${Date.now()}`;
      if (type === 'tv' && season && episode) {
        url += `&season=${season}&episode=${episode}`;
      }
      const res = await fetch(url, {
        signal: abortRef.current.signal,
        cache: 'no-store'
      });

      if (!res.ok) {
        let errMsg = `Erro HTTP ${res.status}`;
        try {
          const body = await res.json();
          errMsg = body.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.status === 'downloading') {
        setState({ status: 'downloading', progress: data.progress, progressTorbox: data.progressTorbox, speed: data.speed, filename: data.filename });
        // Poll again in 3 seconds to get updated progress
        setTimeout(() => fetchStream(), 3000);
      } else {
        // Cache the resolved URL for future instant playback
        cacheStream(tmdbId, type, season, episode, {
          url: data.url,
          filename: data.filename,
          size: data.size,
          metadata: data.metadata,
        }, audioPref);
        setState({ status: 'ready', url: data.url, filename: data.filename, size: data.size, metadata: data.metadata });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setState({ status: 'error', message: err.message || 'Erro desconhecido ao conectar ao servidor' });
    }
  }, [tmdbId, type, season, episode, audioPref, preloadedStream]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { state, fetchStream };
}

type SkipData = {
  introStart: number;
  introEnd: number;
  recapStart?: number;
  recapEnd?: number;
  creditsOffset: number;
};

function useSkipTimestamps(tmdbId: string, type: string, season?: string | null, episode?: string | null, durationMs?: number) {
  const [skipData, setSkipData] = useState<SkipData | null>(null);

  useEffect(() => {
    if (!durationMs) return;
    if (type === 'tv' && (!season || !episode)) return;
    
    const apiBase = import.meta.env.VITE_BACKEND_URL || '';
    let url = `${apiBase}/api/skip/${tmdbId}?type=${type}&duration_ms=${Math.floor(durationMs)}`;
    if (type === 'tv') {
      url += `&season=${season}&episode=${episode}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSkipData(data);
        }
      })
      .catch(err => console.error('Failed to fetch skip data:', err));
  }, [tmdbId, type, season, episode, durationMs]);

  return skipData;
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const LANG_MAP: Record<string, string> = {
  'portuguese (br)': 'Português (Brasil)',
  'portuguese': 'Português (Portugal)',
  'english': 'English',
  'spanish': 'Español',
  'spanish (la)': 'Español (Latino)',
  'french': 'Français',
  'german': 'Deutsch',
  'italian': 'Italiano',
  'japanese': '日本語',
  'korean': '한국어',
  'chinese': '中文',
  'russian': 'Русский',
  'arabic': 'العربية',
  'dutch': 'Nederlands',
  'polish': 'Polski',
  'turkish': 'Türkçe',
  'swedish': 'Svenska',
  'danish': 'Dansk',
  'norwegian': 'Norsk',
  'finnish': 'Suomi',
  'greek': 'Ελληνικά',
  'hebrew': 'עברית',
  'hindi': 'हिन्दी',
  'thai': 'ไทย',
  'romanian': 'Română',
  'hungarian': 'Magyar',
  'czech': 'Čeština',
  'indonesian': 'Bahasa Indonesia',
  'vietnamese': 'Tiếng Việt',
  // Abbreviations (OpenSubtitles often returns 3-letter codes)
  'eng': 'English',
  'en': 'English',
  'por': 'Português',
  'pob': 'Português (Brasil)',
  'pt-br': 'Português (Brasil)',
  'pt': 'Português (Portugal)',
  'spa': 'Español',
  'es': 'Español',
  'fre': 'Français',
  'fra': 'Français',
  'fr': 'Français',
  'ger': 'Deutsch',
  'deu': 'Deutsch',
  'de': 'Deutsch',
  'ita': 'Italiano',
  'it': 'Italiano',
  'jpn': '日本語',
  'ja': '日本語',
  'kor': '한국어',
  'ko': '한국어',
  'chi': '中文',
  'zho': '中文',
  'zh': '中文',
  'rus': 'Русский',
  'ru': 'Русский'
};

const getNativeLangName = (lang: string) => {
  if (!lang) return 'Desconhecido';
  const l = lang.toLowerCase().trim();
  if (LANG_MAP[l]) return LANG_MAP[l];
  // capitalize first letter
  return lang.charAt(0).toUpperCase() + lang.slice(1);
};

const NetflixRewind10 = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <g transform="scale(-1, 1) translate(-24, 0)">
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.063 6.063 1.25 12 1.25a.75.75 0 0 1 .586 1.219l-2 2.5a.75.75 0 0 1-1.172-.938l.903-1.128A9.251 9.251 0 0 0 2.75 12A9.25 9.25 0 1 0 15.7 3.52a.75.75 0 0 1 .6-1.375A10.752 10.752 0 0 1 22.75 12c0 5.937-4.813 10.75-10.75 10.75S1.25 17.937 1.25 12Z" />
    </g>
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M10.325 7.824a.75.75 0 0 1 .425.676v7a.75.75 0 0 1-1.5 0v-5.44l-1.281 1.026a.75.75 0 0 1-.938-1.172l2.5-2a.75.75 0 0 1 .794-.09ZM14.25 9.25a1 1 0 0 0-1 1v3.5a1 1 0 1 0 2 0v-3.5a1 1 0 0 0-1-1ZM11.75 10.25a2.5 2.5 0 0 1 5 0v3.5a2.5 2.5 0 0 1-5 0v-3.5Z" />
  </svg>
);

const NetflixForward10 = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.063 6.063 1.25 12 1.25a.75.75 0 0 1 .586 1.219l-2 2.5a.75.75 0 0 1-1.172-.938l.903-1.128A9.251 9.251 0 0 0 2.75 12A9.25 9.25 0 1 0 15.7 3.52a.75.75 0 0 1 .6-1.375A10.752 10.752 0 0 1 22.75 12c0 5.937-4.813 10.75-10.75 10.75S1.25 17.937 1.25 12Zm9.075-4.176a.75.75 0 0 1 .425.676v7a.75.75 0 0 1-1.5 0v-5.44l-1.281 1.026a.75.75 0 0 1-.938-1.172l2.5-2a.75.75 0 0 1 .794-.09ZM14.25 9.25a1 1 0 0 0-1 1v3.5a1 1 0 1 0 2 0v-3.5a1 1 0 0 0-1-1Zm-2.5 1a2.5 2.5 0 0 1 5 0v3.5a2.5 2.5 0 0 1-5 0v-3.5Z" />
  </svg>
);

const NetflixPlay = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 36 36" className={className} fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
    <path d="M 13.5 10.5 L 25.5 18 L 13.5 25.5 Z" />
  </svg>
);

const NetflixPause = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 36 36" className={className} fill="currentColor">
    <rect x="10.5" y="8" width="5" height="20" rx="1.5" />
    <rect x="20.5" y="8" width="5" height="20" rx="1.5" />
  </svg>
);

function StremioLoader({ isExiting, onExited, solidBg = true }: { isExiting: boolean; onExited?: () => void; solidBg?: boolean }) {
  const text = "Stremio";
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isExiting) {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(prev => prev.slice(0, -1));
        }, 30); // fast delete
      } else {
        timeout = setTimeout(() => {
          if (onExited) onExited();
        }, 100);
      }
      return () => clearTimeout(timeout);
    }
    
    // Normal loop
    if (!isDeleting && displayText.length < text.length) {
      timeout = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length + 1));
      }, 150);
    } else if (!isDeleting && displayText.length === text.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 1200);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => {
        setDisplayText(prev => prev.slice(0, -1));
      }, 60);
    } else if (isDeleting && displayText.length === 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false);
      }, 400);
    }
    
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, isExiting, onExited]);

  const isStoppedAtEnd = !isDeleting && displayText.length === text.length && !isExiting;

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-[60] ${solidBg ? 'bg-[#0a0a0c]' : 'bg-black/60 backdrop-blur-sm'}`}>
      <style>{`
        @keyframes fullPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-full-pulse {
          animation: fullPulse 1.2s ease-in-out infinite;
        }
      `}</style>
      <div 
        className="flex items-center text-2xl md:text-3xl text-white/90"
        style={{ fontFamily: '"Rekalgera-Regular", "Rekalgera", sans-serif' }}
      >
        {displayText}
        <span className={`w-[2px] h-6 md:h-8 bg-white/40 ml-1 ${isStoppedAtEnd ? 'animate-full-pulse' : 'opacity-100'}`}></span>
      </div>
    </div>
  );
}

function CustomVideoPlayer({ src, filename, metadata, tmdbId, type, season, episode, isHidden, onClose, audioPref, setAudioPref, hasAltAudio }: { src: string; filename?: string; metadata?: any; tmdbId: string; type: string; season?: string | null; episode?: string | null; isHidden?: boolean; onClose?: () => void; audioPref: 'en'|'pt-br'; setAudioPref: (val: 'en'|'pt-br') => void; hasAltAudio?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressKey = type === 'tv' && season && episode ? `stremio_progress_${tmdbId}_S${season}E${episode}` : `stremio_progress_${tmdbId}`;

  // ─── Crash-proof progress persistence ──────────────────────────
  // WHY: A ref holds the latest playback snapshot so that flush
  // functions called from event listeners (beforeunload, pagehide,
  // visibilitychange) never read stale state from closures.
  const progressSnapshotRef = useRef<{ currentTime: number; duration: number; title: string; backdropPath: string; episodeTitle?: string } | null>(null);
  
  const [isInitialLoaderDone, setIsInitialLoaderDone] = useState(false);
  const [initialLoaderExiting, setInitialLoaderExiting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false); // Do not buffer initially, allow clean black screen transition
  const [showLoaderUI, setShowLoaderUI] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');
  
  const [metaTitle, setMetaTitle] = useState('');
  const [metaSynopsis, setMetaSynopsis] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [metaDetails, setMetaDetails] = useState<any>(null);
  const [episodeTitle, setEpisodeTitle] = useState<string | null>(null);

  const [canShowControls, setCanShowControls] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  
  useEffect(() => {
    if (!showControls) {
      setShowInfoPanel(false);
    }
  }, [showControls]);

  const durationMs = duration > 0 ? duration * 1000 : undefined;
  const skipData = useSkipTimestamps(tmdbId, type, season, episode, durationMs);
  const [showIntroSkip, setShowIntroSkip] = useState(false);
  const [showRecapSkip, setShowRecapSkip] = useState(false);
  const [showNextEpisodePopup, setShowNextEpisodePopup] = useState(false);
  const [dismissedAutoPlay, setDismissedAutoPlay] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isHidden) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isHidden]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isBuffering && isInitialLoaderDone) {
      t = setTimeout(() => setShowLoaderUI(true), 500);
    } else {
      setShowLoaderUI(false);
    }
    return () => clearTimeout(t);
  }, [isBuffering, isInitialLoaderDone]);

  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [expandedLang, setExpandedLang] = useState<string | null>(null);
  const [autoPlayProgress, setAutoPlayProgress] = useState(0);
  const [preloadedNextStream, setPreloadedNextStream] = useState<any>(null);
  const isPreloadingRef = useRef(false);
  const preloadedStreamRef = useRef<any>(null);
  const navigate = useNavigate();

  const [subtitles, setSubtitles] = useState<{id: string, url: string, lang: string, label: string}[]>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showEpisodesMenu, setShowEpisodesMenu] = useState(false);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);

  useEffect(() => {
    if (type === 'tv' && tmdbId && season) {
      fetchSeasonDetails(tmdbId, Number(season)).then(data => {
        if (data && data.episodes) {
          setSeasonEpisodes(data.episodes);
        }
      });
    }
  }, [tmdbId, type, season]);

  const [subtitleBlobs, setSubtitleBlobs] = useState<Record<string, string>>({});
  const [activeSubtitleCues, setActiveSubtitleCues] = useState<{ start: number, end: number, text: string }[]>([]);
  const [activeCueText, setActiveCueText] = useState<string>('');

  useEffect(() => {
    if (!tmdbId || !type) return;
    const apiBase = import.meta.env.VITE_BACKEND_URL || '';
    let url = `${apiBase}/api/subtitles/list/${tmdbId}?type=${type}`;
    if (type === 'tv' && season && episode) {
      url += `&season=${season}&episode=${episode}`;
    }
    if (filename) {
      url += `&filename=${encodeURIComponent(filename)}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSubtitles(data);
          const pt = data.find((s: any) => {
            const l = s.lang.toLowerCase();
            return l === 'por' || l === 'pob' || l.includes('portuguese') || l.includes('pt-br');
          });
          if (pt) {
            setActiveSubtitleId(pt.id);
          } else {
            setActiveSubtitleId(data[0].id);
          }
        }
      })
      .catch(err => console.error('Failed to fetch subtitles', err));
  }, [tmdbId, type, season, episode]);

  // Obsolete Blob URL useEffect removed

  useEffect(() => {
    if (!activeSubtitleId || subtitleBlobs[activeSubtitleId]) {
      if (!activeSubtitleId) {
        setActiveSubtitleCues([]);
        setActiveCueText('');
      }
      return;
    }
    
    const sub = subtitles.find(s => s.id === activeSubtitleId);
    if (!sub) return;

    const apiBase = import.meta.env.VITE_BACKEND_URL || '';
    const url = `${apiBase}/api/subtitles/proxy?url=${encodeURIComponent(sub.url)}`;

    fetch(url)
      .then(res => res.text())
      .then(vtt => {
        const cues: { start: number, end: number, text: string }[] = [];
        const blocks = vtt.split('\n\n');
        for (const block of blocks) {
          const lines = block.split('\n');
          const timeLineIndex = lines.findIndex(l => l.includes('-->'));
          if (timeLineIndex !== -1) {
            const timeLine = lines[timeLineIndex];
            const [startStr, endStr] = timeLine.split(' --> ');
            
            const parseTime = (t: string) => {
              if (!t) return 0;
              const parts = t.trim().split(':');
              let sec = 0;
              if (parts.length === 3) {
                sec += parseInt(parts[0], 10) * 3600;
                sec += parseInt(parts[1], 10) * 60;
                const sParts = parts[2].split('.');
                sec += parseInt(sParts[0], 10);
                if (sParts[1]) sec += parseInt(sParts[1], 10) / 1000;
              }
              return sec;
            };

            const text = lines.slice(timeLineIndex + 1).join('\n');
            const lowerText = text.toLowerCase();
            
            // Filtro Anti-Ads (Limpeza Cinematográfica)
            const isAd = lowerText.includes('opensubtitles') || 
                         lowerText.includes('yts.') || 
                         lowerText.includes('yify') || 
                         lowerText.includes('osdb.link') ||
                         lowerText.includes('subtitles downloaded from') ||
                         lowerText.includes('1xbet') ||
                         lowerText.includes('betano');

            if (!isAd && text.trim().length > 0) {
              cues.push({
                start: parseTime(startStr),
                end: parseTime(endStr),
                text: text
              });
            }
          }
        }
        setActiveSubtitleCues(cues);
        setSubtitleBlobs(prev => ({ ...prev, [activeSubtitleId]: url })); // mark as loaded
      });
  }, [activeSubtitleId, subtitles, subtitleBlobs]);

  // Track mode is now handled in the onLoad event of the <track> element

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    preloadedStreamRef.current = preloadedNextStream;
  }, [preloadedNextStream]);

  useEffect(() => {
    if (!showNextEpisodePopup) return;
    
    const duration = 10000;
    const intervalTime = 50;
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      currentProgress += (intervalTime / duration) * 100;
      if (currentProgress >= 100) {
        clearInterval(interval);
        const nextEp = parseInt(episode || '1') + 1;
        navigate(`/player/${tmdbId}?type=tv&season=${season}&episode=${nextEp}`, {
          state: { preloadedStream: preloadedStreamRef.current },
          replace: true
        });
      } else {
        setAutoPlayProgress(currentProgress);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [showNextEpisodePopup, navigate, tmdbId, season, episode]);

  // Arbitrary 5s timer removed. Controls will be enabled onCanPlay.

  // ─── Persistent flush: interval + browser lifecycle events ─────
  // Belt-and-suspenders approach: writes every 10s AND on every
  // possible browser exit vector (beforeunload, pagehide, visibilitychange).
  const flushProgress = useCallback(() => {
    const snap = progressSnapshotRef.current;
    if (!snap || snap.duration <= 0 || !Number.isFinite(snap.duration) || snap.currentTime <= 0) return;

    const pct = (snap.currentTime / snap.duration) * 100;
    if (isNaN(pct) || pct < 0) return;

    saveProgress({
      tmdbId,
      type: type as 'movie' | 'tv',
      title: snap.title,
      backdropPath: snap.backdropPath,
      currentTime: snap.currentTime,
      duration: snap.duration,
      progress: pct,
      season: season ? parseInt(season) : undefined,
      episode: episode ? parseInt(episode) : undefined,
      episodeTitle: snap.episodeTitle,
      lastWatchedAt: Date.now(),
    });

    // ─── Trakt Scrobbling (Pause/Stop) ───
    const traktToken = useStore.getState().traktAccessToken;
    if (traktToken && pct > 0) {
      const action = pct >= 90 ? 'stop' : 'pause';
      scrobbleToTrakt(traktToken, action, {
        tmdbId,
        type: type as 'movie' | 'tv',
        progress: pct,
        season: season ? parseInt(season) : undefined,
        episode: episode ? parseInt(episode) : undefined
      }).catch(() => {});
    }

    // Legacy key for same-session resume
    localStorage.setItem(progressKey, snap.currentTime.toString());
  }, [tmdbId, type, season, episode, progressKey]);

  useEffect(() => {
    // Interval: worst-case 10s of lost progress
    const intervalId = setInterval(flushProgress, 10_000);

    // Browser exit vectors
    const handleBeforeUnload = () => flushProgress();
    const handlePageHide = () => flushProgress();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Final flush on React unmount (normal navigation)
      flushProgress();
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushProgress]);



  useEffect(() => {
    fetchDetails(tmdbId, type as 'movie' | 'tv').then(data => {
      if (data) {
        setMetaDetails(data);
        if (type === 'tv') {
          setMetaTitle(data.name || '');
          if (season && episode) {
            import('../services/tmdb').then(m => m.fetchEpisodeDetails(tmdbId, parseInt(season), parseInt(episode)))
              .then(epData => {
                if (epData) {
                  setEpisodeTitle(epData.name || `Episode ${episode}`);
                  setMetaSynopsis(epData.overview || data.overview || '');
                } else {
                  setEpisodeTitle(`Episode ${episode}`);
                  setMetaSynopsis(data.overview || '');
                }
              });
          } else {
            setMetaSynopsis(data.overview || '');
          }
        } else {
          setMetaTitle(data.title || '');
          setMetaSynopsis(data.overview || '');
        }
      }
    }).catch(console.error);

    fetchLogo(tmdbId, type as 'movie' | 'tv').then(path => {
      if (path) setLogoUrl(getImageUrl(path, 'w500'));
    });
  }, [tmdbId, type]);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = () => {
    if (!canShowControls) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSubtitlesMenu(false);
        setExpandedLang(null);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    
    if (video.getAttribute('src') !== src) {
      const wasPlaying = !video.paused;
      const cTime = video.currentTime > 0 ? video.currentTime : (progressSnapshotRef.current?.currentTime || 0);
      
      video.setAttribute('src', src);
      video.load();
      
      const onLoaded = () => {
        video.currentTime = cTime;
        if (wasPlaying || userIntentPlay.current) {
          video.play().catch(()=>{});
        }
        video.removeEventListener('loadedmetadata', onLoaded);
      };
      video.addEventListener('loadedmetadata', onLoaded);
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  const userIntentPlay = useRef(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      userIntentPlay.current = true;
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError') console.error(err);
      });
    } else {
      userIntentPlay.current = false;
      videoRef.current.pause();
    }
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += seconds;
    if (userIntentPlay.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = Number(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (userIntentPlay.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.readyState === 0) {
      console.warn("Vídeo ainda não carregou os metadados");
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP not supported or failed", err);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };


  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 w-screen h-screen bg-black z-50 overflow-hidden group select-none ${!showControls ? 'cursor-none' : ''} transition-opacity duration-1000 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setShowControls(false);
          setShowSubtitlesMenu(false);
          setShowEpisodesMenu(false);
          setExpandedLang(null);
        }
      }}
    >
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-[70] text-white">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Erro ao carregar o vídeo</h2>
          <p className="text-white/60">O formato do arquivo pode não ser suportado nativamente pelo navegador.</p>
        </div>
      )}

      {!isInitialLoaderDone && !hasError && (
        <StremioLoader 
          isExiting={initialLoaderExiting}
          onExited={() => {
            setIsInitialLoaderDone(true);
            setIsReadyToPlay(true);
            setCanShowControls(true);
          }}
        />
      )}

      {showLoaderUI && !hasError && isInitialLoaderDone && (
        <StremioLoader isExiting={false} solidBg={false} />
      )}

      {src && (
        <video
          ref={videoRef}
          src={src}
          autoPlay={!isHidden}
          playsInline
          preload="auto"
          className={`w-full h-full object-${videoFit} transition-opacity duration-1000 ${isReadyToPlay ? 'opacity-100' : 'opacity-0'}`}
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedData={() => setIsBuffering(false)}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            setDuration(dur);

            // Restore from new progress service first, fallback to legacy key
            const saved = getProgress(tmdbId, type, season, episode);
            if (saved && saved.currentTime > 0) {
              e.currentTarget.currentTime = saved.currentTime;
            } else {
              const legacyTime = localStorage.getItem(progressKey);
              if (legacyTime) {
                e.currentTarget.currentTime = parseFloat(legacyTime);
              }
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={(e) => {
            if (!isInitialLoaderDone) setInitialLoaderExiting(true);
            if (isInitialLoaderDone) setIsReadyToPlay(true);
            setIsBuffering(false);
            const traktToken = useStore.getState().traktAccessToken;
            const dur = e.currentTarget.duration;
            const time = e.currentTarget.currentTime;
            
            if (traktToken) {
              let pct = 0;
              if (dur > 0 && Number.isFinite(dur)) {
                pct = (time / dur) * 100;
              }
              
              scrobbleToTrakt(traktToken, 'start', {
                tmdbId,
                type: type as 'movie' | 'tv',
                progress: pct,
                season: season ? parseInt(season) : undefined,
                episode: episode ? parseInt(episode) : undefined
              }).catch(() => {});
            }
          }}
          onCanPlay={() => {
            if (!isInitialLoaderDone) setInitialLoaderExiting(true);
            if (isInitialLoaderDone) {
              setIsReadyToPlay(true);
              setCanShowControls(true);
            }
            setIsBuffering(false);
          }}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            const dur = e.currentTarget.duration;
            setCurrentTime(time);

            // Update the ref snapshot — this is what flushProgress reads
            progressSnapshotRef.current = {
              currentTime: time,
              duration: dur,
              title: metaTitle || '',
              backdropPath: metaDetails?.backdrop_path || '',
              episodeTitle: episodeTitle || undefined,
            };

            // Custom Subtitles Engine
            if (activeSubtitleCues.length > 0) {
              const adjustedTime = time - subtitleDelay;
              const currentCue = activeSubtitleCues.find(c => adjustedTime >= c.start && adjustedTime <= c.end);
              if (currentCue && currentCue.text !== activeCueText) {
                setActiveCueText(currentCue.text);
              } else if (!currentCue && activeCueText !== '') {
                setActiveCueText('');
              }
            } else if (activeCueText !== '') {
              setActiveCueText('');
            }

            if (skipData) {
              if (skipData.introStart >= 0 && time >= skipData.introStart && time < skipData.introEnd) {
                setShowIntroSkip(true);
              } else {
                setShowIntroSkip(false);
              }

              if (skipData.recapStart !== undefined && skipData.recapStart >= 0 && time >= skipData.recapStart && time < (skipData.recapEnd || 0)) {
                setShowRecapSkip(true);
              } else {
                setShowRecapSkip(false);
              }

              const dur = e.currentTarget.duration;
              if (type === 'tv' && dur > 0) {
                const preloadTrigger = Math.max(0, Math.min(dur * 0.8, dur - 300));
                
                if (time >= preloadTrigger && !preloadedNextStream && !isPreloadingRef.current) {
                  isPreloadingRef.current = true;
                  const nextEp = parseInt(episode || '1') + 1;
                  const apiBase = import.meta.env.VITE_BACKEND_URL || '';
                  
                  const pollPreload = () => {
                    fetch(`${apiBase}/api/stream/${tmdbId}?type=tv&season=${season}&episode=${nextEp}`)
                      .then(res => res.ok ? res.json() : null)
                      .then(data => {
                        if (data && data.url) {
                          setPreloadedNextStream(data);
                          // Also cache for future sessions
                          cacheStream(tmdbId, 'tv', season, String(nextEp), {
                            url: data.url,
                            filename: data.filename,
                            size: data.size,
                            metadata: data.metadata,
                          });
                        } else if (data && data.status === 'downloading') {
                          setTimeout(pollPreload, 3000);
                        }
                      })
                      .catch(() => {
                         setTimeout(pollPreload, 10000);
                      });
                  };
                  pollPreload();
                }

                if (skipData && skipData.creditsOffset > 0) {
                  const creditsStart = dur - skipData.creditsOffset;
                  if (time >= creditsStart && !dismissedAutoPlay && !showNextEpisodePopup) {
                    setShowNextEpisodePopup(true);
                  }
                }
              }
            }
          }}
          onEnded={() => {
            if (!showNextEpisodePopup) {
              setIsExiting(true);
              flushProgress();
              setTimeout(() => {
                navigate(-1);
              }, 1000);
            }
          }}
          onError={() => setHasError(true)}
        />
      )}

      {activeCueText && isPlaying && (
        <div className="absolute bottom-[10%] left-0 right-0 flex justify-center pointer-events-none z-[45]">
          <div 
            className="text-white text-[2.1rem] font-normal text-center px-4 leading-snug tracking-wide"
            style={{ 
              fontFamily: "'NetflixSans', 'Inter', sans-serif",
              textShadow: '0px 2px 6px rgba(0,0,0,0.7), 0px 0px 3px rgba(0,0,0,0.6), 1px 1px 2px rgba(0,0,0,0.5)'
            }}
            dangerouslySetInnerHTML={{ __html: activeCueText.replace(/\n/g, '<br/>') }}
          />
        </div>
      )}

      {showIntroSkip && skipData && (
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (videoRef.current) videoRef.current.currentTime = skipData.introEnd + 0.5; 
            setShowIntroSkip(false); 
          }}
          className="absolute bottom-36 right-12 z-[60] px-8 py-3 bg-black/60 hover:bg-white text-white hover:text-black border border-white/20 backdrop-blur-xl font-bold tracking-wider rounded text-lg transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        >
          Pular Abertura
        </button>
      )}

      {showRecapSkip && skipData && skipData.recapEnd && (
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (videoRef.current) videoRef.current.currentTime = skipData.recapEnd + 0.5; 
            setShowRecapSkip(false); 
          }}
          className="absolute bottom-36 right-12 z-[60] px-8 py-3 bg-black/60 hover:bg-white text-white hover:text-black border border-white/20 backdrop-blur-xl font-bold tracking-wider rounded text-lg transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        >
          Pular Resumo
        </button>
      )}

      {showNextEpisodePopup && (
        <div className="absolute bottom-36 right-12 z-[60] flex items-center gap-4 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setDismissedAutoPlay(true);
              setShowNextEpisodePopup(false);
            }}
            className="px-6 py-3 bg-[#333333] hover:bg-[#444444] text-white font-bold tracking-wider text-sm md:text-base rounded transition-colors"
          >
            Assista aos créditos
          </button>
          
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              const nextEp = parseInt(episode || '1') + 1;
              navigate(`/player/${tmdbId}?type=tv&season=${season}&episode=${nextEp}`, {
                state: { preloadedStream: preloadedStreamRef.current },
                replace: true
              });
            }}
            className="relative px-6 py-3 bg-[#b3b3b3] text-black font-bold tracking-wider text-sm md:text-base overflow-hidden rounded group flex items-center gap-2"
          >
            <div 
              className="absolute top-0 left-0 bottom-0 bg-white transition-all ease-linear"
              style={{ width: `${autoPlayProgress}%` }}
            />
            <span className="relative z-10 flex items-center gap-2 group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 fill-current" />
              Próximo episódio
            </span>
          </button>
        </div>
      )}

      <div 
        className={`absolute inset-0 pointer-events-none flex flex-col justify-between transition-opacity duration-500 bg-gradient-to-t from-black/90 via-transparent to-black/60 ${showControls && !showEpisodesMenu ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="w-full p-8 pointer-events-auto flex items-start justify-between">
          <button onClick={() => { 
            if (document.fullscreenElement) document.exitFullscreen(); 
            flushProgress(); // Force flush before navigation to prevent race condition
            onClose ? onClose() : navigate(-1); 
          }} className="text-white hover:scale-110 transition-transform p-2 rounded-full">
            <ArrowLeft className="w-8 h-8" />
          </button>

          {metadata && (
            <div className="relative pointer-events-auto z-[100]">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowInfoPanel(!showInfoPanel); handleMouseMove(); }}
                className={`text-white p-2 rounded-full transition-all duration-300 ${showInfoPanel ? 'bg-white/20 scale-110' : 'hover:scale-110'}`}
              >
                <Info className="w-8 h-8" />
              </button>
              
              <AnimatePresence>
                {showInfoPanel && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-14 right-0 w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-2xl z-50 flex flex-col gap-3 text-sm text-gray-200"
                  >
                    <div className="font-bold text-white text-base mb-1 border-b border-white/20 pb-2 break-all line-clamp-2">
                      {metadata.name}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-semibold uppercase text-xs tracking-widest">Resolução</span>
                      <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white">{metadata.quality}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-semibold uppercase text-xs tracking-widest">Áudio</span>
                      <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white">{metadata.audio}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-semibold uppercase text-xs tracking-widest">Provedor</span>
                      <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white">{metadata.scraper}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-semibold uppercase text-xs tracking-widest">Servidor</span>
                      <span className={`font-mono px-2 py-0.5 rounded border ${metadata.debrid === 'Real-Debrid' ? 'bg-blue-600/30 text-blue-100 border-blue-500/50' : 'bg-green-600/30 text-green-100 border-green-500/50'}`}>{metadata.debrid}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {!isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="flex items-center gap-16 md:gap-28 pointer-events-auto mt-4">
              <button 
                onClick={(e) => { e.stopPropagation(); seekRelative(-10); handleMouseMove(); }} 
                className="text-white hover:text-white hover:scale-110 active:scale-90 active:opacity-75 transition-all p-3 rounded-full"
              >
                <NetflixRewind10 className="w-12 h-12 md:w-14 md:h-14" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); handleMouseMove(); }} 
                className="flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
              >
                {isPlaying ? <NetflixPause className="w-[5.5rem] h-[5.5rem] md:w-[7rem] md:h-[7rem]" /> : <NetflixPlay className="w-[5.5rem] h-[5.5rem] md:w-[7rem] md:h-[7rem]" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); seekRelative(10); handleMouseMove(); }} 
                className="text-white hover:text-white hover:scale-110 active:scale-90 active:opacity-75 transition-all p-3 rounded-full"
              >
                <NetflixForward10 className="w-12 h-12 md:w-14 md:h-14" />
              </button>
            </div>
          </div>
        )}

        <div className="w-full px-12 pb-10 pt-20 pointer-events-auto flex flex-col gap-6 z-10">
          <div className="flex flex-col gap-3 text-white max-w-4xl">
            {logoUrl ? (
              <img src={logoUrl} alt={metaTitle} className="h-20 md:h-24 object-contain object-left mb-1 drop-shadow-lg filter brightness-0 invert" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
            ) : (
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-md mb-1">{metaTitle || 'Carregando...'}</h1>
            )}

            {type === 'tv' && episodeTitle && (
              <h2 className="text-xl md:text-2xl font-semibold text-white/90 drop-shadow-md tracking-wide">
                S{season} E{episode} &quot;{episodeTitle}&quot;
              </h2>
            )}
            
            {metaDetails && (
              <div className="flex items-center flex-wrap gap-2 text-sm text-gray-300 font-medium mb-1">
                {type === 'tv' ? (
                  <>
                    <span className="text-white font-bold">{metaDetails.first_air_date?.split('-')[0]}</span>
                    <span className="w-1 h-1 bg-gray-500 rounded-full" />
                    <span>{metaDetails.number_of_seasons} Season{metaDetails.number_of_seasons > 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <>
                    <span className="text-white font-bold">{metaDetails.release_date?.split('-')[0]}</span>
                    <span className="w-1 h-1 bg-gray-500 rounded-full" />
                    <span>{metaDetails.genres?.[0]?.name}</span>
                    {metaDetails.credits?.crew?.find((c: any) => c.job === 'Director') && (
                      <>
                        <span className="w-1 h-1 bg-gray-500 rounded-full" />
                        <span>Directed by {metaDetails.credits.crew.find((c: any) => c.job === 'Director').name}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            
            <AnimatePresence>
              {!isPlaying && metaSynopsis && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <p className="text-base md:text-lg text-white/90 font-medium tracking-wide line-clamp-4 leading-relaxed drop-shadow-md max-w-3xl mt-2">
                    {metaSynopsis}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-6 text-white font-medium tracking-wide w-full">
            <span className="w-16 text-left text-sm text-white/80">{formatTime(currentTime)}</span>
            <div 
              className="relative flex-1 h-8 group/slider flex items-center cursor-pointer"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverTime(percent * duration);
                setHoverX(percent * 100);
              }}
              onMouseLeave={() => setHoverTime(null)}
            >
              <input 
                type="range" 
                min={0} 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-white/20 rounded-full overflow-hidden transition-all group-hover/slider:h-2 pointer-events-none">
                <div 
                  className="h-full bg-red-600" 
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} 
                />
              </div>
              
              {/* Hover Tooltip */}
              {hoverTime !== null && (
                <div 
                  className="absolute -top-8 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-xs font-bold tracking-wider text-white whitespace-nowrap z-10 pointer-events-none"
                  style={{ left: `calc(${hoverX}% - 20px)` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}

              {/* Current Time Dot */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)] opacity-0 group-hover/slider:opacity-100 transition-opacity z-20 pointer-events-none flex flex-col items-center justify-center"
                style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }}
              >
              </div>
            </div>
            <span className="w-16 text-right text-sm text-white/80">{formatTime(duration - currentTime)}</span>
            
            <div className="flex items-center gap-5 ml-4 text-white">
              <div className="flex items-center group/volume relative">
                <button onClick={toggleMute} className="hover:scale-110 transition-transform opacity-70 hover:opacity-100">
                  {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
                <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300 ease-in-out flex items-center origin-left h-8">
                  <div className="relative w-[60px] ml-2 h-8 cursor-pointer flex items-center group/volumebar">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={isMuted ? 0 : volume} 
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {/* Background track */}
                    <div className="absolute left-0 right-0 h-1.5 bg-white/30 rounded-full pointer-events-none" />
                    {/* Fill track */}
                    <div 
                      className="absolute left-0 h-1.5 bg-red-600 rounded-full pointer-events-none" 
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} 
                    />
                    <div 
                      className="absolute w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/volumebar:opacity-100 transition-opacity z-20 pointer-events-none"
                      style={{ left: `calc(${(isMuted ? 0 : volume) * 100}% - 6px)` }}
                    >
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setVideoFit(prev => prev === 'contain' ? 'cover' : 'contain')} 
                className="relative hover:scale-110 transition-transform opacity-70 hover:opacity-100 group/fit"
              >
                <Monitor className="w-6 h-6" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs opacity-0 group-hover/fit:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                  {videoFit === 'contain' ? 'Preencher Tela' : 'Modo Original'}
                </span>
              </button>
              {type === 'tv' && (
                <div className="relative group/episodes">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowEpisodesMenu(!showEpisodesMenu); setShowSubtitlesMenu(false); setShowAudioMenu(false); handleMouseMove(); }} 
                    className="hover:scale-110 transition-transform opacity-70 hover:opacity-100"
                  >
                    <ListVideo className="w-6 h-6" />
                  </button>
                </div>
              )}
              {/* Audio Menu - Only show if alternative audio is available */}
              {hasAltAudio && (
                <div className="relative group/audio">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowAudioMenu(!showAudioMenu); setShowSubtitlesMenu(false); setShowEpisodesMenu(false); handleMouseMove(); }} 
                    className="hover:scale-110 transition-transform opacity-70 hover:opacity-100 flex items-center gap-1 border border-white/30 rounded px-2 py-0.5"
                  >
                    <span className="font-bold text-xs tracking-wider uppercase">{audioPref === 'en' ? 'EN' : 'PT'}</span>
                  </button>
                  {showAudioMenu && (
                    <div className="absolute bottom-full right-0 mb-4 bg-[#0a0a0a]/95 backdrop-blur-2xl rounded-3xl border border-white/10 p-5 min-w-[240px] shadow-2xl z-50 flex flex-col gap-2 font-['Netflix_Sans',_sans-serif]" onClick={(e) => e.stopPropagation()}>
                      <div className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 border-b border-white/10 pb-2">Faixa de Áudio (Fonte Dinâmica)</div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setAudioPref('en'); setShowAudioMenu(false); }}
                        className={`text-left px-5 py-3 text-sm rounded-full transition-colors ${audioPref === 'en' ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                      >
                        Inglês (Original)
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setAudioPref('pt-br'); setShowAudioMenu(false); }}
                        className={`text-left px-5 py-3 text-sm rounded-full transition-colors ${audioPref === 'pt-br' ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                      >
                        Português (Brasil)
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="relative group/subs">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowSubtitlesMenu(!showSubtitlesMenu); setShowEpisodesMenu(false); setShowAudioMenu(false); handleMouseMove(); }} 
                  className="hover:scale-110 transition-transform opacity-70 hover:opacity-100"
                >
                  <Captions className="w-6 h-6" />
                </button>
                {showSubtitlesMenu && (
                  <div className="absolute bottom-full right-0 mb-4 bg-[#0a0a0a]/95 backdrop-blur-2xl rounded-3xl border border-white/10 p-5 min-w-[340px] shadow-2xl z-50 flex flex-col gap-4 max-h-[60vh] overflow-hidden font-['Netflix_Sans',_sans-serif]" onClick={(e) => e.stopPropagation()}>
                    {/* Delay Controller */}
                    <div className="flex flex-col pb-4 border-b border-white/10">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Ajuste de Sincronia</span>
                        <span className="text-white font-mono text-xs bg-white/10 px-3 py-1 rounded-full">{subtitleDelay > 0 ? '+' : ''}{subtitleDelay.toFixed(1)}s</span>
                      </div>
                      <div className="flex gap-1 justify-between">
                         {[-5, -1, -0.5, 0, 0.5, 1, 5].map(val => (
                           <button 
                             key={val}
                             onClick={(e) => { e.stopPropagation(); setSubtitleDelay(val === 0 ? 0 : d => d + val); }} 
                             className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/15 text-xs rounded-full text-white/80 hover:text-white transition-colors"
                           >
                             {val > 0 ? `+${val}` : val === 0 ? '0' : val}
                           </button>
                         ))}
                      </div>
                    </div>

                    {/* Subtitles List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-2">
                    {subtitles.length === 0 ? (
                      <span className="text-white/50 text-sm py-2 text-center">Nenhuma legenda encontrada</span>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveSubtitleId(null); setShowSubtitlesMenu(false); }}
                          className={`text-left px-5 py-3 text-sm rounded-full transition-colors ${activeSubtitleId === null ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                        >
                          Desativado
                        </button>
                        {Object.entries(
                          subtitles.reduce((acc: any, sub: any) => {
                            const nativeName = getNativeLangName(sub.lang);
                            if (!acc[nativeName]) acc[nativeName] = [];
                            acc[nativeName].push(sub);
                            return acc;
                          }, {})
                        ).map(([lang, subs]: any) => (
                          <div key={lang} className="flex flex-col gap-1 mt-1">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (expandedLang === lang) {
                                  setExpandedLang(null);
                                } else {
                                  setExpandedLang(lang);
                                  if (!subs.find((s: any) => s.id === activeSubtitleId)) {
                                    setActiveSubtitleId(subs[0].id);
                                  }
                                }
                              }}
                              className={`flex items-center justify-between px-5 py-3 text-sm rounded-full transition-colors ${subs.find((s: any) => s.id === activeSubtitleId) ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                            >
                              {lang}
                              <span className="text-[10px] bg-black/40 px-2.5 py-0.5 rounded-full text-white/50">{subs.length}</span>
                            </button>
                            
                            <AnimatePresence>
                              {expandedLang === lang && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="flex flex-col gap-1 pl-4 border-l-2 border-white/5 ml-4 mt-1 overflow-hidden"
                                >
                                  {subs.map((sub: any, index: number) => (
                                    <button 
                                      key={sub.id}
                                      onClick={(e) => { e.stopPropagation(); setActiveSubtitleId(sub.id); setShowSubtitlesMenu(false); }}
                                      className={`text-left px-4 py-2.5 text-xs rounded-full transition-colors ${activeSubtitleId === sub.id ? 'text-white font-bold bg-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                    >
                                      Opção {index + 1}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </>
                    )}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={togglePiP} className="hover:scale-110 transition-transform opacity-70 hover:opacity-100">
                <PictureInPicture className="w-6 h-6" />
              </button>
              <button onClick={toggleFullscreen} className="hover:scale-110 transition-transform opacity-70 hover:opacity-100">
                <Maximize className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {showEpisodesMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[90] bg-transparent"
              onClick={(e) => { e.stopPropagation(); setShowEpisodesMenu(false); }}
              onMouseMove={(e) => e.stopPropagation()}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 w-[420px] h-full bg-[#0a0a0c]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-[100] flex flex-col font-['Netflix_Sans',_sans-serif]"
              onClick={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
            >
              <div className="px-8 py-6 flex justify-between items-center border-b border-white/10 shrink-0">
                <h3 className="text-2xl font-bold text-white">Temporada {season}</h3>
                <button onClick={() => setShowEpisodesMenu(false)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 p-6 pt-4">
                {seasonEpisodes.map(ep => {
                  const isCurrent = ep.episode_number.toString() === episode;
                  const isPast = Number(ep.episode_number) < Number(episode);
                  
                  return (
                    <button
                      key={ep.id}
                      onClick={() => {
                        if (isCurrent) return;
                        navigate(`/player/${tmdbId}?type=tv&season=${season}&episode=${ep.episode_number}`, { replace: true });
                      }}
                      className={`flex flex-col gap-3 p-4 rounded-2xl transition-colors text-left ${isCurrent ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      <div className="flex gap-4 items-center">
                        <div className={`relative w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-zinc-900 shadow-md ${isPast ? 'opacity-60' : 'opacity-100'}`}>
                          {ep.still_path ? (
                            <img src={getImageUrl(ep.still_path, 'w300')} alt={ep.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">Sem Imagem</div>
                          )}
                          {isCurrent && duration > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/30">
                              <div className="h-full bg-red-600" style={{ width: `${(currentTime / duration) * 100}%` }} />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`font-bold text-[15px] line-clamp-2 leading-tight mb-1 ${isPast ? 'text-white/50' : 'text-white'}`}>{ep.episode_number}. {ep.name}</span>
                          <span className={`text-xs font-mono ${isPast ? 'text-white/30' : 'text-white/60'}`}>{ep.runtime ? `${ep.runtime} min` : ''}</span>
                        </div>
                      </div>
                      {ep.overview && (
                        <p className={`text-xs line-clamp-2 leading-relaxed mt-1 ${isPast ? 'text-white/30' : 'text-white/70'}`}>
                          {ep.overview}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingOverlay() {
  return <StremioLoader isExiting={false} solidBg={true} />;
}

export function PlayerContent({ id, type, season, episode, location, isHidden, onClose }: any) {
  const navigate = useNavigate();
  const preloadedStream = location?.state?.preloadedStream;
  const [audioPref, setAudioPref] = useState<'en'|'pt-br'>('en');
  const [hasAltAudio, setHasAltAudio] = useState(false);

  const { state, fetchStream } = useStreamUrl(id, type, season, episode, audioPref, preloadedStream);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  // Background fetch alternative audio
  useEffect(() => {
    if (!id || !type || !state.url) return;
    const altLang = audioPref === 'en' ? 'pt-br' : 'en';
    const apiBase = import.meta.env.VITE_BACKEND_URL || '';
    let url = `${apiBase}/api/stream/${id}?type=${type}&lang=${altLang}&_t=${Date.now()}`;
    if (type === 'tv' && season && episode) {
      url += `&season=${season}&episode=${episode}`;
    }
    fetch(url).then(r => r.json()).then(data => {
      if (data.status === 'ready') {
        cacheStream(id, type, season, episode, {
          url: data.url,
          filename: data.filename,
          size: data.size,
          metadata: data.metadata,
        }, altLang);
        
        if (data.url !== state.url) {
          setHasAltAudio(true);
        } else {
          setHasAltAudio(false);
        }
      } else {
        setHasAltAudio(false);
      }
    }).catch(()=>{ setHasAltAudio(false); });
  }, [id, type, season, episode, audioPref, state.url]);

  return (
    <motion.div 
      style={{ display: isHidden ? 'none' : 'flex' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.0, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] min-h-screen bg-black flex-col items-center justify-center"
    >
      {state.status === 'idle' || state.status === 'loading' ? (
        <>
          <button
            onClick={() => onClose ? onClose() : navigate(-1)}
            className="absolute top-8 left-8 z-50 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full cursor-pointer transition-all hover:scale-110 text-white"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
          <LoadingOverlay />
        </>
      ) : null}

      {state.status === 'error' && (
        <div className="flex flex-col items-center gap-6 text-white max-w-md text-center px-6">
          <AlertCircle className="w-16 h-16 text-[#e50914]" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Falha ao carregar</h2>
            <p className="text-white/60 text-sm leading-relaxed">{state.message}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={fetchStream} className="px-6 py-3 bg-white text-black rounded-full font-medium text-sm hover:bg-white/90 transition">
              Tentar novamente
            </button>
            <button onClick={() => onClose ? onClose() : navigate(-1)} className="px-6 py-3 border border-white/30 text-white rounded-full font-medium text-sm hover:border-white/60 transition">
              Voltar
            </button>
          </div>
        </div>
      )}

      {state.status === 'downloading' && !isHidden && (
        <div className="flex flex-col items-center justify-center gap-6 text-white z-10 w-full max-w-lg px-6 bg-black/60 p-8 rounded-2xl backdrop-blur-md border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="w-full flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Baixando Remotamente...</h2>
          </div>
          
          <div className="w-full space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-blue-400 font-bold">Real-Debrid</span>
                <span className="text-blue-400 font-bold">{state.progress}%</span>
              </div>
              <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${state.progress}%` }} 
                />
              </div>
            </div>

            {state.progressTorbox !== undefined && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-400 font-bold">TorBox</span>
                  <span className="text-green-400 font-bold">{state.progressTorbox}%</span>
                </div>
                <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500" 
                    style={{ width: `${state.progressTorbox}%` }} 
                  />
                </div>
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-400 text-center leading-relaxed">
            Os servidores ultra-rápidos estão fazendo o download deste Torrent simultaneamente.<br/>
            O vídeo começará assim que o primeiro atingir 100%.
          </p>
          {state.filename && (
            <p className="text-xs text-gray-500 font-mono mt-2 text-center break-all w-full line-clamp-2">
              {state.filename}
            </p>
          )}
        </div>
      )}

      {state.status === 'ready' && <CustomVideoPlayer src={state.url} filename={state.filename} metadata={state.metadata} tmdbId={id || ''} type={type} season={season} episode={episode} isHidden={isHidden} onClose={onClose} audioPref={audioPref} setAudioPref={setAudioPref} hasAltAudio={hasAltAudio} />}
    </motion.div>
  );
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const type = searchParams.get('type') || 'movie';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  const uniqueKey = `${id}-${type}-${season || ''}-${episode || ''}`;

  return <PlayerContent key={uniqueKey} id={id} type={type} season={season} episode={episode} location={location} />;
}
