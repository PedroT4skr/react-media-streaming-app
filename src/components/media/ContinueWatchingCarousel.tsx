import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ContinueWatchingCard from './ContinueWatchingCard';
import type { ContinueWatchingItem } from './ContinueWatchingCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface ContinueWatchingCarouselProps {
  title: string;
  items: ContinueWatchingItem[];
  onItemClick?: (item: ContinueWatchingItem) => void;
}

export default function ContinueWatchingCarousel({ title, items, onItemClick }: ContinueWatchingCarouselProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Default navigation: extract tmdbId from the CW item ID and go to the player
  const handleItemClick = useCallback((item: ContinueWatchingItem) => {
    if (onItemClick) {
      onItemClick(item);
      return;
    }

    // ID format: "cw-{tmdbId}" or "cw-{tmdbId}-s{season}e{episode}"
    const rawId = String(item.id).replace(/^cw-/, '');
    const match = rawId.match(/^(\d+)-s(\d+)e(\d+)$/);
    
    if (match) {
      const [, tmdbId, season, episode] = match;
      navigate(`/player/${tmdbId}?type=tv&season=${season}&episode=${episode}`);
    } else {
      const tmdbId = rawId;
      navigate(`/player/${tmdbId}?type=${item.type}`);
    }
  }, [onItemClick, navigate]);

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkScrollPosition = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener('resize', checkScrollPosition);
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      window.removeEventListener('resize', checkScrollPosition);
    }
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? scrollLeft - clientWidth + 100 : scrollLeft + clientWidth - 100;
      scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full py-4 group">
      <h2 className="text-xl md:text-2xl font-bold mb-4 text-white/90 px-8">
        {title}
      </h2>
      
      {/* Left Arrow */}
      {showLeftArrow && (
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
        className="flex gap-4 overflow-x-auto scrollbar-hide px-8 pb-32 pt-4 snap-x snap-mandatory scroll-smooth transform-gpu will-change-transform"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <div 
            key={item.id} 
            className="snap-start scroll-ml-8"
          >
            <ContinueWatchingCard
              item={item}
              onClick={() => handleItemClick(item)}
            />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
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
