import { useState, useEffect, useRef } from 'react';
import { FastAverageColor } from 'fast-average-color';
import { Calendar } from 'lucide-react';

interface HeroBannerProps {
  titleLogoUrl?: string;
  title: string;
  synopsis?: string;
  backgroundUrl: string;
  metadata: string;
  badgeText?: string;
  releaseDate?: string;
  showButtons?: boolean;
  onPlay?: () => void;
  onMoreInfo?: () => void;
  onColorExtracted?: (color: string) => void;
  imdbRating?: string | null;
  rtScore?: number | null;
}

export default function HeroBanner({
  titleLogoUrl,
  title,
  synopsis,
  backgroundUrl,
  metadata,
  badgeText,
  releaseDate,
  showButtons = true,
  onPlay,
  onMoreInfo,
  onColorExtracted,
  imdbRating,
  rtScore
}: HeroBannerProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [displayedContent, setDisplayedContent] = useState({
    title,
    titleLogoUrl,
    synopsis,
    backgroundUrl,
    metadata,
    badgeText,
    imdbRating,
    rtScore
  });
  const [loadingBg, setLoadingBg] = useState<string | null>(null);

  const getCORSUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    return url.includes('?') ? `${url}&cors=1` : `${url}?cors=1`;
  };

  useEffect(() => {
    if (backgroundUrl !== displayedContent.backgroundUrl) {
      setLoadingBg(backgroundUrl);
    } else {
      setDisplayedContent({
        title,
        titleLogoUrl,
        synopsis,
        backgroundUrl,
        metadata,
        badgeText,
        imdbRating,
        rtScore
      });
    }
  }, [backgroundUrl, title, titleLogoUrl, synopsis, metadata, badgeText, imdbRating, rtScore]);

  useEffect(() => {
    if (!displayedContent.backgroundUrl) return;
    
    // Isolate color extraction: don't parse the 4K image! Parse a tiny 300px version.
    const tinyImgUrl = displayedContent.backgroundUrl.replace('/original/', '/w300/');
    const fac = new FastAverageColor();
    
    fac.getColorAsync(getCORSUrl(tinyImgUrl), { algorithm: 'simple', step: 5 })
      .then(color => {
        if (onColorExtracted) {
          onColorExtracted(color.hex);
        }
      })
      .catch(e => console.error(e));
      
    return () => fac.destroy();
  }, [displayedContent.backgroundUrl, onColorExtracted]);

  return (
    <div className="relative w-full aspect-video max-h-[80vh] min-h-[500px] rounded-[2rem] overflow-hidden group transform-gpu will-change-transform border-2 border-white/20 shadow-2xl">
      {/* Invisible Preloader */}
      {loadingBg && (
        <img
          src={getCORSUrl(loadingBg)}
          alt=""
          crossOrigin="anonymous"
          onLoad={() => {
            setDisplayedContent({
              title,
              titleLogoUrl,
              synopsis,
              backgroundUrl,
              metadata,
              badgeText,
              imdbRating,
              rtScore
            });
            setLoadingBg(null);
          }}
          onError={() => {
            setDisplayedContent({
              title,
              titleLogoUrl,
              synopsis,
              backgroundUrl,
              metadata,
              badgeText,
              imdbRating,
              rtScore
            });
            setLoadingBg(null);
          }}
          className="hidden"
        />
      )}

      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full bg-black">
        <img
          key={displayedContent.backgroundUrl}
          ref={imgRef}
          src={getCORSUrl(displayedContent.backgroundUrl)}
          alt={displayedContent.title}
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover object-center animate-fade-in"
        />
        {/* TV-style Vignette - Darker at bottom and left */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
      </div>

      {/* Content */}
      <div 
        key={displayedContent.title}
        className="absolute bottom-0 left-0 p-12 md:w-2/3 flex flex-col gap-4 animate-fade-in-up z-10"
      >

        {displayedContent.titleLogoUrl ? (
          <img src={displayedContent.titleLogoUrl} alt={displayedContent.title} className="w-auto max-w-[320px] md:max-w-[380px] max-h-[120px] md:max-h-[155px] object-contain mb-2 select-none" />
        ) : (
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-2xl">
            {displayedContent.title}
          </h1>
        )}

        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-white/90 font-medium text-xs md:text-sm drop-shadow-md select-none">
          {displayedContent.metadata.split(' • ').map((part, index, arr) => (
            <span key={index} className="flex items-center gap-2">
              <span>{part}</span>
              {(index < arr.length - 1 || displayedContent.imdbRating || (displayedContent.rtScore !== undefined && displayedContent.rtScore !== null)) && (
                <span className="opacity-40 text-[10px]">●</span>
              )}
            </span>
          ))}

          {/* Real IMDb Rating */}
          {displayedContent.imdbRating && (
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" className="w-[34px] h-[17px] translate-y-[0.5px]" fill="none">
                  <path stroke="#f5c518" strokeLinecap="round" strokeLinejoin="round" strokeWidth="15" d="M21 71v48m82-48v48M42 71v48m40-48v48M42 71h10l10 48 10-48h10m21 0h16m-16 48h16m8-40v31m20-39v42a6 6 0 0 0 6 6h12a6 6 0 0 0 6-6V93a6 6 0 0 0-6-6h-18m-20-8a8 8 0 0 0-8-8m0 48a8 8 0 0 0 8-8" />
                </svg>
                <span className="font-bold text-white">{displayedContent.imdbRating}</span>
              </span>
              {displayedContent.rtScore !== undefined && displayedContent.rtScore !== null && (
                <span className="opacity-40 text-[10px]">●</span>
              )}
            </span>
          )}

          {/* Real Rotten Tomatoes Rating */}
          {displayedContent.rtScore !== undefined && displayedContent.rtScore !== null && (
            <span className="flex items-center gap-1">
              {displayedContent.rtScore >= 60 ? (
                /* Fresh Tomato SVG */
                <svg viewBox="0 0 32 32" className="w-[18px] h-[18px] translate-y-[-0.5px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="16" cy="18" rx="12" ry="10" fill="#E50914" />
                  <path d="M16 9v3m0 0c-1.5-1.5-4-2-6-1 2.5 1 4 2.5 4 4m2-3c1.5-1.5 4-2 6-1-2.5 1-4 2.5-4 4m-2-4c0-2-1.5-3.5-3-4" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              ) : (
                /* Rotten Splat SVG */
                <svg viewBox="0 0 32 32" className="w-[18px] h-[18px] translate-y-[-0.5px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.2 3.8c1-.8 2.6-.8 3.6 0 1.2 1 1 2.8.5 4.3-.4 1.2-.2 2.5.5 3.5 1 .9 2.5.9 3.8.3 1.3-.6 2.8-.2 3.5.9.7 1 .3 2.5-.6 3.4-1 .9-1.4 2.2-1.1 3.5.3 1.3.1 2.7-.9 3.5-1 .8-2.5.4-3.7-.3-1.1-.7-2.5-.7-3.6 0-1.2.7-2.7 1.1-3.7.3-1-.8-1.2-2.2-.9-3.5.3-1.3-.1-2.6-1.1-3.5-1-.9-2.5-.9-3.5-.1-.9.7-2.3.6-3-.3-.7-.9-.5-2.4.3-3.4 1-.9 1.4-2.2 1.1-3.5-.3-1.3.2-2.7 1.2-3.3 1.1-.6 2.5-.1 3.5.6.9.7 2.2.7 3.1 0z" fill="#22C55E" />
                </svg>
              )}
              <span className="font-bold text-white ml-0.5">{displayedContent.rtScore}%</span>
            </span>
          )}
        </div>

        {displayedContent.synopsis && (
          <p className="text-white text-base md:text-lg drop-shadow-md line-clamp-3 font-normal max-w-2xl text-white/80">
            {displayedContent.synopsis}
          </p>
        )}

        {/* Action Buttons */}
        {showButtons && (onPlay || onMoreInfo) && (
          <div className="flex items-center gap-4 mt-2">
            {onPlay && (
              <button
                onClick={onPlay}
                className="flex items-center justify-center gap-2 bg-stremio-purple text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-stremio-light transition-all active:scale-95 focus:outline-none focus:ring-4 focus:ring-stremio-light/50"
              >
                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center mr-1">
                   <div className="w-2 h-2 rounded-full bg-stremio-purple"></div>
                </div>
                Live Now
              </button>
            )}
            {onMoreInfo && (
              <button
                onClick={onMoreInfo}
                className="flex items-center justify-center gap-2 bg-white/20 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-white/30 transition-all active:scale-95 focus:outline-none focus:ring-4 focus:ring-white/50 backdrop-blur-md"
              >
                More Info
              </button>
            )}
          </div>
        )}
      </div>

      {/* Release Date Badge (Bottom-Right) */}
      {releaseDate && (
        <div className="absolute bottom-12 right-12 flex items-center gap-2 bg-black/60 hover:bg-black/75 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl text-white font-bold text-xs md:text-sm tracking-wide shadow-[0_4px_30px_rgba(0,0,0,0.3)] transition-all select-none duration-300 z-10">
          <Calendar className="w-4 h-4 text-red-500 fill-red-500/20" />
          <span>{releaseDate}</span>
        </div>
      )}
    </div>
  );
}
