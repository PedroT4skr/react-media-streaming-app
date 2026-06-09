import { create } from 'zustand';
import type { StreamingProviderKey } from '../services/tmdb';

interface AppState {
  activeProfile: string | null;
  userLibrary: string[]; // array of media IDs
  currentlyPlaying: string | null;
  isScrolled: boolean;
  heroColor: string | null;
  globalFocusedId: string | number | null;
  activeProvider: StreamingProviderKey;
  activeDiscoverFilter: string;
  setActiveProfile: (profile: string) => void;
  addToLibrary: (id: string) => void;
  removeFromLibrary: (id: string) => void;
  setCurrentlyPlaying: (id: string | null) => void;
  setIsScrolled: (scrolled: boolean) => void;
  setHeroColor: (color: string | null) => void;
  setGlobalFocusedId: (id: string | number | null) => void;
  setActiveProvider: (provider: StreamingProviderKey) => void;
  setActiveDiscoverFilter: (filter: string) => void;
  traktAccessToken: string | null;
  isTraktAuthModalOpen: boolean;
  globalTraktContinueWatching: any[] | null;
  isGlobalTraktLoading: boolean;
  setTraktAccessToken: (token: string | null) => void;
  setIsTraktAuthModalOpen: (isOpen: boolean) => void;
  setGlobalTraktContinueWatching: (data: any[] | null) => void;
  setIsGlobalTraktLoading: (isLoading: boolean) => void;
  pageScrollY: number;
  carouselScrollPositions: Record<string, number>;
  setPageScrollY: (y: number) => void;
  setCarouselScrollPosition: (id: string, x: number) => void;
}

export const useStore = create<AppState>((set) => ({
  activeProfile: 'Default',
  userLibrary: [],
  currentlyPlaying: null,
  isScrolled: false,
  heroColor: null,
  globalFocusedId: null,
  activeProvider: 'netflix',
  activeDiscoverFilter: 'all',
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  addToLibrary: (id) => set((state) => ({ userLibrary: [...state.userLibrary, id] })),
  removeFromLibrary: (id) => set((state) => ({ userLibrary: state.userLibrary.filter(item => item !== id) })),
  setCurrentlyPlaying: (id) => set({ currentlyPlaying: id }),
  setIsScrolled: (scrolled) => set({ isScrolled: scrolled }),
  setHeroColor: (color) => set({ heroColor: color }),
  setGlobalFocusedId: (id) => set({ globalFocusedId: id }),
  setActiveProvider: (provider) => set({ activeProvider: provider }),
  setActiveDiscoverFilter: (filter) => set({ activeDiscoverFilter: filter }),
  traktAccessToken: localStorage.getItem('traktAccessToken') || null,
  isTraktAuthModalOpen: false,
  globalTraktContinueWatching: (() => {
    try {
      const cached = localStorage.getItem('trakt_cw_cache');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  })(),
  isGlobalTraktLoading: false,
  setTraktAccessToken: (token) => {
    if (token) localStorage.setItem('traktAccessToken', token);
    else localStorage.removeItem('traktAccessToken');
    set({ traktAccessToken: token, globalTraktContinueWatching: null });
  },
  setIsTraktAuthModalOpen: (isOpen) => set({ isTraktAuthModalOpen: isOpen }),
  setGlobalTraktContinueWatching: (data) => {
    try {
      if (data) localStorage.setItem('trakt_cw_cache', JSON.stringify(data));
      else localStorage.removeItem('trakt_cw_cache');
    } catch (e) { console.error('Failed to cache Trakt CW', e); }
    set({ globalTraktContinueWatching: data });
  },
  setIsGlobalTraktLoading: (isLoading) => set({ isGlobalTraktLoading: isLoading }),
  pageScrollY: 0,
  carouselScrollPositions: {},
  setPageScrollY: (y) => set({ pageScrollY: y }),
  setCarouselScrollPosition: (id, x) => set((state) => ({ 
    carouselScrollPositions: { ...state.carouselScrollPositions, [id]: x } 
  })),
}));
