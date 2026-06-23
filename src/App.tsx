import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Discover from './pages/Discover';
import TitleDetails from './pages/TitleDetails';
import Search from './pages/Search';
import Player from './pages/Player';
import Login from './pages/Login';
import Profiles from './pages/Profiles';
import FloatingNav from './components/layout/FloatingNav';
import { TraktAuthModal } from './components/auth/TraktAuthModal';

function App() {
  return (
    <BrowserRouter>
      <FloatingNav />
      <TraktAuthModal />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/discover/:category" element={<Discover />} />
        <Route path="/title/:type/:id" element={<TitleDetails />} />
        <Route path="/search" element={<Search />} />
        <Route path="/player/:id" element={<Player />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
