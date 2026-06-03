import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import HeroBanner from '../components/media/HeroBanner';
import MediaCarousel from '../components/media/MediaCarousel';
import ContinueWatchingCarousel from '../components/media/ContinueWatchingCarousel';
import Top10Carousel from '../components/media/Top10Carousel';
import { 
  fetchTrending, 
  fetchLogo, 
  getImageUrl, 
  fetchIsNetflixOriginal, 
  fetchMDBListRatings,
  fetchNetflixOriginals,
  fetchPopularMovies,
  fetchTopRated,
  fetchActionMovies,
  fetchComedyMovies,
  fetchTrendingMovies,
  fetchTrendingSeries,
  fetchHorrorMovies,
  fetchSciFiMovies,
  fetchRomanceMovies,
  fetchAnimationMovies,
  fetchDocumentaries
} from '../services/tmdb';
import { getTraktContinueWatching } from '../services/traktAuth';
import { getLocalContinueWatching } from '../services/watchProgress';
import { getCachedStream, cacheStream } from '../services/streamCache';
import { useStore } from '../store/useStore';

const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

const enhanceHexColor = (hex: string) => {
  const r = parseInt(hex.substring(1, 3), 16) / 255;
  const g = parseInt(hex.substring(3, 5), 16) / 255;
  const b = parseInt(hex.substring(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Aumentar saturação e luminosidade para não ficar apagado
  s = Math.min(1, s * 1.5); 
  l = Math.max(0.35, Math.min(0.65, l * 1.2)); 

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
};

export default function Home() {
  const storeSetIsScrolled = useStore(state => state.setIsScrolled);
  const storeSetHeroColor = useStore(state => state.setHeroColor);
  const traktAccessToken = useStore(state => state.traktAccessToken);
  const setPageScrollY = useStore(state => state.setPageScrollY);
  const pageScrollY = useStore(state => state.pageScrollY);
  const scrollPosRef = useRef(0);
  const isRestoringRef = useRef(pageScrollY > 0);

  useEffect(() => {
    return () => {
      storeSetHeroColor(null);
      storeSetIsScrolled(false);
      storeSetIsScrolled(false);
    };
  }, [storeSetHeroColor, storeSetIsScrolled, setPageScrollY]);

  const [bgColor, setBgColor] = useState<string>('#000000');
  const [isScrolled, setIsScrolled] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [netflixOriginals, setNetflixOriginals] = useState<any[]>([]);
  const [popularMovies, setPopularMovies] = useState<any[]>([]);
  const [topRated, setTopRated] = useState<any[]>([]);
  const [actionMovies, setActionMovies] = useState<any[]>([]);
  const [comedyMovies, setComedyMovies] = useState<any[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<any[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<any[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<any[]>([]);
  const [animationMovies, setAnimationMovies] = useState<any[]>([]);
  const [documentaries, setDocumentaries] = useState<any[]>([]);
  const [top10Movies, setTop10Movies] = useState<any[]>([]);
  const [top10Series, setTop10Series] = useState<any[]>([]);
  
  const traktContinueWatching = useStore(state => state.globalTraktContinueWatching);
  const isTraktLoading = useStore(state => state.isGlobalTraktLoading);
  const setGlobalTraktContinueWatching = useStore(state => state.setGlobalTraktContinueWatching);
  const setIsGlobalTraktLoading = useStore(state => state.setIsGlobalTraktLoading);
  
  const [featured, setFeatured] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localCW, setLocalCW] = useState<any[] | null>(null);
  const isRestoring = parseInt(sessionStorage.getItem('stremio_scroll') || '0', 10) > 0 || !!useStore.getState().globalFocusedId;
  const [isHidingScroll, setIsHidingScroll] = useState(isRestoring);
  const [isSnappingDisabled, setIsSnappingDisabled] = useState(isRestoring);
  const [isTransitioning, setIsTransitioning] = useState(!isRestoring);

  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    if (isRestoring) return;
    const timer = setTimeout(() => setIsTransitioning(false), 500); // 500ms allows route transition to finish
    return () => clearTimeout(timer);
  }, [isRestoring]);


  const handleColorExtracted = useCallback((color: string) => {
    const enhanced = enhanceHexColor(color);
    setBgColor(enhanced);
    storeSetHeroColor(enhanced);
  }, [storeSetHeroColor]);

  useEffect(() => {
    let cancelled = false;

    fetchTrending().then(async (data) => {
      if (cancelled) return;
      if (data && data.length > 0) {
        setTrending(data);
        
        // Take the top 5 items for the Hero Carousel
        const top5 = data.slice(0, 5);
        setFeatured(top5); // Load immediately
        
        const enrichedTop5 = await Promise.all(
          top5.map(async (item: any) => {
            const mediaType = item.media_type || 'movie';
            try {
              const [logoPath, isOriginal, mdblistRatings] = await Promise.all([
                fetchLogo(item.id, mediaType).catch(() => null),
                fetchIsNetflixOriginal(item.id, mediaType).catch(() => false),
                fetchMDBListRatings(item.id, mediaType).catch(() => ({ imdb: null, rt: null }))
              ]);
              
              return {
                ...item,
                logoUrl: logoPath ? getImageUrl(logoPath, 'original') : null,
                isNetflixOriginal: isOriginal,
                imdbRating: mdblistRatings?.imdb || null,
                rtScore: mdblistRatings?.rt || null
              };
            } catch (err) {
              console.error("Failed to fetch featured details", err);
              return item;
            }
          })
        );
        
        if (cancelled) return;
        // Single batch update for all enriched metadata to prevent 5 rapid re-renders
        setFeatured(enrichedTop5);
      }
    });

    // Desacopla o carregamento pesado das listas secundárias
    // Isso libera a Main Thread para que a animação "Glass" do Framer Motion 
    // no FloatingNav rode a 60fps sem engasgos ao trocar de rota.
    const heavyLoadTimer = setTimeout(() => {
      Promise.all([
        fetchNetflixOriginals(),
        fetchPopularMovies(),
        fetchTopRated(),
        fetchActionMovies(),
        fetchComedyMovies(),
        fetchHorrorMovies(),
        fetchSciFiMovies(),
        fetchRomanceMovies(),
        fetchAnimationMovies(),
        fetchDocumentaries(),
        fetchTrendingMovies(),
        fetchTrendingSeries()
      ]).then(([netflix, popular, top, action, comedy, horror, scifi, romance, anim, docs, tMovies, tSeries]) => {
        if (cancelled) return;
        setNetflixOriginals(netflix);
        setPopularMovies(popular);
        setTopRated(top);
        setActionMovies(action);
        setComedyMovies(comedy);
        setHorrorMovies(horror);
        setSciFiMovies(scifi);
        setRomanceMovies(romance);
        setAnimationMovies(anim);
        setDocumentaries(docs);
        setTop10Movies(tMovies);
        setTop10Series(tSeries);
      });
    }, isRestoring ? 0 : 450);

    return () => {
      cancelled = true;
      clearTimeout(heavyLoadTimer);
    };
  }, []);

  useEffect(() => {
    // ALWAYS load local watch progress from the crash-proof registry
    getLocalContinueWatching().then(items => setLocalCW(items));

    if (traktAccessToken) {
      if (!traktContinueWatching) {
        setIsGlobalTraktLoading(true);
      }
      getTraktContinueWatching(traktAccessToken).then((data) => {
        setGlobalTraktContinueWatching(data);
        setIsGlobalTraktLoading(false);
      });
    }
  }, [traktAccessToken]);

  // ─── Stream Pre-Warming ────────────────────────────────────────
  // WHY: ContinueWatching items bypass TitleDetails, so the user
  // clicks directly into the Player. Pre-warming resolves the stream
  // URLs in the background (left-to-right = most likely to be clicked
  // first). By the time the user clicks, the URL is already cached
  // and playback starts in <200ms instead of 2-8s.
  const cwItems = useMemo(() => {
    if (!traktAccessToken || isTraktLoading || !traktContinueWatching) {
      return localCW;
    }
    
    // Merge Trakt and Local data.
    // Local data takes precedence because it updates in real-time,
    // and is already sorted by 'lastWatchedAt' descending.
    const merged: any[] = [];
    const seenTmdbIds = new Set<string>();

    // 1. Put all localCW items first
    if (localCW && localCW.length > 0) {
      for (const localItem of localCW) {
        // ID format: "cw-12345" or "cw-12345_s1e2" or just "12345"
        const tmdbId = String(localItem.id).includes('-') ? String(localItem.id).split('-')[1].split('_')[0] : String(localItem.id);
        if (!seenTmdbIds.has(tmdbId)) {
          seenTmdbIds.add(tmdbId);
          merged.push(localItem);
        }
      }
    }
    
    // 2. Append any Trakt items that we don't have local progress for
    if (traktContinueWatching && traktContinueWatching.length > 0) {
      for (const tItem of traktContinueWatching) {
        const tmdbId = String(tItem.id).includes('-') ? String(tItem.id).split('-')[1].split('_')[0] : String(tItem.id);
        if (!seenTmdbIds.has(tmdbId)) {
          seenTmdbIds.add(tmdbId);
          merged.push(tItem);
        }
      }
    }
    
    return merged;
  }, [traktAccessToken, isTraktLoading, traktContinueWatching, localCW]);

  useEffect(() => {
    if (!cwItems || cwItems.length === 0) return;

    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_BACKEND_URL || '';

    (async () => {
      for (const item of cwItems) {
        if (controller.signal.aborted) break;

        // Extract tmdbId and episode info from the CW item ID
        const rawId = String(item.id).replace(/^cw-/, '');
        const match = rawId.match(/^(\d+)-s(\d+)e(\d+)$/);
        const tmdbId = match ? match[1] : rawId;
        const itemType = item.type || 'movie';
        const season = match ? match[2] : (item.season?.toString() || null);
        const episode = match ? match[3] : (item.episode?.toString() || null);

        // Skip if already cached
        const existing = getCachedStream(tmdbId, itemType, season, episode);
        if (existing) {
          continue;
        }

        try {
          let url = `${apiBase}/api/stream/${tmdbId}?type=${itemType}&_t=${Date.now()}`;
          if (itemType === 'tv' && season && episode) {
            url += `&season=${season}&episode=${episode}`;
          }

          const res = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
          });

          if (!res.ok) continue;
          const data = await res.json();

          if (data.url && data.status !== 'downloading') {
            cacheStream(tmdbId, itemType, season, episode, {
              url: data.url,
              filename: data.filename,
              size: data.size,
              metadata: data.metadata,
            });
          }
        } catch (err: any) {
          if (err.name === 'AbortError') break;
          console.warn(`[PreWarm] Failed for ${tmdbId}:`, err.message);
        }
      }
    })();

    return () => controller.abort();
  }, [cwItems]);
  // Global Smooth Wheel Scroll for Cinematic Transitions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        
        if (!isScrolling) {
          isScrolling = true;
          const direction = Math.sign(e.deltaY);
          
          const snapPoints = Array.from(container.querySelectorAll('[data-vertical-snap="true"]')) as HTMLElement[];
          const currentScroll = container.scrollTop;
          let targetTop = currentScroll;
          
          // Calcula exatamente onde a barra de rolagem vai parar quando esse elemento "snappar"
          const getTargetScroll = (el: HTMLElement) => {
            // Utilizamos getBoundingClientRect() ao invés de offsetTop pois
            // animações do Tailwind criam novos stacking contexts que zeram o offsetTop.
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Calcula a posição global absoluta do elemento dentro do container de scroll
            const absoluteTop = container.scrollTop + (elRect.top - containerRect.top);
            // HARDCODED: scroll-mt-[108px]
            return absoluteTop - 108;
          };

          // Descobre em qual card (índice) nós estamos focados agora
          let currentIndex = 0;
          let minDiff = Infinity;
          
          snapPoints.forEach((el, index) => {
            // Verifica qual elemento está fisicamente mais próximo da nossa visão atual
            const diff = Math.abs(getTargetScroll(el) - currentScroll);
            if (diff < minDiff) {
              minDiff = diff;
              currentIndex = index;
            }
          });

          if (direction > 0) {
            // Scroll pra Baixo: Vai exatamente para o próximo índice
            const nextIndex = Math.min(currentIndex + 1, snapPoints.length - 1);
            targetTop = getTargetScroll(snapPoints[nextIndex]);
          } else {
            // Scroll pra Cima: Vai exatamente para o índice anterior
            const prevIndex = Math.max(currentIndex - 1, 0);
            targetTop = getTargetScroll(snapPoints[prevIndex]);
          }

          container.scrollTo({
            top: targetTop,
            behavior: 'smooth'
          });

          // Trava a rodinha por apenas 400ms para a física de deslize não parecer travada (input lag)
          scrollTimeout = setTimeout(() => {
            isScrolling = false;
          }, 400);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, []);
  // Auto-play the slideshow every 8 seconds (APENAS se estiver focado no HeroBanner)
  useEffect(() => {
    if (featured.length === 0 || isScrolled) return;
    
    // O timer só começa a contar se o usuário estiver vendo o banner.
    // Isso evita o UX ruim de voltar pro topo e o card trocar na mesma hora.
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featured, isScrolled]);

  const activeItem = featured[currentIndex];

  const getMetadata = (item: any) => {
    if (!item) return '';
    const genre = item.genre_ids?.[0] ? TMDB_GENRES[item.genre_ids[0]] || 'Featured' : 'Featured';
    const year = item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || '2025';
    const type = item.media_type === 'movie' ? 'Movie' : 'Series';
    
    return [genre, year, type].filter(Boolean).join(' • ');
  };

  const getHeroBackground = (item: any) => {
    if (!item || !item.backdrop_path) return '';
    if (item.backdrop_path.startsWith('http')) return item.backdrop_path;
    return getImageUrl(item.backdrop_path, 'original');
  };

  // Memoiza as listas pesadas para que mudanças de estado na Home (isScrolled, currentIndex)
  // não re-renderizem os 150+ cards das listas, o que causava "glitches" (travamentos de frames) no scroll.
  const carouselsContent = useMemo(() => {
    if (isTransitioning) {
      return <div className="w-full flex flex-col gap-2 pt-8 opacity-0"></div>;
    }

    return (
      <div className="w-full flex flex-col gap-2 animate-in fade-in duration-700 fill-mode-both">
      {trending.length > 0 ? (
         <>
            <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
              {cwItems && cwItems.length === 0 ? (
                traktAccessToken ? (
                  <div className="px-8 py-8 mb-4">
                    <h2 className="text-xl md:text-2xl font-bold mb-2 text-white/90">Continue Watching</h2>
                    <p className="text-white/50 text-sm">Nenhum conteúdo em progresso encontrado (localmente ou no Trakt).</p>
                  </div>
                ) : null
              ) : (() => {
                  // Only render carousel if there's actual data
                  if (!cwItems || cwItems.length === 0) return null;

                  return (
                    <ContinueWatchingCarousel
                      title="Continue Watching"
                      items={cwItems}
                    />
                  );
                })()}
            </div>
            {trending.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                 title="Trending Now" 
                 items={trending}
                 priority={true}
                 renderDelay={0}
                 onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
              />
            </div>
            )}

            {top10Movies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <Top10Carousel 
                   title="Top 10 Movies Today" 
                   items={top10Movies}
                   priority={true}
                   renderDelay={150}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {netflixOriginals.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Only on Netflix" 
                   items={netflixOriginals}
                   priority={true}
                   renderDelay={isRestoring ? 0 : 300}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {top10Series.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <Top10Carousel 
                   title="Top 10 Series Today" 
                   items={top10Series}
                   priority={true}
                   renderDelay={isRestoring ? 0 : 450}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {popularMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Popular Movies" 
                   items={popularMovies}
                   renderDelay={isRestoring ? 0 : 600}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {topRated.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Top Rated" 
                   items={topRated}
                   renderDelay={isRestoring ? 0 : 750}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {actionMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Action & Adventure" 
                   items={actionMovies}
                   renderDelay={isRestoring ? 0 : 900}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {comedyMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Comedies" 
                   items={comedyMovies}
                   renderDelay={isRestoring ? 0 : 1050}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {horrorMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Horror Movies" 
                   items={horrorMovies}
                   renderDelay={isRestoring ? 0 : 1200}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {sciFiMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Sci-Fi & Fantasy" 
                   items={sciFiMovies}
                   renderDelay={isRestoring ? 0 : 1350}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {romanceMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Romance" 
                   items={romanceMovies}
                   renderDelay={isRestoring ? 0 : 1500}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {animationMovies.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="Animation" 
                   items={animationMovies}
                   renderDelay={1650}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}

            {documentaries.length > 0 && (
              <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px] animate-in fade-in duration-700">
                <MediaCarousel 
                   title="True Crime Documentaries" 
                   items={documentaries}
                   renderDelay={1800}
                   onItemFocus={(item) => console.log('Focused:', item.title || item.name)}
                />
              </div>
            )}
         </>
      ) : (
         <div className="px-8 py-4 bg-white/5 rounded text-white/50 animate-pulse mx-8">
            Please add VITE_TMDB_API_KEY to your .env.local file to fetch real movies.
         </div>
      )}
      </div>
    );
  }, [
    isTransitioning,
    trending,
    top10Movies,
    netflixOriginals,
    top10Series,
    popularMovies,
    topRated,
    actionMovies,
    comedyMovies,
    horrorMovies,
    sciFiMovies,
    romanceMovies,
    animationMovies,
    documentaries,
    traktAccessToken,
    isTraktLoading,
    traktContinueWatching,
    localCW
  ]);

  // Restore vertical scroll position on mount
  useEffect(() => {
    const savedScrollY = parseInt(sessionStorage.getItem('stremio_scroll') || '0', 10);
    
    if (!containerRef.current || savedScrollY === 0) {
      setIsHidingScroll(false);
      const timeout = setTimeout(() => { 
        setIsSnappingDisabled(false);
        isRestoringRef.current = false; 
      }, 1500);
      return () => clearTimeout(timeout);
    }
    
    const tryScroll = setInterval(() => {
      // O DOM precisa ter altura suficiente (Posição Y + Altura da Janela) para o navegador fisicamente permitir o scroll
      const minRequiredHeight = savedScrollY + (containerRef.current?.clientHeight || window.innerHeight);
      
      if (containerRef.current && containerRef.current.scrollHeight >= minRequiredHeight) {
        containerRef.current.scrollTo({ top: savedScrollY, behavior: 'auto' });
        scrollPosRef.current = savedScrollY;
        clearInterval(tryScroll);
        setIsHidingScroll(false);
        setTimeout(() => { 
          setIsSnappingDisabled(false);
          isRestoringRef.current = false; 
        }, 1500); // Mantém snap-none por 1.5s
        sessionStorage.removeItem('stremio_scroll');
      }
    }, 50);

    const safety = setTimeout(() => {
      clearInterval(tryScroll);
      containerRef.current?.scrollTo({ top: savedScrollY, behavior: 'auto' }); // Fallback force scroll
      setIsHidingScroll(false);
      setIsSnappingDisabled(false);
      isRestoringRef.current = false;
      sessionStorage.removeItem('stremio_scroll');
    }, 3000);

    return () => {
      clearInterval(tryScroll);
      clearTimeout(safety);
    };
  }, []);

  return (
    <div 
      id="main-scroll-container"
      ref={containerRef}
      className={`h-screen overflow-y-auto overflow-x-hidden relative ${isHidingScroll ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'} ${isSnappingDisabled ? 'snap-none' : 'snap-y snap-mandatory'}`} 
      onScroll={(e) => {
        const currentScrollTop = (e.target as HTMLDivElement).scrollTop;
        const scrolled = currentScrollTop > 100;
        scrollPosRef.current = currentScrollTop;
        
        // Prevent 60fps state dispatch thrashing
        if (useStore.getState().isScrolled !== scrolled) {
          setIsScrolled(scrolled);
          storeSetIsScrolled(scrolled);
        }
        
        // Se houver algum card expandido (como um trailer tocando), 
        // e o usuário rolar a página verticalmente (e não for a restauração inicial), limpe o foco
        if (!isRestoringRef.current) {
          const currentFocus = useStore.getState().globalFocusedId;
          if (currentFocus) {
            useStore.getState().setGlobalFocusedId(null);
          }
        }
      }}
    >
      <div 
        className={`fixed inset-0 h-[100vh] z-0 pointer-events-none transform-gpu will-change-opacity`}
        style={{
          backgroundColor: bgColor,
          opacity: isScrolled ? 0 : 1,
          transition: 'opacity 1s ease-in-out, background-color 1.5s ease-in-out',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]" />
      </div>
      
      <div className="relative z-10">
        {/* Snap point 1: Hero Banner */}
        <div data-vertical-snap="true" className="snap-start snap-always h-screen pt-[108px] px-12 flex flex-col justify-start relative">
          <div className="flex-1 max-h-[80vh]">
            {featured.length > 0 && activeItem ? (
              <HeroBanner
                title={activeItem.title || activeItem.name || 'Featured Content'}
                titleLogoUrl={activeItem.logoUrl}
                backgroundUrl={getHeroBackground(activeItem)}
                synopsis={activeItem.overview}
                metadata={getMetadata(activeItem)}
                badgeText={activeItem.isNetflixOriginal ? (activeItem.media_type === 'tv' ? 'SERIES' : 'FILM') : undefined}
                showButtons={true}
                onColorExtracted={handleColorExtracted}
                imdbRating={activeItem.imdbRating}
                rtScore={activeItem.rtScore}
              />
            ) : (
              /* Premium Skeleton Loader */
              <div className="relative w-full aspect-video max-h-[80vh] min-h-[500px] rounded-[2rem] border-2 border-white/20 overflow-hidden bg-netflix-dark animate-pulse shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Vignettes */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
                
                {/* Skeleton content */}
                <div className="absolute bottom-0 left-0 p-12 md:w-2/3 flex flex-col gap-4 z-10">
                  {/* Brand badge placeholder */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3.5 h-5 bg-white/10 rounded"></div>
                    <div className="h-4 w-16 bg-white/10 rounded"></div>
                  </div>
                  
                  {/* Title logo placeholder */}
                  <div className="h-[80px] max-h-[120px] w-[300px] bg-white/10 rounded-lg mb-2"></div>
                  
                  {/* Metadata line placeholder */}
                  <div className="h-4 w-[240px] bg-white/10 rounded mb-2"></div>
                  
                  {/* Synopsis placeholder */}
                  <div className="flex flex-col gap-2 max-w-2xl">
                    <div className="h-4 w-full bg-white/5 rounded"></div>
                    <div className="h-4 w-[90%] bg-white/5 rounded"></div>
                    <div className="h-4 w-[75%] bg-white/5 rounded"></div>
                  </div>
                  
                  {/* Action buttons placeholder */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="h-[48px] w-[140px] bg-white/15 rounded-full"></div>
                    <div className="h-[48px] w-[140px] bg-white/10 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gradient Scroll Down Indicator */}
          <button 
            onClick={() => {
              const container = containerRef.current;
              if (container) {
                container.style.scrollSnapType = 'none';
                container.scrollTo({
                  top: window.innerHeight,
                  behavior: 'smooth'
                });
                setTimeout(() => {
                  container.style.scrollSnapType = 'y mandatory';
                }, 800);
              }
            }}
            className="absolute bottom-0 left-0 right-0 z-20 h-28 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col items-center justify-end pb-4 transition-all duration-300 hover:from-black/95 group focus:outline-none"
          >
            <ChevronDown className="w-12 h-12 text-white/70 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
          </button>
        </div>
        
        {/* Snap point 2: Carousels Container */}
        <div className="min-h-screen pt-[108px] pb-24 text-white flex flex-col justify-start gap-2 bg-[#0a0a0c]">
          {carouselsContent}
        </div>
      </div>
    </div>
  );
}
