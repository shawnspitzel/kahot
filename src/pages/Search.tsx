import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Folder, StudySetSummary } from '../../shared/types';
import { api } from '../api';
import { Loading, SetTile } from '../components/common';

export function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const [sets, setSets] = useState<StudySetSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSets(null);
    api.listSets(q).then(setSets).catch((e: Error) => setError(e.message));
    api
      .listFolders()
      .then((all) => setFolders(all.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))))
      .catch(() => {});
  }, [q]);

  if (!sets) return <Loading error={error} />;

  return (
    <div>
      <h1>Results for “{q}”</h1>
      {sets.length === 0 && folders.length === 0 && <p className="muted">No study sets or folders match your search.</p>}
      {folders.length > 0 && (
        <section>
          <h2 className="section-title">Folders</h2>
          <div className="list">
            {folders.map((f) => (
              <Link key={f.id} to={`/folders/${f.id}`} className="list-item">
                <span className="list-title">📁 {f.name}</span>
                <span className="chev">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {sets.length > 0 && (
        <section>
          <h2 className="section-title">Study sets</h2>
          <div className="tile-grid">
            {sets.map((s) => (
              <SetTile key={s.id} set={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
