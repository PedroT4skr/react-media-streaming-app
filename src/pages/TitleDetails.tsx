import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchDetails, fetchLogo, getImageUrl, fetchSeasonDetails } from '../services/tmdb';
import { Play, LayoutGrid, MessageSquare, ArrowLeft, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { PlayerContent } from './Player';

const MinimalThumbUp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 11.5L12 3c1.5 0 2 1 2 2.5 0 1.5-1.5 3-1.5 3h6.5c1 0 1.5.5 1.5 1.5s0 2.5-1 3.5c1 1 1 2.5 0 3.5.5 1 0 2.5-1.5 3H8M8 11.5v8.5M8 11.5H4.5c-.5 0-1 .5-1 1v6.5c0 .5.5 1 1 1H8" />
  </svg>
);

const MinimalThumbDown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ transform: 'scaleY(-1)' }}>
    <path d="M8 11.5L12 3c1.5 0 2 1 2 2.5 0 1.5-1.5 3-1.5 3h6.5c1 0 1.5.5 1.5 1.5s0 2.5-1 3.5c1 1 1 2.5 0 3.5.5 1 0 2.5-1.5 3H8M8 11.5v8.5M8 11.5H4.5c-.5 0-1 .5-1 1v6.5c0 .5.5 1 1 1H8" />
  </svg>
);

