import { useState, useRef, useEffect } from 'react';
import MediaCard from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getImageUrl, STREAMING_PROVIDERS } from '../../services/tmdb';
import { useStore } from '../../store/useStore';

const isCardVisible = (cardEl: HTMLElement, containerEl: HTMLElement) => {
  const cardRect = cardEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  const tolerance = 15;
  const isLeftVisible = cardRect.left >= containerRect.left - tolerance;
  const isRightVisible = cardRect.right <= containerRect.right + tolerance;
  return isLeftVisible && isRightVisible;
};

const getShortSynopsis = (text: string) => {
  if (!text) return '';
  const match = text.match(/[^.!?]+[.!?]+/);
  return match ? match[0].trim() : text;
};

const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

const Separator = () => <span className="opacity-40 text-[10px]">•</span>;

interface Top10CarouselProps {
  title: string;
  items: any[]; // TMDB movie/show format
  priority?: boolean;
  onItemFocus: (item: any) => void;
  useBrandColors?: boolean;
  renderDelay?: number;
}

export default function Top10Carousel({ title, items, priority = false, onItemFocus, useBrandColors = false, renderDelay = 0 }: Top10CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const globalFocusedId = useStore((state) => state.globalFocusedId);
  const setGlobalFocusedId = useStore((state) => state.setGlobalFocusedId);
  const activeProvider = useStore((state) => state.activeProvider);
  
  const [isSnapping, setIsSnapping] = useState(true);

  // Staggered Background Rendering (Time-Slicing)
  const [hasRendered, setHasRendered] = useState(priority || renderDelay === 0);

  useEffect(() => {
    if (hasRendered) return;
    const timer = setTimeout(() => {
      setHasRendered(true);
    }, renderDelay);
    return () => clearTimeout(timer);
  }, [renderDelay, hasRendered]);

  // Calculate dynamic gradient stops based on the active provider
  let stopColor1 = '#595959';
  let stopColor2 = '#333333';
  
  if (useBrandColors) {
    stopColor1 = STREAMING_PROVIDERS[activeProvider]?.color || '#ffffff';
    stopColor2 = '#595959';
    
    if (activeProvider === 'disney') { stopColor1 = '#00E5FF'; stopColor2 = '#113CCF'; }
    else if (activeProvider === 'hbo') { stopColor1 = '#D433FF'; stopColor2 = '#2A00E6'; }
    else if (activeProvider === 'apple' || activeProvider === 'peacock') { stopColor1 = '#ffffff'; stopColor2 = '#595959'; }
    else if (activeProvider === 'netflix') { stopColor1 = '#E50914'; stopColor2 = '#8a060c'; }
    else if (activeProvider === 'prime') { stopColor1 = '#00E5FF'; stopColor2 = '#0071c5'; }
    else if (activeProvider === 'hulu') { stopColor1 = '#1CE783'; stopColor2 = '#0b6e3d'; }
    else if (activeProvider === 'paramount') { stopColor1 = '#0064FF'; stopColor2 = '#002277'; }
  }

  useEffect(() => {
    if (globalFocusedId?.startsWith(title)) {
      setIsSnapping(false);
    } else {
      const timeout = setTimeout(() => setIsSnapping(true), 500); // Aguarda a transição terminar
      return () => clearTimeout(timeout);
    }
  }, [globalFocusedId, title]);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [shiftAmount, setShiftAmount] = useState(0);

  useEffect(() => {
    if (!globalFocusedId?.startsWith(title)) {
      setShiftAmount(0);
    }
  }, [globalFocusedId, title]);

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkScrollPosition = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        useStore.getState().setCarouselScrollPosition(title, scrollLeft);
      }, 150);
    }
  };

  useEffect(() => {
    // Restore scroll if any
    if (hasRendered && scrollRef.current) {
      const savedPos = useStore.getState().carouselScrollPositions[title];
      if (savedPos !== undefined && savedPos > 0) {
        const tryScroll = setInterval(() => {
          if (scrollRef.current && scrollRef.current.scrollWidth > savedPos) {
            scrollRef.current.scrollLeft = savedPos;
            checkScrollPosition();
            clearInterval(tryScroll);
          }
        }, 50);
        const safety = setTimeout(() => clearInterval(tryScroll), 3000);
        return () => { clearInterval(tryScroll); clearTimeout(safety); };
      }
    }
  }, [hasRendered, title]);

  useEffect(() => {
    // Delay slightly to ensure Framer Motion/CSS transitions have settled the DOM width
    const timer = setTimeout(checkScrollPosition, 50);
    window.addEventListener('resize', checkScrollPosition);
    return () => {
      clearTimeout(timer);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      window.removeEventListener('resize', checkScrollPosition);
    }
  }, [items, hasRendered]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? scrollLeft - clientWidth + 100 : scrollLeft + clientWidth - 100;
      scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Only take top 10 items
  const top10Items = items.slice(0, 10);

  return (
    <div 
      className="relative w-full py-4 group"
      onMouseLeave={() => setGlobalFocusedId(null)}
      style={{ minHeight: '350px' }} // Preserve layout space before intersection
    >
      <h2 className="text-xl md:text-2xl font-bold mb-4 text-white/90 px-8">
        {title}
      </h2>
      
      {/* Left Arrow */}
      {showLeftArrow && hasRendered && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-[188px] md:top-[230px] -translate-y-1/2 z-40 h-[225px] md:h-[300px] px-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
          style={{ backgroundImage: `linear-gradient(to right, #0a0a0c, rgba(10, 10, 12, 0.6), transparent)` }}
        >
          <ChevronLeft className="w-10 h-10 text-white" />
        </button>
      )}

      <div 
        ref={scrollRef}
        onScroll={checkScrollPosition}
        className={`overflow-x-auto scrollbar-hide px-8 pb-32 pt-4 snap-x scroll-smooth ${
          !isSnapping ? 'snap-none' : 'snap-mandatory'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', overflowAnchor: 'none' }}
      >
        <div 
          className={`flex gap-4 transition-all duration-500 ease-out transform-gpu will-change-transform ${
            globalFocusedId?.startsWith(title) ? 'z-50 relative' : 'z-10 relative'
          }`}
          style={{ transform: `translateX(${shiftAmount}px)` }}
        >
        {hasRendered && top10Items.map((item, index) => {
          const isCardFocused = globalFocusedId === `${title}-${item.id}`;

          return (
          <div 
            key={item.id} 
            data-id={item.id}
            data-card-wrapper
            className={`${!isSnapping ? '' : 'snap-start'} relative h-[225px] md:h-[300px] flex-shrink-0 transition-all duration-500 ease-out ${
              isCardFocused 
                ? 'w-[470px] md:w-[633px]' 
                : 'w-[220px] md:w-[300px]'
            } ${
              index === 0 
                ? 'scroll-ml-[96px] ml-16 md:scroll-ml-[112px] md:ml-20' /* 32px padding + margin */
                : index === 9
                ? 'scroll-ml-[192px] ml-[160px] md:scroll-ml-[332px] md:ml-[300px]' 
                : 'scroll-ml-[128px] ml-24 md:scroll-ml-[160px] md:ml-32'
            }`}
          >
            {/* The SVG Number on the Left */}
            <svg 
              className="absolute -left-2 md:-left-4 bottom-0 h-[225px] md:h-[300px] w-[140px] md:w-[200px] pointer-events-none select-none z-0 overflow-visible" 
              viewBox="0 0 100 150" 
              preserveAspectRatio="none"
            >
              {/* CONTROLADOR DE ALTURA: y="150" (Valores menores como 140 sobem o número, maiores descem) */}
              {/* CONTROLADOR DE TAMANHO: fontSize="208" (Muda a escala do texto dentro da caixa) */}
              {/* CONTROLADOR HORIZONTAL (Dinâmico) */}
              {/* index 0 = Número 1 (Mais pra direita/perto do poster) */}
              {/* index 9 = Número 10 (Mais pra esquerda/longe para caber os 2 dígitos) */}
              {/* index 1-8 = Números 2 ao 9 (Padrão intermediário) */}
              <defs>
                <linearGradient id={`top10-gradient-${activeProvider}-${index}`} x1="0" y1="0" x2="0" y2="150" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={stopColor1} />
                  <stop offset="100%" stopColor={stopColor2} />
                </linearGradient>
              </defs>
              <text 
                x={index === 0 ? "-30" : index === 9 ? "-150" : "-43"} 
                y="148" 
                textAnchor="start" 
                fontSize={index === 0 ? "205" : "210"} 
                stroke={`url(#top10-gradient-${activeProvider}-${index})`} 
                strokeWidth="4" 
                fill="#0a0a0c"
                style={{ 
                  fontFamily: 'NetflixSans, system-ui, -apple-system, sans-serif',
                  fontWeight: '900',
                  /* CONTROLADOR DE DISTÂNCIA ENTRE O 1 E O 0 NO "10": Mude de -30px para -40px se quiser mais junto, ou -20px para afastar */
                  letterSpacing: index === 9 ? '-30px' : '0' 
                }}
              >
                {index + 1}
              </text>
            </svg>

            {/* The Media Card on the Right with Shadow */}
            <div className="absolute left-[70px] md:left-[100px] bottom-0 z-10 drop-shadow-[-10px_0_15px_rgba(0,0,0,0.8)]">
              <MediaCard
                id={item.id}
                mediaType={item.media_type || 'movie'}
                title={item.title || item.name}
                posterUrl={getImageUrl(item.poster_path, 'w500')}
                backdropUrl={getImageUrl(item.backdrop_path, 'w780')}
                synopsis={getShortSynopsis(item.overview)}
                priority={priority && index < 6}
                metadata={
                  <>
                    <span>
                      {(() => {
                        if (!item.genre_ids || item.genre_ids.length === 0) return 'Entertainment';
                        const primaryGenreId = item.genre_ids[0];
                        return TMDB_GENRES[primaryGenreId] || 'Entertainment';
                      })()}
                    </span>
                    <Separator />
                    <span>{item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || '2024'}</span>
                    <Separator />
                    <span>{item.media_type === 'movie' ? 'Movie' : 'Series'}</span>
                  </>
                }
                isFocused={isCardFocused}
                onHover={(el) => {
                  if (scrollRef.current && isCardVisible(el, scrollRef.current)) {
                    
                    const wrapper = el.closest('[data-card-wrapper]') as HTMLElement;
                    const measureEl = wrapper || el;
                    
                    const cardLeft = measureEl.offsetLeft;
                    const scrollLeft = scrollRef.current.scrollLeft;
                    const containerWidth = scrollRef.current.clientWidth;
                    const visualCardLeft = cardLeft - scrollLeft;
                    
                    const isMobile = window.innerWidth < 768;
                    const expandedWidth = isMobile ? 470 : 633;
                    const visualCardRightWhenExpanded = visualCardLeft + expandedWidth;
                    
                    if (visualCardRightWhenExpanded > containerWidth) {
                      const overflowAmount = visualCardRightWhenExpanded - containerWidth + 60; // 60px de respiro
                      setShiftAmount(-overflowAmount);
                    } else if (visualCardLeft < 40) {
                      // Se estiver espremido na esquerda
                      const underflowAmount = 40 - visualCardLeft;
                      setShiftAmount(underflowAmount);
                    } else {
                      setShiftAmount(0);
                    }

                    setGlobalFocusedId(`${title}-${item.id}`);
                    onItemFocus(item);
                  }
                }}
                onClick={() => console.log('Clicked', item.id)}
              />
            </div>
          </div>
        );
        })}
        </div>
      </div>

      {/* Right Arrow */}
      {showRightArrow && hasRendered && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-[188px] md:top-[230px] -translate-y-1/2 z-40 h-[225px] md:h-[300px] px-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
          style={{ backgroundImage: `linear-gradient(to left, #0a0a0c, rgba(10, 10, 12, 0.6), transparent)` }}
        >
          <ChevronRight className="w-10 h-10 text-white" />
        </button>
      )}
    </div>
  );
}
