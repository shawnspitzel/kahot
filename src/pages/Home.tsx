import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Folder, StudySetSummary } from '../../shared/types';
import { api } from '../api';
import { Loading, SetTile } from '../components/common';
import { formatDate } from '../lib/study';

export function Home() {
  const [sets, setSets] = useState<StudySetSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'folders' ? 'folders' : 'sets';

  useEffect(() => {
    api.listSets().then(setSets).catch((e: Error) => setError(e.message));
    api.listFolders().then(setFolders).catch(() => {});
  }, []);

  if (!sets) return <Loading error={error} />;

  const recent = sets.filter((s) => s.lastStudiedAt).slice(0, 6);

  if (sets.length === 0 && folders.length === 0) {
    return (
      <div className="empty-hero">
        <h1>Welcome to Quizzle</h1>
        <p className="muted">Create your first study set to start learning with flashcards, Learn, Test, Match and Spell.</p>
        <Link to="/sets/new" className="btn primary big">
          Create a study set
        </Link>
      </div>
    );
  }

  return (
    <div>
      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Recent</h2>
          <div className="tile-grid">
            {recent.map((s) => (
              <SetTile key={s.id} set={s} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Your library</h2>
        <div className="tabs">
          <button className={tab === 'sets' ? 'active' : ''} onClick={() => setParams({})}>
            Study sets ({sets.length})
          </button>
          <button className={tab === 'folders' ? 'active' : ''} onClick={() => setParams({ tab: 'folders' })}>
            Folders ({folders.length})
          </button>
        </div>

        {tab === 'sets' ? (
          <div className="list">
            {sets.length === 0 && <div className="muted">No study sets yet.</div>}
            {sets.map((s) => (
              <Link key={s.id} to={`/sets/${s.id}`} className="list-item">
                <div>
                  <div className="list-title">{s.title}</div>
                  <div className="muted small">
                    {s.cardCount} terms · {s.masteredCount} mastered · updated {formatDate(s.updatedAt)}
                  </div>
                </div>
                <span className="chev">›</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="list">
            {folders.length === 0 && <div className="muted">No folders yet. Use “New folder” to organize your sets.</div>}
            {folders.map((f) => (
              <Link key={f.id} to={`/folders/${f.id}`} className="list-item">
                <div>
                  <div className="list-title">📁 {f.name}</div>
                  <div className="muted small">
                    {f.setIds.length} {f.setIds.length === 1 ? 'set' : 'sets'}
                    {f.description && ` · ${f.description}`}
                  </div>
                </div>
                <span className="chev">›</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
