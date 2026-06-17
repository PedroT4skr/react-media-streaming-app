import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MediaCard from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getImageUrl } from '../../services/tmdb';
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

interface MediaCarouselProps {
  title: string;
  items: any[]; // TMDB movie/show format
  priority?: boolean;
  onItemFocus: (item: any) => void;
  brandColor?: string;
  renderDelay?: number;
}

export default function MediaCarousel({ title, items, priority = false, onItemFocus, brandColor, renderDelay = 0 }: MediaCarouselProps) {
  const navigate = useNavigate();
  const setGlobalFocusedId = useStore((state) => state.setGlobalFocusedId);
  const globalFocusedId = useStore((state) => state.globalFocusedId);
  const isCarouselFocused = globalFocusedId?.startsWith(title);
  
  const [isSnapping, setIsSnapping] = useState(true);
  
  // Staggered Background Rendering (Time-Slicing)
  // Replaces IntersectionObserver. Mounts rows sequentially in the background
  // to avoid scroll jittering and pop-ins, keeping 60fps intact.
  const [hasRendered, setHasRendered] = useState(priority || renderDelay === 0);

  useEffect(() => {
    if (hasRendered) return;
    const timer = setTimeout(() => {
      setHasRendered(true);
    }, renderDelay);
    return () => clearTimeout(timer);
  }, [renderDelay, hasRendered]);

  useEffect(() => {
    if (isCarouselFocused) {
      setIsSnapping(false);
    } else {
      const timeout = setTimeout(() => setIsSnapping(true), 500); // Aguarda a transição de 500ms terminar
      return () => clearTimeout(timeout);
    }
  }, [isCarouselFocused]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [shiftAmount, setShiftAmount] = useState(0);

  // Restore scroll
  useEffect(() => {
    if (hasRendered && scrollRef.current) {
      const savedPos = useStore.getState().carouselScrollPositions[title];
      if (savedPos !== undefined && savedPos > 0) {
        const tryScroll = setInterval(() => {
          if (scrollRef.current && scrollRef.current.scrollWidth > savedPos) {
            scrollRef.current.scrollLeft = savedPos;
            scrollPosRef.current = savedPos;
            checkScrollPosition();
            clearInterval(tryScroll);
          }
        }, 50);

        const safety = setTimeout(() => {
          clearInterval(tryScroll);
        }, 3000);

        return () => {
          clearInterval(tryScroll);
          clearTimeout(safety);
        };
      }
    }
  }, [hasRendered, title]);

  useEffect(() => {
    if (!isCarouselFocused) {
      setShiftAmount(0);
    }
  }, [isCarouselFocused]);

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkScrollPosition = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      scrollPosRef.current = scrollLeft;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
      
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        useStore.getState().setCarouselScrollPosition(title, scrollLeft);
      }, 150);
    }
  };

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
          className="absolute left-0 top-[188px] md:top-[230px] -translate-y-1/2 z-40 h-[225px] md:h-[300px] px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent flex items-center"
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
            isCarouselFocused ? 'z-50 relative' : 'z-10 relative'
          }`}
          style={{ transform: `translateX(${shiftAmount}px)` }}
        >
          {hasRendered && items.map((item, index) => (
            <div 
              key={item.id} 
              data-id={item.id}
              data-card-wrapper
              className={`${!isSnapping ? '' : 'snap-start'} scroll-ml-8`}
            >
            <MediaCard
              id={item.id}
              mediaType={item.media_type || (item.first_air_date ? 'tv' : 'movie')}
              title={item.title || item.name}
              posterUrl={getImageUrl(item.poster_path, 'w500')}
              backdropUrl={getImageUrl(item.backdrop_path, 'w780')}
              synopsis={getShortSynopsis(item.overview)}
              priority={priority && index < 6}
              releaseDate={item.release_date || item.first_air_date}
              brandColor={brandColor}
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
              isFocused={globalFocusedId === `${title}-${item.id}`}
              onHover={(el) => {
                if (scrollRef.current && isCardVisible(el, scrollRef.current)) {
                  
                  const wrapper = el.closest('[data-card-wrapper]') as HTMLElement;
                  const measureEl = wrapper || el;
                  
                  const cardLeft = measureEl.offsetLeft;
                  const scrollLeft = scrollRef.current.scrollLeft;
                  const containerWidth = scrollRef.current.clientWidth;
                  const visualCardLeft = cardLeft - scrollLeft;
                  
                  const isMobile = window.innerWidth < 768;
                  const expandedWidth = isMobile ? 400 : 533;
                  const visualCardRightWhenExpanded = visualCardLeft + expandedWidth;
                  
                  // Ao invés de usar o scroll do container, fazemos um shift em CSS, 
                  // assim os cards da borda direita expandem para a esquerda nativamente
                  if (visualCardRightWhenExpanded > containerWidth) {
                    const overflowAmount = visualCardRightWhenExpanded - containerWidth + 60; // 60px de respiro (padding)
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

            />
          </div>
        ))}
        </div>
      </div>

      {/* Right Arrow */}
      {showRightArrow && hasRendered && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-[188px] md:top-[230px] -translate-y-1/2 z-40 h-[225px] md:h-[300px] px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent flex items-center"
        >
          <ChevronRight className="w-10 h-10 text-white" />
        </button>
      )}
    </div>
  );
}