export default function TitleDetails() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerConfig, setPlayerConfig] = useState<{ id: string; type: string; season?: string; episode?: string } | null>(null);

  // TV Shows state
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const episodesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !type) return;
    window.scrollTo(0, 0);
    
    fetchDetails(id, type as 'movie' | 'tv').then(data => {
      setDetails(data);
    });
    
    fetchLogo(id, type as 'movie' | 'tv').then(path => {
      if (path) setLogoUrl(getImageUrl(path, 'w500'));
    });

    if (type === 'movie' && id) {
      setPlayerConfig({ id, type });
    }
  }, [id, type]);

  useEffect(() => {
    if (type === 'tv' && id) {
      fetchSeasonDetails(id, selectedSeason).then(data => {
        if (data && data.episodes) {
          setSeasonEpisodes(data.episodes);
          if (episodesContainerRef.current) {
            episodesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      });
    }
  }, [id, type, selectedSeason]);

  if (!details) {
    return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white">Loading...</div>;
  }

  const year = details.release_date?.split('-')[0] || details.first_air_date?.split('-')[0] || '';
  const category = details.genres?.[0]?.name || 'Drama';
  const duration = type === 'tv' 
    ? `${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}` 
    : `${Math.floor((details.runtime || 0) / 60)}h ${(details.runtime || 0) % 60}m`;
  
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };
  // Cast separated by space according to image
  const cast = details.credits?.cast?.slice(0, 5).map((c: any) => c.name).join(', ') || '';
  const tags = details.genres?.slice(1, 4).map((g: any) => g.name).join(', ') || '';

  const backdrop = details.backdrop_path ? getImageUrl(details.backdrop_path, 'original') : '';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="min-h-screen bg-[#0a0a0c] text-white relative overflow-hidden flex flex-col pt-24 md:pt-32"
      style={{ fontFamily: 'NetflixSans, Inter, system-ui, -apple-system, sans-serif' }}
    >
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="absolute top-8 left-8 md:top-12 md:left-12 z-50 text-white/60 hover:text-white transition-colors duration-300"
      >
        <ArrowLeft className="w-8 h-8 md:w-10 md:h-10" strokeWidth={2} />
      </button>

      {/* Background Frame */}
      <div className="absolute inset-0 z-0">
        <motion.img 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 1.2, delay: 0.2 }}
          src={backdrop} 
          alt="Background" 
          className="w-full h-full object-cover object-top"
        />
        {/* Soft dark gradient on the left side to make text readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent z-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent z-0" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0c]/90 via-transparent to-transparent z-0" />
      </div>

      {/* Main Content Area (Split for TV Shows) */}
      <div className="relative z-10 flex w-full">
        {/* Left Side: Metadata and Actions */}
        <div className={`px-12 md:pl-32 pr-8 w-full ${type === 'tv' ? 'md:w-[45%]' : 'md:w-[65%]'} flex flex-col gap-6`}>
        

        {/* Title Logo or Text */}
        {logoUrl ? (
          <img src={logoUrl} alt={details.title || details.name} className="max-h-[60px] md:max-h-[90px] object-contain object-left" />
        ) : (
          <h1 className="text-4xl md:text-6xl font-black mb-2">{details.title || details.name}</h1>
        )}

        {/* Metadata */}
        <div className="flex items-center flex-wrap gap-2 md:gap-3 text-base md:text-xl text-gray-400">
          <span>{year}</span>
          <span className="w-1 h-1 bg-gray-500 rounded-full" />
          <span>{category}</span>
          <span className="border border-white/30 px-1 text-[11px] font-bold rounded text-white/70 ml-1">TV-MA</span>
          <span>{duration}</span>
          <span className="border border-white/30 px-1 text-[11px] font-bold rounded text-white/70">HD</span>
          <span className="border border-white/30 px-1 text-[11px] font-bold rounded text-white/70">AD</span>
          <MessageSquare className="w-4 h-4 text-white/70" />
        </div>

        {/* Synopsis */}
        <p className="text-base md:text-xl text-white/95 leading-relaxed drop-shadow-md max-w-[95%]">
          {details.overview}
        </p>

        {/* Cast & Tags */}
        <div className="text-sm md:text-lg text-gray-400 flex flex-col gap-1.5 drop-shadow-md mt-1 leading-relaxed">
          {cast && <p>Cast: <span className="text-gray-500">{cast}</span></p>}
          {tags && <p>{tags}</p>}
        </div>

        {/* Rating Actions */}
        <div className="flex gap-8 mt-2 mb-2 pl-4 md:pl-8">
          <button className="hover:text-white text-gray-300 transition hover:scale-110 active:scale-95">
            <MinimalThumbDown className="w-6 h-6 md:w-7 md:h-7" />
          </button>
          <button className="hover:text-white text-gray-300 transition hover:scale-110 active:scale-95">
            <MinimalThumbUp className="w-6 h-6 md:w-7 md:h-7" />
          </button>
          <button className="hover:text-white text-gray-300 transition relative hover:scale-110 active:scale-95">
            <MinimalThumbUp className="w-6 h-6 md:w-7 md:h-7" />
            <MinimalThumbUp className="w-6 h-6 md:w-7 md:h-7 absolute top-0 -left-1.5" />
          </button>
        </div>

        {/* Clickable Options */}
        <div className="flex flex-col gap-4 mt-4 pl-4 md:pl-8">
          {type === 'movie' && (
            <button 
              className="flex items-center justify-center gap-4 text-lg md:text-xl font-bold text-white transition group glass-button-active px-8 py-3 rounded-full w-fit"
              onMouseMove={handleMouseMove}
              onClick={() => {
                if (type === 'movie' && id) {
                  setPlayerConfig({ id, type });
                  setIsPlayerOpen(true);
                }
              }}
            >
              <Play className="w-6 h-6 md:w-7 md:h-7 fill-white group-hover:scale-110 transition-transform" />
              Play
            </button>
          )}

          <button 
            className="flex items-center gap-4 text-lg md:text-xl font-medium text-white/80 hover:text-white transition group glass-button-hover px-6 py-3 rounded-full w-fit"
            onMouseMove={handleMouseMove}
          >
            <Play className="w-6 h-6 md:w-7 md:h-7 fill-white/80 group-hover:fill-white group-hover:scale-110 transition-all" />
            Play Trailer
          </button>
          <button 
            className="flex items-center gap-4 text-lg md:text-xl font-medium text-white/80 hover:text-white transition group glass-button-hover px-6 py-3 rounded-full w-fit"
            onMouseMove={handleMouseMove}
          >
            <LayoutGrid className="w-6 h-6 md:w-7 md:h-7 group-hover:scale-110 transition-transform" />
            More Like This
          </button>
          <button 
            className="flex items-center gap-4 text-lg md:text-xl font-medium text-white/80 hover:text-white transition group glass-button-hover px-6 py-3 rounded-full w-fit"
            onMouseMove={handleMouseMove}
          >
            <MessageSquare className="w-6 h-6 md:w-7 md:h-7 group-hover:scale-110 transition-transform" />
            Audio & Subtitles
          </button>
        </div>

        </div>


        {/* Right Side: Episodes List (Only for TV) */}
        {type === 'tv' && (
          <div className="hidden md:flex flex-col w-[50%] ml-auto h-[85vh] pr-12">
            <div className="mb-6 h-16 relative z-50">
              {details?.number_of_seasons > 1 ? (
                <motion.div 
                  className={`absolute top-0 left-0 w-80 overflow-hidden transition-all duration-300 rounded-3xl ${isSeasonDropdownOpen ? 'bg-[#18181b] border border-white/10 shadow-2xl' : 'glass-button-hover'}`}
                  onMouseMove={handleMouseMove}
                >
                  <button 
                    className="flex items-center justify-between w-full gap-4 text-3xl font-bold text-white px-6 py-4 whitespace-nowrap"
                    onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                  >
                    <span>Season {selectedSeason}</span>
                    <ChevronDown className={`w-8 h-8 shrink-0 transition-transform ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {isSeasonDropdownOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col pb-2"
                      >
                        {(details.seasons || [])
                          .filter((season: any) => season.season_number > 0 && season.episode_count > 0)
                          .filter((season: any) => season.season_number !== selectedSeason)
                          .map((season: any) => (
                          <button
                            key={season.season_number}
                            onClick={() => {
                              setSelectedSeason(season.season_number);
                              setIsSeasonDropdownOpen(false);
                            }}
                            className="w-full text-left px-6 py-3 transition-colors text-xl text-white/40 hover:text-white"
                          >
                            Season {season.season_number}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="text-3xl font-bold text-white px-6 py-4 whitespace-nowrap drop-shadow-lg">
                  Season 1
                </div>
              )}
            </div>
            
            <div ref={episodesContainerRef} className="flex flex-col gap-6 pb-20 px-2 overflow-y-auto custom-scrollbar flex-1 relative z-10">
              {seasonEpisodes.map((ep, index) => (
                <div 
                  key={ep.id} 
                  className="flex gap-6 group hover:bg-black/60 p-4 rounded-3xl transition-all duration-300 cursor-pointer"
                  onClick={() => {
                    setPlayerConfig({ id: id as string, type: 'tv', season: selectedSeason.toString(), episode: ep.episode_number.toString() });
                    setIsPlayerOpen(true);
                  }}
                >
                  <div className="relative w-64 aspect-video rounded-xl overflow-hidden shrink-0 bg-zinc-900 shadow-2xl">
                    {ep.still_path ? (
                      <img src={getImageUrl(ep.still_path, 'w500')} alt={ep.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">No Image</div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-150" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 group-hover:scale-110">
                      <div className="bg-black/60 p-4 rounded-full shadow-2xl ring-1 ring-white/20">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <h4 className="text-white font-bold text-xl leading-tight mb-2 group-hover:text-white drop-shadow-md transition-colors line-clamp-2">
                      {index + 1}. {ep.name}
                    </h4>
                    <p className="text-white/60 text-base line-clamp-3 leading-relaxed">
                      {ep.overview || "Nenhuma sinopse disponível."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {playerConfig && (
        <PlayerContent 
          id={playerConfig.id}
          type={playerConfig.type}
          season={playerConfig.season}
          episode={playerConfig.episode}
          isHidden={!isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
        />
      )}
    </motion.div>
  );
}
