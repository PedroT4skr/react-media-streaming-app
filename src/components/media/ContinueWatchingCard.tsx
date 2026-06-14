import { useState, useEffect, memo } from 'react';
import { clsx } from 'clsx';
import { fetchLogo, getImageUrl } from '../../services/tmdb';

export interface ContinueWatchingItem {
  id: string | number;
  title: string;
  backdropUrl: string;
  progress: number; // 0 to 100
  remainingTime: string; // e.g. "23m left"
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem;
  onClick?: () => void;
}

const ContinueWatchingCard = ({ item, onClick }: ContinueWatchingCardProps) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const tmdbId = typeof item.id === 'string' && item.id.startsWith('cw-')
      ? parseInt(item.id.replace('cw-', ''), 10)
      : Number(item.id);

    if (tmdbId) {
      fetchLogo(tmdbId, item.type).then(path => {
        if (path) setLogoUrl(getImageUrl(path, 'w500'));
      });
    }
  }, [item.id, item.type]);

  return (
    <div 
      className="flex flex-col group/card cursor-pointer w-[400px] md:w-[533px] transition-all duration-300 hover:scale-[1.02] flex-shrink-0 relative"
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-md bg-zinc-900 border border-white/15 h-[225px] md:h-[300px] shadow-lg transform-gpu will-change-transform group-hover/card:ring-2 group-hover/card:ring-white transition-all duration-300">
        
        {/* Esqueleto de Fallback */}
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center z-0">
          <span className="text-white/20 font-bold text-sm md:text-base leading-tight">{item.title}</span>
        </div>

        {/* Background Image */}
        <img
          src={item.backdropUrl}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover relative z-10"
        />

        {/* Shadow Overlay for the logo readability */}
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4 pb-4 z-10 pointer-events-none">
          <div className="flex-1 min-w-0 flex flex-col justify-end">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={item.title}
                decoding="async"
                className="max-h-[35px] max-w-[120px] md:max-h-[50px] md:max-w-[160px] object-contain select-none transition-all duration-300 drop-shadow-lg"
              />
            ) : (
              <h3 className="text-white font-bold text-base md:text-lg leading-snug truncate drop-shadow-md">
                {item.title}
              </h3>
            )}
          </div>
        </div>

      {/* Progress Bar (Visible at the very bottom border) */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] md:h-1 bg-[#333] z-20 overflow-hidden">
          <div
            className="h-full bg-red-600 transition-all duration-500 rounded-r-full"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      {/* Info Outside the Card */}
      <div className="absolute top-full left-0 w-full mt-3 flex flex-col px-1 gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="text-white/95 text-sm md:text-base font-semibold truncate flex items-center gap-1.5">
          {item.type === 'tv' && item.season && item.episode ? (
            <>
              <span className="text-white/80 shrink-0">S{item.season} E{item.episode}</span>
              <span className="text-white/50 shrink-0">•</span>
              <span className="truncate">{item.episodeTitle || item.title}</span>
            </>
          ) : (
            <span className="truncate">{item.title}</span>
          )}
        </div>
        <div className="text-white/60 text-xs md:text-sm font-medium">
          {item.remainingTime}
        </div>
      </div>
    </div>
  );
}

export default memo(ContinueWatchingCard, (prev, next) => prev.item.id === next.item.id && prev.item.progress === next.item.progress);
