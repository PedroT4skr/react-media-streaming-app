import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';

const PROFILES = [
  { id: '1', name: 'Justin', avatar: '/avatar.svg' },
  { id: '2', name: 'Kids', avatar: '/avatar.svg' },
  { id: '3', name: 'kk', avatar: '/avatar.svg' },
  { id: '4', name: 'Mature', avatar: '/avatar.svg' }
];

export default function Profiles() {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const setActiveProfile = useStore(state => state.setActiveProfile);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleSelectProfile = (profile: typeof PROFILES[0]) => {
    if (selectedId) return; // Prevent double clicks
    
    setSelectedId(profile.id);
    setActiveProfile(profile.name);
    
    // Cinematic delay: wait for the pulse/scale animation before navigating
    setTimeout(() => {
      navigate('/');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#111115] text-white flex flex-col items-center justify-center select-none" style={{ fontFamily: 'NetflixSans, system-ui, sans-serif' }}>
      
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-3xl md:text-[2.5rem] font-normal mb-20 tracking-normal"
        style={{ fontFamily: 'NetflixSans, "Netflix Sans", system-ui, sans-serif' }}
      >
        Who's watching?
      </motion.h1>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
        className="flex flex-wrap justify-center gap-6 md:gap-8 max-w-4xl px-4"
      >
        {PROFILES.map((profile) => {
          const isHovered = hoveredId === profile.id;
          const isSelected = selectedId === profile.id;
          const isFaded = selectedId !== null && selectedId !== profile.id;
          
          return (
            <motion.div 
              key={profile.id}
              animate={{ 
                opacity: isFaded ? 0.3 : 1,
                scale: isSelected ? 1.15 : 1
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-4 cursor-pointer group"
              onMouseEnter={() => setHoveredId(profile.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleSelectProfile(profile)}
            >
              {/* Avatar Container */}
              <div 
                className={`relative rounded-full w-28 h-28 md:w-36 md:h-36 transition-all duration-300 ease-out flex items-center justify-center ${
                  isHovered || isSelected ? 'scale-105 ring-4 ring-white shadow-xl' : 'scale-100 ring-0 hover:ring-2 hover:ring-white/50 shadow-md'
                }`}
              >
                {/* Background mask for circular crop */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <img 
                    src={profile.avatar} 
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  {/* Subtle darkening overlay when not hovered (optional, matches Disney+ style) */}
                  <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-20'}`} />
                </div>
              </div>
              <span className={`text-base md:text-lg tracking-wide transition-colors duration-300 ${isHovered || isSelected ? 'text-white' : 'text-gray-400'}`}>
                {profile.name}
              </span>
            </motion.div>
          );
        })}

        {/* Add Profile Button */}
        <motion.div 
          animate={{ opacity: selectedId ? 0.3 : 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-4 cursor-pointer group"
          onMouseEnter={() => setHoveredId('add')}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div 
            onMouseMove={handleMouseMove}
            className={`relative overflow-hidden rounded-full w-28 h-28 md:w-36 md:h-36 transition-all duration-300 ease-out flex items-center justify-center ${
              hoveredId === 'add' ? 'scale-105 glass-button-active' : 'scale-100 glass-button-hover border border-white/10 bg-[#2a2a30]/50'
            }`}
          >
            <Plus className={`relative z-10 w-12 h-12 transition-colors duration-300 ${hoveredId === 'add' ? 'text-white' : 'text-gray-400'}`} strokeWidth={1.5} />
          </div>
          <span className={`text-base md:text-lg tracking-wide transition-colors duration-300 ${hoveredId === 'add' ? 'text-white' : 'text-gray-400'}`}>
            Add Profile
          </span>
        </motion.div>
      </motion.div>

      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: selectedId ? 0 : 1 }}
        transition={{ duration: selectedId ? 0.4 : 1, delay: selectedId ? 0 : 0.4 }}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden mt-16 px-6 md:px-8 py-3 glass-button-hover text-gray-300 hover:text-white transition-all duration-300 rounded font-medium tracking-widest text-xs md:text-sm uppercase"
      >
        <span className="relative z-10">Edit Profiles</span>
      </motion.button>
    </div>
  );
}
