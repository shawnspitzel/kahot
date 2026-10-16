import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router';
import { Header } from './components/Header';
import { EditSet } from './pages/EditSet';
import { FolderPage } from './pages/FolderPage';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { SetPage } from './pages/SetPage';
import { Flashcards } from './pages/study/Flashcards';
import { Learn } from './pages/study/Learn';
import { Match } from './pages/study/Match';
import { Spell } from './pages/study/Spell';
import { Test } from './pages/study/Test';

function MainLayout() {
  return (
    <>
      <Header />
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

function NotFound() {
  return (
    <div className="empty-hero">
      <h1>Page not found</h1>
      <Link to="/" className="btn primary">
        Go home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/sets/new" element={<EditSet key="new" />} />
          <Route path="/sets/:id" element={<SetPage />} />
          <Route path="/sets/:id/edit" element={<EditSet key="edit" />} />
          <Route path="/folders/:id" element={<FolderPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/sets/:id/flashcards" element={<Flashcards />} />
        <Route path="/sets/:id/learn" element={<Learn />} />
        <Route path="/sets/:id/test" element={<Test />} />
        <Route path="/sets/:id/match" element={<Match />} />
        <Route path="/sets/:id/spell" element={<Spell />} />
      </Routes>
    </BrowserRouter>
  );
}
