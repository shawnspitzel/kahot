import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FolderModal } from './modals';

export function Header() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  return (
    <header className="topbar">
      <Link to="/" className="logo">
        <span className="logo-mark">Q</span>uizzle
      </Link>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <span className="search-icon">🔍</span>
        <input type="search" placeholder="Search your sets and terms" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="topbar-actions">
        <button className="btn secondary" onClick={() => setCreatingFolder(true)}>
          📁 New folder
        </button>
        <Link to="/sets/new" className="btn primary">
          + Create set
        </Link>
      </div>
      {creatingFolder && (
        <FolderModal onClose={() => setCreatingFolder(false)} onSaved={(f) => navigate(`/folders/${f.id}`)} />
      )}
    </header>
  );
}
