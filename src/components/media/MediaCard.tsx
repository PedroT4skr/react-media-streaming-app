import { useState, useEffect, useRef, memo } from 'react';
import { clsx } from 'clsx';
import { fetchLogo, getImageUrl, fetchMDBListRatings, fetchTrailerKey, fetchDetails } from '../../services/tmdb';
import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';

interface MediaCardProps {
  id: number | string;
  mediaType?: 'movie' | 'tv';
  posterUrl: string;
  backdropUrl?: string;
  title: string;
  synopsis?: string;
  metadata?: React.ReactNode;
  releaseDate?: string;
  brandColor?: string;
  isFocused?: boolean;
  priority?: boolean;
  onClick?: () => void;
  onHover?: (el: HTMLElement) => void;
}

const MediaCard = ({ 
  id,
  mediaType = 'movie',
  posterUrl, 
  backdropUrl, 
  title, 
  synopsis,
  metadata,
  releaseDate,
  brandColor,
  isFocused, 
  priority = false,
  onClick, 
  onHover
}: MediaCardProps) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFetched, setLogoFetched] = useState(false);
  const [imdbRating, setImdbRating] = useState<string | null>(null);
  const [rtScore, setRtScore] = useState<number | null>(null);
  const [hasFetchedRatings, setHasFetchedRatings] = useState(false);
  const [realSpecs, setRealSpecs] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Logos e Ratings agora são pre-fetched no evento de hover (handleMouseEnter)
  // para evitar queda de frames durante a animação de expansão.

  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isTrailerReady, setIsTrailerReady] = useState(false);
  const [hasPlayedTrailer, setHasPlayedTrailer] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listener para eventos do YouTube
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      
      if (isFocused) {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'infoDelivery' && data.info) {
            // Se começou a tocar e ainda não tínhamos sinalizado
            if (data.info.playerState === 1 && !hasPlayedTrailer) {
              setIsTrailerReady(true);
            }
            
            // Lógica de Fade Out Inteligente: 1.5 segundos antes do vídeo acabar
            if (data.info.duration && data.info.currentTime) {
              const timeRemaining = data.info.duration - data.info.currentTime;
              
              if (timeRemaining <= 1.5 && timeRemaining > 0 && !hasPlayedTrailer) {
                // 1. Marca que já tocou para não repetir neste hover
                setHasPlayedTrailer(true);
                // 2. Dispara a volta do Pôster por cima do vídeo (Fade In de 700ms)
                setIsTrailerReady(false);
                // 3. Aguarda o pôster cobrir totalmente a tela antes de deletar o iframe e cortar o som
                setTimeout(() => {
                  setShowTrailer(false);
                }, 1000);
              }
            }
          }
        } catch (e) {}
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isFocused, hasPlayedTrailer]);

  useEffect(() => {
    let readyTimer: NodeJS.Timeout | null = null;
    let fallbackTimer: NodeJS.Timeout | null = null;

    if (isFocused) {
      if (!trailerKey) {
        fetchTrailerKey(id, mediaType).then(key => {
          if (key) setTrailerKey(key);
        });
      }

      // Só monta o iframe se ainda não tocou neste hover
      if (!hasPlayedTrailer) {
        // Delay estético de 1 segundo (1000ms) após o card expandir 
        // para dar tempo do usuário ler as informações antes do vídeo cobrir tudo
        readyTimer = setTimeout(() => {
          setShowTrailer(true);
          
          fallbackTimer = setTimeout(() => {
            if (!hasPlayedTrailer) setIsTrailerReady(true);
          }, 8000);
        }, 1000);
      }

    } else {
      // Quando o usuário tira o mouse do card, resetamos TUDO para que
      // um próximo hover permita tocar de novo.
      setShowTrailer(false);
      setIsTrailerReady(false);
      setHasPlayedTrailer(false);
    }

    return () => {
      if (readyTimer) clearTimeout(readyTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [isFocused, id, mediaType, trailerKey, hasPlayedTrailer]);

  useEffect(() => {
    // Quando o trailer estiver pronto e tocando, desmuta
    if (isTrailerReady && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
        '*'
      );
    }
  }, [isTrailerReady]);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setGlobalFocusedId = useStore(state => state.setGlobalFocusedId);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    // PREFETCH AVANÇADO: Enquanto o usuário "pensa" (450ms) se quer focar nesse card,
    // nós já vamos buscar as keys, logos e ratings na API em background.
    // Isso evita re-renderizações estáticas no meio da animação CSS, curando o "micro travamento" do primeiro hover.
    if (!trailerKey) {
      fetchTrailerKey(id, mediaType).then(key => {
        if (key) setTrailerKey(key);
      });
    }

    // Pré-carrega o banner horizontal na memória durante os 450ms.
    // Garante transição 100% fluida do vertical para o horizontal ao forçar o "decode" fora da Main Thread.
    if (backdropUrl) {
      const preloadImg = new Image();
      preloadImg.src = backdropUrl;
      preloadImg.decode().catch(() => {});
    }
    
    if (!logoFetched) {
      fetchLogo(id, mediaType).then(path => {
        if (path) {
          const url = getImageUrl(path, 'w500');
          const preloadLogo = new Image();
          preloadLogo.src = url;
          preloadLogo.decode().then(() => {
            setLogoUrl(url);
          }).catch(() => {
            setLogoUrl(url); // Fallback
          });
        }
        setLogoFetched(true);
      }).catch(() => setLogoFetched(true));
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      if (!hasFetchedRatings) {
        fetchDetails(id, mediaType).then(details => {
          if (details) {
            if (details.vote_average) setImdbRating(details.vote_average.toFixed(1));
            if (mediaType === 'movie' && details.runtime) {
              setRealSpecs(`${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m`);
            } else if (mediaType === 'tv' && details.number_of_seasons) {
              setRealSpecs(`${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}`);
            }
          }
        });
        fetchMDBListRatings(id, mediaType).then(ratings => {
          setRtScore(ratings.rt);
          setHasFetchedRatings(true);
        }).catch(() => setHasFetchedRatings(true));
      }

      if (cardRef.current) {
        onHover?.(cardRef.current);
      }
    }, 450); // Intenção de hover: aguarda 450ms antes de expandir
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (isFocused) {
      setGlobalFocusedId(null);
    }
  };

  return (
    <div 
      ref={cardRef}
      className={clsx(
        "relative transition-all duration-500 ease-out cursor-pointer flex-shrink-0 group h-[225px] md:h-[300px]",
        isFocused 
          ? "w-[400px] md:w-[533px] z-10" 
          : "w-[150px] md:w-[200px]"
      )}
      onClick={() => {
        const container = document.getElementById('main-scroll-container');
        if (container) {
          sessionStorage.setItem('stremio_scroll', String(container.scrollTop));
        }
        navigate(`/title/${mediaType}/${id}`);
        if (onClick) onClick();
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={clsx("w-full h-full relative rounded-md overflow-hidden bg-[#141414]", isFocused ? "ring-2 ring-white shadow-2xl" : "hover:ring-1 ring-white/50")}>
      
      {/* Esqueleto de Fallback (z-0): Mostra o título e um fundo cinza enquanto o lazy-load baixa o pôster */}
      <div className="absolute inset-0 flex items-center justify-center p-4 text-center z-0">
        <span className="text-white/20 font-bold text-xs md:text-sm leading-tight">{title}</span>
      </div>
      {/* Camada Fundo (z-index: 0): O iframe do YouTube. Sempre visível, revelado pelo fade-out do poster. */}
      {isFocused && showTrailer && trailerKey && (
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-black z-0">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&enablejsapi=1&showinfo=0&rel=0&iv_load_policy=3`}
            title={`${title} Trailer`}
            className="absolute pointer-events-none"
            onLoad={(e) => {
              const target = e.target as HTMLIFrameElement;
              target.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
            }}
            style={{
              width: '130%',
              height: '140%',
              top: '-22%',
              left: '-15%',
            }}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}

      {/* Camada Meio 1 (z-index: 10): Vertical Poster */}
      {posterUrl && (
        <img 
          src={posterUrl} 
          alt={title} 
          loading={priority ? undefined : "lazy"}
          decoding="async"
          className={clsx(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-10",
            isFocused ? "opacity-0" : "opacity-100"
          )}
        />
      )}
      
      {/* Camada Meio 2 (z-index: 20): Horizontal Backdrop */}
      {/* Montado APENAS no foco para destruir ~400MB de peso no DOM inativo */}
      {isFocused && backdropUrl && (
        <img 
          src={backdropUrl} 
          alt={title} 
          decoding="async"
          loading={priority ? undefined : "lazy"}
          className={clsx(
            "absolute top-0 left-0 h-full w-[400px] md:w-[633px] object-cover transition-opacity duration-700 z-20 origin-left",
            (isFocused && !isTrailerReady) ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Camada Topo (z-index: 30): Escudo de vidro transparente */}
      <div className="absolute inset-0 z-30 bg-transparent" />

      {/* Em Breve Release Date Label */}
      {(() => {
        if (!releaseDate) return null;
        const [year, month, day] = releaseDate.split('-').map(Number);
        if (!year || !month || !day) return null;
        
        const localTarget = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = localTarget.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return null; // Already released
        
        let label = '';
        let isNumberDate = false;
        
        if (diffDays === 0) label = 'TODAY';
        else if (diffDays === 1) label = 'TOMORROW';
        else if (diffDays > 1 && diffDays <= (6 - today.getDay())) {
          const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          label = days[localTarget.getDay()];
        } else {
          label = localTarget.getDate().toString();
          isNumberDate = true;
        }

        return (
          <div className="absolute top-2 right-2 z-50 flex items-center justify-center pointer-events-none">
            {isNumberDate ? (
              <div 
                className="flex flex-col items-center justify-center relative w-7 h-7 md:w-9 md:h-9 backdrop-blur-md rounded-md shadow-2xl"
                style={{
                  background: brandColor 
                    ? `linear-gradient(135deg, ${brandColor} -20%, rgba(0,0,0,1) 75%)` 
                    : 'rgba(0,0,0,0.85)'
                }}
              >
                <span className="text-white text-[11px] md:text-[13px] font-['Netflix_Sans',_sans-serif] font-bold leading-none translate-y-[3.5px] md:translate-y-[4.5px] drop-shadow-md">
                  {label}
                </span>
                <svg className="absolute inset-0 w-full h-full text-white/90 drop-shadow-md opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            ) : (
              <div 
                className="backdrop-blur-xl rounded-[4px] px-2 py-[3px] shadow-2xl transition-opacity duration-300"
                style={{
                  background: brandColor 
                    ? `linear-gradient(135deg, ${brandColor} -20%, rgba(0,0,0,1) 75%)` 
                    : 'rgba(20,20,20,0.95)'
                }}
              >
                <span className="text-white text-[10px] md:text-[11px] font-['Netflix_Sans',_sans-serif] font-bold tracking-wider uppercase drop-shadow-md">
                  {label}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Overlay com Gradiente e Logo (z-index: 40) - Montado permanentemente para evitar layout shift */}
      <div 
        className={clsx(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-6 z-40 pointer-events-none transition-opacity duration-500",
          isFocused ? "opacity-100" : "opacity-0"
        )}
      >
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={title} 
            loading="lazy"
            decoding="async"
            className={clsx(
              "object-contain drop-shadow-2xl transition-all duration-700 ease-out origin-left origin-bottom",
              isTrailerReady ? "w-20 md:w-28 opacity-80" : "w-32 md:w-48 opacity-100"
            )}
          />
        ) : logoFetched ? (
          <h3 
            className={clsx(
              "text-white font-black truncate w-full transition-all duration-700 ease-out origin-left origin-bottom",
              isTrailerReady ? "text-base md:text-lg opacity-80" : "text-xl md:text-2xl opacity-100"
            )}
          >
            {title}
          </h3>
        ) : null}
      </div>
      </div>

      {/* Metadata Resume */}
      <div className={clsx(
        "absolute top-full left-0 pt-4 w-[400px] md:w-[533px] pointer-events-none transition-all",
        isFocused ? "opacity-100 translate-y-0 duration-500 delay-200 ease-out z-20" : "opacity-0 duration-75 ease-in z-0"
      )}>
        <div className="flex justify-between items-center w-full">
          {(metadata || realSpecs) && (
            <div className="text-white font-medium text-xs md:text-sm flex items-center gap-2">
              {metadata}
              {realSpecs && (
                <>
                  {metadata && <span className="w-1 h-1 bg-white/40 rounded-full mx-1"></span>}
                  <span>{realSpecs}</span>
                </>
              )}
            </div>
          )}
          
          {(imdbRating || rtScore !== null) && (
            <div className="flex items-center gap-3 select-none ml-auto text-xs md:text-sm">
              {imdbRating && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" className="w-[30px] h-[15px] translate-y-[0.5px]" fill="none">
                    <path stroke="#f5c518" strokeLinecap="round" strokeLinejoin="round" strokeWidth="15" d="M21 71v48m82-48v48M42 71v48m40-48v48M42 71h10l10 48 10-48h10m21 0h16m-16 48h16m8-40v31m20-39v42a6 6 0 0 0 6 6h12a6 6 0 0 0 6-6V93a6 6 0 0 0-6-6h-18m-20-8a8 8 0 0 0-8-8m0 48a8 8 0 0 0 8-8" />
                  </svg>
                  <span className="font-bold text-white">{imdbRating}</span>
                </span>
              )}
              {rtScore !== null && (
                <span className="flex items-center gap-1">
                  {rtScore >= 60 ? (
                    <svg viewBox="0 0 32 32" className="w-[15px] h-[15px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="16" cy="18" rx="12" ry="10" fill="#E50914" />
                      <path d="M16 9v3m0 0c-1.5-1.5-4-2-6-1 2.5 1 4 2.5 4 4m2-3c1.5-1.5 4-2 6-1-2.5 1-4 2.5-4 4m-2-4c0-2-1.5-3.5-3-4" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 32 32" className="w-[15px] h-[15px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14.2 3.8c1-.8 2.6-.8 3.6 0 1.2 1 1 2.8.5 4.3-.4 1.2-.2 2.5.5 3.5 1 .9 2.5.9 3.8.3 1.3-.6 2.8-.2 3.5.9.7 1 .3 2.5-.6 3.4-1 .9-1.4 2.2-1.1 3.5.3 1.3.1 2.7-.9 3.5-1 .8-2.5.4-3.7-.3-1.1-.7-2.5-.7-3.6 0-1.2.7-2.7 1.1-3.7.3-1-.8-1.2-2.2-.9-3.5.3-1.3-.1-2.6-1.1-3.5-1-.9-2.5-.9-3.5-.1-.9.7-2.3.6-3-.3-.7-.9-.5-2.4.3-3.4 1-.9 1.4-2.2 1.1-3.5-.3-1.3.2-2.7 1.2-3.3 1.1-.6 2.5-.1 3.5.6.9.7 2.2.7 3.1 0z" fill="#22C55E" />
                    </svg>
                  )}
                  <span className="font-bold text-white ml-0.5">{rtScore}%</span>
                </span>
              )}
            </div>
          )}
        </div>
        {synopsis && <p className="text-gray-400 text-xs md:text-sm mt-1.5">{synopsis}</p>}
      </div>
    </div>
  );
}

export default memo(MediaCard, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.isFocused === next.isFocused &&
    prev.priority === next.priority &&
    prev.posterUrl === next.posterUrl &&
    prev.backdropUrl === next.backdropUrl &&
    prev.brandColor === next.brandColor &&
    prev.title === next.title
  );
});
