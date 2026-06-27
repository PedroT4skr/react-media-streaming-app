import { Search, ChevronDown } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useStore } from '../../store/useStore';
import { motion } from 'framer-motion';
import { STREAMING_PROVIDERS } from '../../services/tmdb';
import { useState, useEffect, startTransition } from 'react';

function getDynamicLogoGradient(hexColor: string | null): string {
  if (!hexColor || hexColor === '#000000' || hexColor === '#000') {
    return 'linear-gradient(to right, #9e00ff, #e4a6ff)';
  }

  // Parse HSL from Home.tsx heroColor
  const hslMatch = hexColor.match(/hsl\(\s*(\d+)\s*,\s*\d+%\s*,\s*\d+%\s*\)/i);
  if (hslMatch) {
    const hueDegrees = parseInt(hslMatch[1], 10);
    const startColor = `hsl(${hueDegrees}, 100%, 60%)`;
    const endColor = `hsl(${hueDegrees}, 95%, 82%)`;
    return `linear-gradient(to right, ${startColor}, ${endColor})`;
  }

  const match = hexColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return 'linear-gradient(to right, #9e00ff, #e4a6ff)';
  
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }

  const hueDegrees = Math.round(h * 360);
  const startColor = `hsl(${hueDegrees}, 100%, 60%)`;
  const endColor = `hsl(${hueDegrees}, 95%, 82%)`;

  return `linear-gradient(to right, ${startColor}, ${endColor})`;
}

export default function FloatingNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activePath, setActivePath] = useState(location.pathname);


  // Sync active path with browser history (back/forward buttons)
  useEffect(() => {
    setActivePath(location.pathname);
  }, [location.pathname]);

  const isScrolled = useStore((state) => state.isScrolled);
  const heroColor = useStore((state) => state.heroColor);
  const activeProvider = useStore((state) => state.activeProvider);
  const setIsTraktAuthModalOpen = useStore((state) => state.setIsTraktAuthModalOpen);

  // Use the provider brand color if we are on the Discover page, otherwise use the Hero background extraction
  const displayColor = location.pathname.startsWith('/discover')
    ? STREAMING_PROVIDERS[activeProvider as keyof typeof STREAMING_PROVIDERS]?.color || null
    : heroColor;

  const dynamicGradient = getDynamicLogoGradient(displayColor);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Discover', path: '/discover' },
    { name: 'Shows', path: '/discover/shows' },
    { name: 'Movies', path: '/discover/movies' },
    { name: 'My Netflix', path: '/discover/library' },
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  if (
    location.pathname === '/login' || 
    location.pathname === '/profiles' || 
    location.pathname.startsWith('/title/') ||
    location.pathname.startsWith('/player/')
  ) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 w-full flex items-center justify-between pl-12 pr-[calc(3rem+16px)] py-8 bg-transparent z-50">
      {/* Left side: Profile */}
      <div 
        onMouseMove={handleMouseMove}
        onClick={() => setIsTraktAuthModalOpen(true)}
        className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-full border border-transparent transition-all duration-300 glass-button-hover"
      >
        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center relative overflow-hidden transition-all">
           {/* Mocking the red smiley profile pic */}
           <div className="w-5 h-1 bg-black rounded-full mt-3"></div>
           <div className="w-2 h-2 bg-black rounded-full absolute -ml-2.5 -mt-1.5"></div>
           <div className="w-2 h-2 bg-black rounded-full absolute ml-2.5 -mt-1.5"></div>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400 transition-colors" />
      </div>

      {/* Center: Navigation Links */}
      <div className="flex items-center gap-10 text-gray-300 font-medium">
        <Link to="/search" className="hover:text-white transition-colors">
          <Search className="w-7 h-7" />
        </Link>
        <div className="flex items-center gap-3">
          {navLinks.map((link) => {
            const isActive = activePath === link.path;
            return (
              <a
                key={link.name}
                href={link.path}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isActive) {
                    // 1. Atualização Urgente: Move a pílula animada na hora, a 60fps
                    setActivePath(link.path);
                    // 2. Atraso Cinemático: Espera a pílula cruzar a tela antes de forçar o navegador a destruir a página atual (Main Thread Block)
                    setTimeout(() => {
                      startTransition(() => {
                        navigate(link.path);
                      });
                    }, 250);
                  } else {
                    // Se a aba já está ativa, rola suavemente para o topo do contêiner
                    const container = document.getElementById('main-scroll-container');
                    if (container) {
                      container.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }
                }}
                onMouseMove={handleMouseMove}
                className={clsx(
                  'relative px-6 py-2.5 rounded-full text-base md:text-lg transition-all duration-300 font-medium border border-transparent',
                  isActive
                    ? 'text-white'
                    : 'text-gray-300 glass-button-hover'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-bg"
                    className="absolute inset-0 glass-button-active rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                <span className="relative z-10">{link.name}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Right side: Logo */}
      <Link 
        to="/" 
        className="relative text-4xl select-none inline-block" 
        style={{ fontFamily: '"Rekalgera-Regular", "Rekalgera", sans-serif' }}
      >
        <span 
          className="bg-gradient-to-r from-[#9e00ff] to-[#e4a6ff] bg-clip-text text-transparent transition-opacity duration-500 ease-in-out block"
          style={{ 
            opacity: (!displayColor || (isScrolled && !location.pathname.startsWith('/discover'))) ? 1 : 0 
          }}
        >
          Stremio
        </span>
        {displayColor && (
          <motion.span 
            className="absolute inset-0 bg-clip-text text-transparent block"
            initial={false}
            animate={{ 
              backgroundImage: dynamicGradient,
              opacity: (isScrolled && !location.pathname.startsWith('/discover')) ? 0 : 1 
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            Stremio
          </motion.span>
        )}
      </Link>
    </nav>
  );
}
