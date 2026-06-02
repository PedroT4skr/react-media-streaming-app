import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MediaCarousel from '../components/media/MediaCarousel';
import Top10Carousel from '../components/media/Top10Carousel';
import {
  getImageUrl,
  fetchDiscoverByProvider,
  fetchRecentByProviderData,
  fetchUpcomingByProviderData,
  STREAMING_PROVIDERS,
  TMDB_GENRE_IDS,
  type StreamingProviderKey,
} from '../services/tmdb';
import { useStore } from '../store/useStore';

// ─── Streaming Provider Brand Logos (Real SVG/PNG assets) ────────────────────

const PROVIDER_LOGO_URLS: Record<StreamingProviderKey, string> = {
  netflix:   'https://images.ctfassets.net/y2ske730sjqp/821Wg4N9hJD8vs5FBcCGg/9eaf66123397cc61be14e40174123c40/Vector__3_.svg?w=460',
  prime:     'https://upload.wikimedia.org/wikipedia/commons/9/90/Prime_Video_logo_%282024%29.svg',
  disney:    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/960px-Disney%2B_logo.svg.png',
  apple:     'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
  hbo:       'https://upload.wikimedia.org/wikipedia/commons/b/b3/HBO_Max_%282025%29.svg',
  paramount: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg',
  crunchyroll: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Crunchyroll.svg',
  hulu:      'https://upload.wikimedia.org/wikipedia/commons/f/f9/Hulu_logo_%282018%29.svg',
};

// ─── Smart Filter Definitions ────────────────────────────────────────────────

interface SmartFilter {
  label: string;
  genreId?: number;
  sortBy?: string;
  type?: 'movie' | 'tv' | 'both';
}

const SMART_FILTERS: SmartFilter[] = [
  { label: 'All',           sortBy: 'popularity.desc' },
  { label: 'Critically Acclaimed', sortBy: 'vote_average.desc' },
  { label: 'New Releases',  sortBy: 'primary_release_date.desc' },
  { label: 'Action',        genreId: 28 },
  { label: 'Comedy',        genreId: 35 },
  { label: 'Drama',         genreId: 18 },
  { label: 'Thriller',      genreId: 53 },
  { label: 'Horror',        genreId: 27 },
  { label: 'Sci-Fi',        genreId: 878 },
  { label: 'Romance',       genreId: 10749 },
  { label: 'Animation',     genreId: 16 },
  { label: 'Documentary',   genreId: 99 },
  { label: 'Crime',         genreId: 80 },
  { label: 'Fantasy',       genreId: 14 },
];

const TRAKT_GENRE_MAP: Record<number, string> = {
  28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy', 80: 'crime',
  99: 'documentary', 18: 'drama', 10751: 'family', 14: 'fantasy', 36: 'history',
  27: 'horror', 10402: 'music', 9648: 'mystery', 10749: 'romance', 878: 'science-fiction',
  53: 'thriller', 10752: 'war', 37: 'western'
};

// ─── TMDB Genre Map ──────────────────────────────────────────────────────────

const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Discover() {
  const storeSetIsScrolled = useStore(state => state.setIsScrolled);
  const setPageScrollY = useStore(state => state.setPageScrollY);
  const pageScrollY = useStore(state => state.pageScrollY);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const isRestoringRef = useRef(pageScrollY > 0);

  // Active streaming provider & filter
  const activeProvider = useStore(state => state.activeProvider);
  const setActiveProvider = useStore(state => state.setActiveProvider);
  const activeDiscoverFilterLabel = useStore(state => state.activeDiscoverFilter);
  const setActiveDiscoverFilterLabel = useStore(state => state.setActiveDiscoverFilter);
  const activeFilter = useMemo(() => SMART_FILTERS.find(f => f.label === activeDiscoverFilterLabel) || SMART_FILTERS[0], [activeDiscoverFilterLabel]);

  // Data buckets
  const [popularMovies, setPopularMovies] = useState<any[]>([]);
  const [popularSeries, setPopularSeries] = useState<any[]>([]);
  const [top10Movies, setTop10Movies] = useState<any[]>([]);
  const [top10Series, setTop10Series] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [emBreve, setEmBreve] = useState<any[]>([]);
  const [providerOriginals, setProviderOriginals] = useState<any[]>([]);
  const [animeOscars, setAnimeOscars] = useState<any[]>([]);
  const [thematicLists, setThematicLists] = useState<{title: string, items: any[]}[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const isRestoring = parseInt(sessionStorage.getItem('stremio_scroll') || '0', 10) > 0 || !!useStore.getState().globalFocusedId;
  const [isHidingScroll, setIsHidingScroll] = useState(isRestoring);
  const [isSnappingDisabled, setIsSnappingDisabled] = useState(isRestoring);
  const [isTransitioning, setIsTransitioning] = useState(!isRestoring);

  // Derived accent color from active provider
  const baseColor = STREAMING_PROVIDERS[activeProvider].color;
  const providerName = STREAMING_PROVIDERS[activeProvider].name;
  
  let accentColor = baseColor;
  if (activeProvider === 'disney') accentColor = '#00E5FF';
  if (activeProvider === 'hbo') accentColor = '#B21FFF';
  if (activeProvider === 'apple') accentColor = '#ffffff';

  // Reset scroll state on unmount and handle transition timing
  useEffect(() => {
    if (isRestoring) {
      setIsTransitioning(false);
    }
    const timer = setTimeout(() => setIsTransitioning(false), 500); // 500ms to allow layoutId crossfade to finish
    return () => { 
      storeSetIsScrolled(false); 
      clearTimeout(timer);
    };
  }, [storeSetIsScrolled, setPageScrollY]);

  // Restore scroll
  useEffect(() => {
    const savedScrollY = parseInt(sessionStorage.getItem('stremio_scroll') || '0', 10);
    
    if (!containerRef.current || savedScrollY === 0) {
      setIsHidingScroll(false);
      const timeout = setTimeout(() => { 
        setIsSnappingDisabled(false);
        isRestoringRef.current = false; 
      }, 1500);
      return () => clearTimeout(timeout);
    }
    
    const tryScroll = setInterval(() => {
      // O DOM precisa ter altura suficiente (Posição Y + Altura da Janela) para o navegador fisicamente permitir o scroll
      const minRequiredHeight = savedScrollY + (containerRef.current?.clientHeight || window.innerHeight);
      
      if (containerRef.current && containerRef.current.scrollHeight >= minRequiredHeight) {
        containerRef.current.scrollTo({ top: savedScrollY, behavior: 'auto' });
        scrollPosRef.current = savedScrollY;
        clearInterval(tryScroll);
        setIsHidingScroll(false);
        setTimeout(() => { 
          setIsSnappingDisabled(false);
          isRestoringRef.current = false; 
        }, 1500); // Mantém snap-none por 1.5s para evitar que APIS carregando deem shift no layout e forcem o scroll pro topo
        sessionStorage.removeItem('stremio_scroll');
      }
    }, 50);

    const safety = setTimeout(() => {
      clearInterval(tryScroll);
      containerRef.current?.scrollTo({ top: savedScrollY, behavior: 'auto' }); // Fallback force scroll
      setIsHidingScroll(false);
      setIsSnappingDisabled(false);
      isRestoringRef.current = false;
      sessionStorage.removeItem('stremio_scroll');
    }, 3000);

    return () => {
      clearInterval(tryScroll);
      clearTimeout(safety);
    };
  }, []);

  // ─── Data Fetching (debounced on provider/filter change) ─────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    // Clear previous data immediately for a clean transition
    setPopularMovies([]);
    setPopularSeries([]);
    setTop10Movies([]);
    setTop10Series([]);
    setLancamentos([]);
    setEmBreve([]);
    setThematicLists([]);
    setProviderOriginals([]);
    setAnimeOscars([]);

    const load = async () => {
      let animeOscarsTemp: any[] = [];
      const providerData = STREAMING_PROVIDERS[activeProvider];
        const providerId = providerData.id;
        const networkId = providerData.networkId;
        const companyId = providerData.companyId;
        const genreId = activeFilter.genreId;
        const sortBy = activeFilter.sortBy || 'popularity.desc';
        
        const genreParam = genreId ? genreId : undefined;

        const isCriticallyAcclaimed = activeFilter.label === 'All' || activeFilter.label === 'Critically Acclaimed';
        const actualSortBy = isCriticallyAcclaimed ? 'vote_average.desc' : sortBy;
        const extraParams = isCriticallyAcclaimed ? '&vote_count.gte=3000&vote_average.gte=7.6' : '';

        const fetchPromises = [
          fetchDiscoverByProvider(providerId, 'movie', 1, genreParam, actualSortBy, extraParams),
          fetchDiscoverByProvider(providerId, 'tv', 1, genreParam, actualSortBy, extraParams),
        ];

        let hasOriginals = false;
        if (['netflix', 'prime', 'disney', 'apple', 'crunchyroll'].includes(activeProvider) && activeFilter.label === 'All') {
          hasOriginals = true;
          
          let movieCompanies = '';
          if (activeProvider === 'netflix') movieCompanies = '213|420';
          if (activeProvider === 'prime') movieCompanies = '20580|1024';
          if (activeProvider === 'apple') movieCompanies = '137834|2552';
          if (activeProvider === 'disney') movieCompanies = '2|3|1|420|2739';
          if (activeProvider === 'crunchyroll') movieCompanies = '1112';

          fetchPromises.push(
            fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', `&with_companies=${movieCompanies}`).then(res => res.map(i => ({...i, media_type: 'movie'})))
          );
          fetchPromises.push(
            fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', `&with_networks=${networkId}`).then(res => res.map(i => ({...i, media_type: 'tv'})))
          );
        }

        const results = await Promise.all(fetchPromises);

        if (cancelled) return;
        setPopularMovies(results[0]);
        setPopularSeries(results[1]);
        
        if (hasOriginals) {
           const combinedOriginals = [...results[2], ...results[3]].sort((a,b) => b.popularity - a.popularity);
           setProviderOriginals(combinedOriginals);
        }
        
        setIsLoading(false);

      // Deferred: Top 10 lists (Most Watched)
      const top10MovieExtraParams = (genreParam == 99 || genreParam == '99') ? '' : '&without_genres=99';
      
      const [t10m, t10s] = await Promise.all([
        fetchDiscoverByProvider(providerId, 'movie', 1, genreParam, 'popularity.desc', top10MovieExtraParams).then(res => res.slice(0, 10)),
        fetchDiscoverByProvider(providerId, 'tv', 1, genreParam, 'popularity.desc').then(res => res.slice(0, 10)),
      ]);
      if (cancelled) return;
      setTop10Movies(t10m);
      setTop10Series(t10s);
      
      // Deferred: Extra thematic genre lists only if 'All' is selected to avoid bottleneck
      if (activeFilter.label === 'All') {
        setTimeout(async () => {
          if (cancelled) return;
          const todayObj = new Date();
          const today = todayObj.toISOString().split('T')[0];
          
          const [lancamentosList, embreveList] = await Promise.all([
             fetchRecentByProviderData(networkId, companyId),
             fetchUpcomingByProviderData(networkId, companyId)
          ]);

          let customThematic = [];
          
          if (activeProvider === 'disney') {
             const [
               marvelM, marvelS, lucasfilmM, lucasfilmS, pixar, natgeo,
               dcomList, musicalsList, handDrawnList, spookyList
             ] = await Promise.all([
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_companies=420'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_companies=420'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_companies=1'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_companies=1'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_companies=3'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_companies=7521|4366'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_networks=54'), // Disney Channel
               fetchDiscoverByProvider(providerId, 'movie', 1, '10402', 'popularity.desc', '&with_keywords=4344'), // Musicals
               fetchDiscoverByProvider(providerId, 'movie', 1, '16', 'popularity.desc', '&with_keywords=3100'), // 2D Classics
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_keywords=3335|3272|3133'), // Spooks
             ]);

             const marvel = [...marvelM, ...marvelS].sort((a,b) => b.popularity - a.popularity);
             const lucasfilm = [...lucasfilmM, ...lucasfilmS].sort((a,b) => b.popularity - a.popularity);

             const nonSW = ['indiana jones', 'raiders of the lost ark', 'willow', 'labyrinth', 'howard the duck', 'american graffiti', 'red tails', 'tucker: the man and his dream', 'radioland murders', 'strange magic'];
             const isStarWars = (item: any) => {
               const title = (item.title || item.name || '').toLowerCase();
               return !nonSW.some(kw => title.includes(kw));
             };

             const starwars = lucasfilm.filter(isStarWars);

             customThematic = [
                { title: "Nostalgia Session: Disney Channel Golden Age", items: dcomList },
                { title: "Let it Go: The Great Musicals", items: musicalsList },
                { title: "Hand-Drawn Magic: 2D Classics", items: handDrawnList },
                { title: "Family Spooks: Witches, Monsters & Magic", items: spookyList },
                { title: "Marvel Cinematic Universe", items: marvel },
                { title: "Star Wars", items: starwars },
                { title: "Pixar Animation Studios", items: pixar },
                { title: "National Geographic", items: natgeo }
             ];
          } else if (activeProvider === 'crunchyroll') {
             // Calculate Current Anime Season
             const currentDate = new Date();
             const month = currentDate.getMonth();
             const year = currentDate.getFullYear();
             let seasonName = '';
             let startDate = '';
             let endDate = '';
             if (month >= 0 && month <= 2) {
                seasonName = 'Winter';
                startDate = `${year}-01-01`; endDate = `${year}-03-31`;
             } else if (month >= 3 && month <= 5) {
                seasonName = 'Spring';
                startDate = `${year}-04-01`; endDate = `${year}-06-30`;
             } else if (month >= 6 && month <= 8) {
                seasonName = 'Summer';
                startDate = `${year}-07-01`; endDate = `${year}-09-30`;
             } else {
                seasonName = 'Fall';
                startDate = `${year}-10-01`; endDate = `${year}-12-31`;
             }
             const seasonFilter = `&first_air_date.gte=${startDate}&first_air_date.lte=${endDate}`;

             const [seasonList, mappaList, ufotableList, bonesList, psychologicalList, awardsList, seinenList, shounenList, shoujoList, iyashikeiList, isekaiList, spokonList, mechaList, cyberpunkList, marathonList] = await Promise.all([
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', seasonFilter),
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_companies=55931'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_companies=4181'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_companies=5937'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '16,18', 'vote_average.desc', '&vote_count.gte=300&without_genres=35,28'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'vote_average.desc', '&vote_count.gte=2000'), // Oscars proxy
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=10836'), // Seinen
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=6075'), // Shounen
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=1974|228964'), // Shoujo & Josei
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=338600'), // Iyashikei
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=280173'), // Isekai
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=295055|6027'), // Spokon (Sports)
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=855'), // Mecha
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_keywords=4565|10852'), // Cyberpunk/Dystopia
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'vote_average.desc', '&with_status=3&vote_count.gte=500'), // Marathon (Ended & Good)
             ]);
             
             animeOscarsTemp = awardsList;
             
             customThematic = [
                { title: `Season Guide: ${seasonName} ${year}`, items: seasonList },
                { title: "Eye-Catching Visuals (Ufotable)", items: ufotableList },
                { title: "MAPPA's Midas Touch", items: mappaList },
                { title: "The Classic Bones Studio", items: bonesList },
                { title: "Psychological Triggers & Deep Drama", items: psychologicalList },
                { title: "Seinen: Mature & Complex Storylines", items: seinenList },
                { title: "The Hero's Journey: Best of Shounen", items: shounenList },
                { title: "Shoujo & Josei: Romance & Deep Drama", items: shoujoList },
                { title: "Spokon: Blood, Sweat & Competition", items: spokonList },
                { title: "Mecha: The Era of Giant Robots", items: mechaList },
                { title: "Isekai: Trapped in Another World", items: isekaiList },
                { title: "Dystopian Future & Cyberpunk", items: cyberpunkList },
                { title: "Iyashikei: Relax & Cleanse Your Soul", items: iyashikeiList },
                { title: "Weekend Marathon: Short & Completed", items: marathonList }
             ];
          } else if (activeProvider === 'hbo') {
             const [
               prestigeTV, dcMovie, dcTV, adultSwim, cultsScandals, 
               fantasyMovie, fantasyTV, realityChaos, sitcoms, blockbusters
             ] = await Promise.all([
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_networks=49'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_companies=429'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_companies=429'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_networks=80'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '99', 'popularity.desc', '&with_keywords=212457|15174|10408'),
               fetchDiscoverByProvider(providerId, 'movie', 1, '14', 'popularity.desc', '&with_keywords=13054|818|4152'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '10765', 'popularity.desc', '&with_keywords=13054|818|4152'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '10764', 'popularity.desc', '&with_networks=66|143|222'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '35', 'popularity.desc', '&with_runtime.lte=30'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'revenue.desc', '&with_companies=174'),
             ]);

             const dcUniverse = [...dcMovie, ...dcTV].sort((a,b) => b.popularity - a.popularity);
             const fantasyEpics = [...fantasyMovie, ...fantasyTV].sort((a,b) => b.popularity - a.popularity);

             customThematic = [
                { title: "HBO Seal: Prestige TV", items: prestigeTV },
                { title: "Thirst for Justice: The DC Universe", items: dcUniverse },
                { title: "Popcorn Session: Warner Blockbusters", items: blockbusters },
                { title: "Dragons, Magic & Rings: Fantasy Epics", items: fantasyEpics },
                { title: "Late Night Binge: Adult Swim", items: adultSwim },
                { title: "Guaranteed Laughs: Greatest TV Sitcoms", items: sitcoms },
                { title: "The Dark Truth: Cults & Scandals", items: cultsScandals },
                { title: "The New Max: Reality TV & Chaotic Lives", items: realityChaos }
             ];
          } else {
             const [
               crimeList, animesList, miniseriesList, booksListMovie, booksListTV, dystopiaList, 
               kDramasList, sitcomsList, mindBendingList, standupList, classicList, survivalList
             ] = await Promise.all([
               fetchDiscoverByProvider(providerId, 'tv', 1, '99,80', 'popularity.desc', '&with_keywords=210024|10714'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '16', 'popularity.desc', '&with_original_language=ja'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_type=4'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_keywords=818|9717'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_keywords=818|9717'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_keywords=4565|10852|4563'),
               fetchDiscoverByProvider(providerId, 'tv', 1, undefined, 'popularity.desc', '&with_origin_country=KR'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '35', 'popularity.desc', '&with_runtime.lte=25&with_keywords=9716'),
               fetchDiscoverByProvider(providerId, 'tv', 1, '9648', 'popularity.desc', '&with_keywords=4379|162326'),
               fetchDiscoverByProvider(providerId, 'movie', 1, '35', 'popularity.desc', '&with_keywords=156828'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'vote_average.desc', '&primary_release_date.lte=1999-12-31&vote_count.gte=1000'),
               fetchDiscoverByProvider(providerId, 'movie', 1, undefined, 'popularity.desc', '&with_keywords=12377|229819|10349'),
             ]);
             
             const booksList = [...booksListMovie, ...booksListTV].sort((a,b) => b.popularity - a.popularity);
             
             customThematic = [
                { title: "Dark Investigation: True Crime & Real Cases", items: crimeList },
                { title: "Quick Binge: Limited Series", items: miniseriesList },
                { title: "Korean Fever: Best K-Dramas", items: kDramasList },
                { title: "From Page to Screen: Book Adaptations", items: booksList },
                { title: "Dystopia & Algorithms", items: dystopiaList },
                { title: "Dinner Time: Short Sitcoms", items: sitcomsList },
                { title: "Mind-Bending: Plot Twists", items: mindBendingList },
                { title: "Survival & Chaos", items: survivalList },
                { title: "Original Anime", items: animesList },
                { title: "Stand-up Comedy: Laugh Out Loud", items: standupList },
                { title: "Time Machine: Cult Classics", items: classicList }
             ];
          }
          
          if (!cancelled) {
             setLancamentos(lancamentosList);
             setEmBreve(embreveList);
             setAnimeOscars(animeOscarsTemp);
             setThematicLists(customThematic);
          }
        }, isRestoring ? 0 : 450); // Delay for initial render performance
      }
    };

    // 100ms debounce to batch rapid filter clicks
    const timer = setTimeout(load, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeProvider, activeFilter]);

  // ─── Vertical Snap Scroll (identical to Home) ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        if (!isScrolling) {
          isScrolling = true;
          const direction = Math.sign(e.deltaY);
          const snapPoints = Array.from(container.querySelectorAll('[data-vertical-snap="true"]')) as HTMLElement[];
          const currentScroll = container.scrollTop;

          const getTargetScroll = (el: HTMLElement) => {
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const absoluteTop = container.scrollTop + (elRect.top - containerRect.top);
            return absoluteTop - 108; // Hardcoded scroll-mt-[108px]
          };

          let currentIdx = 0;
          let minDiff = Infinity;
          snapPoints.forEach((el, idx) => {
            const diff = Math.abs(getTargetScroll(el) - currentScroll);
            if (diff < minDiff) { minDiff = diff; currentIdx = idx; }
          });

          const nextIdx = direction > 0
            ? Math.min(currentIdx + 1, snapPoints.length - 1)
            : Math.max(currentIdx - 1, 0);

          container.scrollTo({ top: getTargetScroll(snapPoints[nextIdx]), behavior: 'smooth' });
          scrollTimeout = setTimeout(() => { isScrolling = false; }, 400);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => { container.removeEventListener('wheel', handleWheel); clearTimeout(scrollTimeout); };
  }, []);

  // ─── Memoized Carousels ──────────────────────────────────────────────────
  const carouselsContent = useMemo(() => {
    // We strictly use isTransitioning to completely decouple DOM injection from route mounting.
    // This prevents main-thread blocking and keeps the Framer Motion pill animation butter-smooth.
    if (isTransitioning || (isLoading && popularMovies.length === 0)) {
      return (
        <div className="w-full flex flex-col gap-2 opacity-80 pt-2">
          {/* Row 1: Media Carousel */}
          <div className="px-8 pb-32 pt-4 flex flex-col overflow-hidden">
            <div className="h-6 w-48 mb-4 bg-white/10 rounded-md animate-pulse" />
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(card => (
                <div key={card} className="w-[150px] md:w-[200px] h-[225px] md:h-[300px] flex-shrink-0 relative overflow-hidden rounded-md bg-[#141414] ring-1 ring-white/5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: Top 10 Carousel (Wider cards with number offsets) */}
          <div className="px-8 pb-32 pt-4 flex flex-col overflow-hidden">
            <div className="h-6 w-64 mb-4 bg-white/10 rounded-md animate-pulse" />
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((card, index) => (
                <div key={card} className={`w-[220px] md:w-[300px] h-[225px] md:h-[300px] flex-shrink-0 relative overflow-hidden rounded-md bg-[#141414] ring-1 ring-white/5 ${index === 0 ? 'ml-16 md:ml-20' : 'ml-24 md:ml-32'}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: Media Carousel */}
          <div className="px-8 pb-32 pt-4 flex flex-col overflow-hidden">
            <div className="h-6 w-48 mb-4 bg-white/10 rounded-md animate-pulse" />
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(card => (
                <div key={card} className="w-[150px] md:w-[200px] h-[225px] md:h-[300px] flex-shrink-0 relative overflow-hidden rounded-md bg-[#141414] ring-1 ring-white/5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col gap-2 animate-in fade-in duration-700 fill-mode-both">
        {providerOriginals.length > 0 && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title={`${providerName} Originals`}
              items={providerOriginals}
              priority={true}
              renderDelay={0}
              brandColor={accentColor}
              onItemFocus={(item) => {}}
            />
          </div>
        )}
        {popularMovies.length > 0 && !(activeProvider === 'crunchyroll' && activeFilter.label === 'All') && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title={activeFilter.label === 'All' ? 'Critically Acclaimed Movies' : `${activeFilter.label} Movies`}
              items={popularMovies}
              priority={true}
              renderDelay={isRestoring ? 0 : 150}
              onItemFocus={(item) => {}}
            />
          </div>
        )}

        {top10Movies.length > 0 && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <Top10Carousel
              title={`Top 10 Movies`}
              items={top10Movies}
              renderDelay={isRestoring ? 0 : 300}
              onItemFocus={(item) => {}}
              useBrandColors={true}
            />
          </div>
        )}

        {popularSeries.length > 0 && !(activeProvider === 'crunchyroll' && activeFilter.label === 'All') && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title={activeFilter.label === 'All' ? 'Critically Acclaimed Series' : `${activeFilter.label} Series`}
              items={popularSeries}
              renderDelay={isRestoring ? 0 : 450}
              onItemFocus={(item) => {}}
            />
          </div>
        )}

        {animeOscars.length > 0 && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title="The Anime Oscars (Critically Acclaimed)"
              items={animeOscars}
              renderDelay={isRestoring ? 0 : 600}
              onItemFocus={(item) => {}}
            />
          </div>
        )}

        {top10Series.length > 0 && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <Top10Carousel
              title={activeProvider === 'crunchyroll' ? 'Top 10 Animes' : 'Top 10 Shows'}
              items={top10Series}
              renderDelay={isRestoring ? 0 : 750}
              onItemFocus={(item) => {}}
              useBrandColors={true}
            />
          </div>
        )}
        
        {lancamentos.length > 0 && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title="Recent Releases"
              items={lancamentos}
              renderDelay={isRestoring ? 0 : 900}
              onItemFocus={(item) => {}}
            />
          </div>
        )}

        {emBreve.length > 0 && (
          <div data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title={`Releases of ${new Date().toLocaleString('en-US', { month: 'long' })}`}
              items={emBreve}
              renderDelay={isRestoring ? 0 : 1050}
              onItemFocus={(item) => {}}
              brandColor={accentColor}
            />
          </div>
        )}

        {thematicLists.map((list, idx) => list.items.length > 0 && (
          <div key={`thematic-${idx}`} data-vertical-snap="true" className="snap-start snap-always scroll-mt-[108px]">
            <MediaCarousel
              title={list.title}
              items={list.items}
              renderDelay={isRestoring ? 0 : 1200 + idx * 150}
              onItemFocus={(item) => {}}
            />
          </div>
        ))}

      </div>
    );
  }, [isTransitioning, popularMovies, popularSeries, top10Movies, top10Series, lancamentos, emBreve, thematicLists, providerName, isLoading, accentColor, providerOriginals]);

  return (
    <div
      id="main-scroll-container"
      ref={containerRef}
      className={`h-screen overflow-y-auto overflow-x-hidden relative ${isHidingScroll ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'} ${isSnappingDisabled ? 'snap-none' : 'snap-y snap-mandatory'}`}
      onScroll={(e) => {
        const currentScrollTop = (e.target as HTMLDivElement).scrollTop;
        const scrolled = currentScrollTop > 50;
        scrollPosRef.current = currentScrollTop;
        
        // Prevent 60fps state dispatch thrashing
        if (useStore.getState().isScrolled !== scrolled) {
          storeSetIsScrolled(scrolled);
        }

        if (!isRestoringRef.current) {
          const currentFocus = useStore.getState().globalFocusedId;
          if (currentFocus) useStore.getState().setGlobalFocusedId(null);
        }
      }}
    >
      {/* ─── Snap Point 1: Cinematic Provider Selector ─────────────────── */}
      <div data-vertical-snap="true" className="snap-start snap-always min-h-[65vh] md:min-h-[75vh] bg-[#0a0a0c] flex flex-col items-center pt-[140px] pb-4 relative overflow-hidden">

        {/* Single Cohesive Ambient Glow */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000 ease-out"
          style={{
            background: `radial-gradient(ellipse 100% 70% at 50% 15%, ${accentColor}25 0%, transparent 100%)`,
          }}
        />

        {/* --- NATIVE SVG FILTERS (Water Drop 3D lighting directly on the logo paths) --- */}
        <svg width="0" height="0" className="absolute pointer-events-none">
          <defs>
            {/* Master Glass Filter: Renders ONLY the 3D volume, frosted glass, and reflections, hiding the original image color */}
            {/* Optimized bounds and complexity for 60fps performance */}
            <filter id="liquid-gel-glass-only" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feOffset dx="2" dy="4" in="blur" result="offsetBlur" />
              <feComposite in="SourceAlpha" in2="offsetBlur" operator="out" result="inverseAlphaShadow" />
              <feFlood floodColor="black" floodOpacity="0.8" result="shadowColor" />
              <feComposite in="shadowColor" in2="inverseAlphaShadow" operator="in" result="innerShadow" />

              <feOffset dx="-2" dy="-2" in="blur" result="offsetBlurLight" />
              <feComposite in="SourceAlpha" in2="offsetBlurLight" operator="out" result="inverseAlphaLight" />
              <feFlood floodColor="white" floodOpacity="0.5" result="lightColor" />
              <feComposite in="lightColor" in2="inverseAlphaLight" operator="in" result="innerHighlight" />

              <feSpecularLighting in="blur" surfaceScale="4" specularConstant="0.6" specularExponent="20" lightingColor="white" result="specular">
                <fePointLight x="-50" y="-100" z="200" />
              </feSpecularLighting>
              <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularMasked" />

              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="black" floodOpacity="0.5" result="dropShadow" />

              {/* Frost layer to make the empty glass shape subtly visible when there is no color beneath it */}
              <feFlood floodColor="white" floodOpacity="0.05" result="frostColor" />
              <feComposite in="frostColor" in2="SourceAlpha" operator="in" result="frostMasked" />

              <feMerge>
                <feMergeNode in="dropShadow" />
                <feMergeNode in="frostMasked" />
                <feMergeNode in="innerShadow" />
                <feMergeNode in="innerHighlight" />
                <feMergeNode in="specularMasked" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Noise texture overlay for depth */}
        <div className="absolute inset-0 z-0 opacity-[0.015] pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }}
        />

        <div className="relative z-10 flex flex-col items-center w-full max-w-6xl px-8">
          {/* Title Block */}
          <p className="text-white/30 text-lg md:text-xl text-center mb-10 max-w-lg font-light tracking-wide animate-in fade-in slide-in-from-bottom-4 duration-700">
            Pick a platform. Dial in a vibe. Find your next obsession.
          </p>

          {/* ─── Streaming Provider Logos (Big, No Background, Pure Brands) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 place-items-center gap-y-12 gap-x-10 md:gap-y-16 md:gap-x-20 mb-20 max-w-5xl mx-auto min-h-[200px] animate-in fade-in zoom-in-[0.98] duration-1000 delay-150 fill-mode-both">
            {(Object.keys(STREAMING_PROVIDERS) as StreamingProviderKey[]).map((key) => {
              const isActive = activeProvider === key;
              const provider = STREAMING_PROVIDERS[key];
              
              // Ensure dark logos (Apple, HBO, Disney) are visible on the dark background by turning them white
              const needsInvert = ['disney', 'apple', 'hbo'].includes(key);
              
              // Fine-tune specific logo optical sizes
              let customScale = 1;
              if (key === 'netflix') customScale = 0.8;
              if (key === 'disney') customScale = 1.35;
              if (key === 'apple') customScale = 0.85;
              if (key === 'paramount') customScale = 1.25;

              const hasGradientMask = ['disney', 'apple', 'hbo'].includes(key);
              let activeGradient = '';
              
              if (key === 'disney') {
                activeGradient = 'linear-gradient(135deg, #00E5FF 0%, #1742FF 50%, #113CCF 100%)';
              } else if (key === 'apple') {
                activeGradient = `
                  radial-gradient(ellipse 50% 65% at 10% 105%, #a855f7 10%, transparent 100%),
                  radial-gradient(ellipse 50% 65% at 30% 105%, #3b82f6 10%, transparent 100%),
                  radial-gradient(ellipse 50% 65% at 50% 105%, #10b981 10%, transparent 100%),
                  radial-gradient(ellipse 50% 65% at 70% 105%, #f59e0b 10%, transparent 100%),
                  radial-gradient(ellipse 50% 65% at 90% 105%, #f43f5e 10%, transparent 100%),
                  #ffffff
                `;
              } else if (key === 'hbo') {
                activeGradient = 'linear-gradient(135deg, #D433FF 0%, #7A00FF 40%, #2A00E6 100%)';
              }

              // Custom ambient glow colors for brands that have dark or black primary colors
              let glowColor = provider.color;
              if (key === 'disney') glowColor = '#00E5FF';
              if (key === 'hbo') glowColor = '#B21FFF';
              if (key === 'apple') glowColor = '#ffffff';

              return (
                <button
                  key={key}
                  onClick={() => setActiveProvider(key)}
                  className="relative flex items-center justify-center transition-all duration-500 cursor-pointer group"
                  style={{
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                    filter: isActive ? `drop-shadow(0 0 35px ${glowColor}70) drop-shadow(0 0 15px ${glowColor}50)` : 'none'
                  }}
                >
                  {/* --- 0. BACKGROUND AMBIENT GLOW (Only for gradient logos) --- */}
                  {isActive && hasGradientMask && (
                    <div
                      className="absolute inset-0 transition-opacity duration-700 blur-xl opacity-60 pointer-events-none"
                      style={{
                        transform: customScale !== 1 ? `scale(${customScale})` : undefined,
                        background: activeGradient,
                        WebkitMaskImage: `url(${PROVIDER_LOGO_URLS[key]})`,
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskImage: `url(${PROVIDER_LOGO_URLS[key]})`,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                      }}
                    />
                  )}
                  {/* --- 1. THE COLOR LAYER (Fades in completely smoothly on Active) --- */}
                  {hasGradientMask ? (
                    <div
                      className={`absolute inset-0 transition-opacity duration-500 select-none pointer-events-none ${isActive ? 'opacity-100' : 'opacity-0'}`}
                      style={{
                        transform: customScale !== 1 ? `scale(${customScale})` : undefined,
                        background: activeGradient,
                        WebkitMaskImage: `url(${PROVIDER_LOGO_URLS[key]})`,
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskImage: `url(${PROVIDER_LOGO_URLS[key]})`,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                      }}
                    />
                  ) : (
                    <img
                      src={PROVIDER_LOGO_URLS[key]}
                      alt={provider.name + ' Color'}
                      className={`absolute h-12 md:h-20 w-auto object-contain transition-opacity duration-500 select-none ${isActive ? 'opacity-100' : 'opacity-0'}`}
                      style={{
                        filter: [
                          needsInvert ? 'brightness(0) invert(1)' : '',
                        ].filter(Boolean).join(' '),
                        transform: customScale !== 1 ? `scale(${customScale})` : undefined
                      }}
                      draggable={false}
                    />
                  )}

                  {/* --- 2. THE 3D GLASS LAYER (Always visible, renders ONLY light/shadow volume on the shape) --- */}
                  <img
                    src={PROVIDER_LOGO_URLS[key]}
                    alt={provider.name + ' Glass'}
                    className={`relative z-10 h-12 md:h-20 w-auto object-contain transition-opacity duration-500 select-none transform-gpu will-change-[filter,opacity] ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}
                    style={{
                      // Invert required for mask to catch light correctly on white SVG shapes
                      filter: [
                        needsInvert ? 'brightness(0) invert(1)' : '',
                        'url(#liquid-gel-glass-only)'
                      ].filter(Boolean).join(' '),
                      transform: customScale !== 1 ? `scale(${customScale}) translateZ(0)` : 'translateZ(0)'
                    }}
                    draggable={false}
                  />

                  {/* --- 3. Sharp Glossy Reflection Sweep (The white diagonal light reacting to hover) --- */}
                  <div
                    className={`absolute z-20 inset-0 transition-opacity duration-500 pointer-events-none mix-blend-overlay ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{
                      transform: customScale !== 1 ? `scale(${customScale})` : undefined,
                      background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.35) 42%, transparent 48%)',
                      WebkitMaskImage: `url(${PROVIDER_LOGO_URLS[key]})`,
                      WebkitMaskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskImage: `url(${PROVIDER_LOGO_URLS[key]})`,
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* ─── Smart Filter Chips (Centered Pill Row) ────────────────── */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap max-w-4xl mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
            {SMART_FILTERS.map((filter) => {
              const isActive = activeFilter.label === filter.label;
              return (
                <button
                  key={filter.label}
                  onClick={() => {
                    setActiveDiscoverFilterLabel(filter.label);
                    if (containerRef.current) {
                      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="px-6 py-3 rounded-full text-sm md:text-base font-medium transition-all duration-300 cursor-pointer"
                  style={{
                    background: isActive
                      ? accentColor
                      : 'rgba(255,255,255,0.04)',
                    color: isActive 
                      ? (accentColor === '#ffffff' ? '#000' : '#fff') 
                      : 'rgba(255,255,255,0.35)',
                    border: isActive
                      ? `1px solid ${accentColor}`
                      : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isActive ? `0 4px 20px ${accentColor}30` : 'none',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Loading Indicator */}
          <div className="flex items-center justify-center h-4">
            {isLoading && (
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            )}
          </div>
        </div>

        {/* Scroll Down Gradient Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0c] to-transparent pointer-events-none z-10" />
      </div>

      {/* ─── Snap Point 2: Carousels ───────────────────────────────────── */}
      <div className="min-h-screen pb-24 text-white flex flex-col justify-start gap-2 bg-[#0a0a0c]">
        {carouselsContent}
      </div>
    </div>
  );
}
