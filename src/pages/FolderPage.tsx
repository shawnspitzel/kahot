import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Folder, StudySetSummary } from '../../shared/types';
import { api } from '../api';
import { Loading, Modal, SetTile } from '../components/common';
import { FolderModal } from '../components/modals';

export function FolderPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [sets, setSets] = useState<StudySetSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'edit' | 'add' | null>(null);

  useEffect(() => {
    setFolder(null);
    api.getFolder(id).then(setFolder).catch((e: Error) => setError(e.message));
    api.listSets().then(setSets).catch(() => {});
  }, [id]);

  if (!folder) return <Loading error={error} />;

  const inFolder = folder.setIds.map((sid) => sets.find((s) => s.id === sid)).filter((s): s is StudySetSummary => !!s);

  async function remove() {
    if (!confirm(`Delete folder "${folder!.name}"? The sets inside will not be deleted.`)) return;
    await api.deleteFolder(id);
    navigate('/?tab=folders');
  }

  async function toggle(setId: number) {
    setFolder(
      folder!.setIds.includes(setId) ? await api.removeSetFromFolder(id, setId) : await api.addSetToFolder(id, setId),
    );
  }

  return (
    <div>
      <div className="set-head">
        <div>
          <div className="muted small">Folder</div>
          <h1>📁 {folder.name}</h1>
          {folder.description && <p className="muted">{folder.description}</p>}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => setModal('add')}>
            + Add sets
          </button>
          <button className="btn secondary" onClick={() => setModal('edit')}>
            ✏️ Edit
          </button>
          <button className="btn secondary danger" onClick={remove}>
            🗑 Delete
          </button>
        </div>
      </div>

      {inFolder.length === 0 ? (
        <div className="empty-hero small">
          <p className="muted">This folder has no sets yet.</p>
          <button className="btn primary" onClick={() => setModal('add')}>
            Add sets
          </button>
        </div>
      ) : (
        <div className="tile-grid">
          {inFolder.map((s) => (
            <div key={s.id} className="tile-wrap">
              <SetTile set={s} />
              <button className="icon-btn tile-remove" title="Remove from folder" onClick={() => toggle(s.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {modal === 'edit' && <FolderModal folder={folder} onClose={() => setModal(null)} onSaved={setFolder} />}
      {modal === 'add' && (
        <Modal title="Add sets to folder" onClose={() => setModal(null)}>
          {sets.length === 0 && (
            <p className="muted">
              You have no sets. <Link to="/sets/new">Create one</Link>.
            </p>
          )}
          <div className="folder-pick-list">
            {sets.map((s) => {
              const on = folder.setIds.includes(s.id);
              return (
                <button key={s.id} className={`folder-pick ${on ? 'on' : ''}`} onClick={() => toggle(s.id)}>
                  <span>
                    {s.title} <span className="muted small">· {s.cardCount} terms</span>
                  </span>
                  <span>{on ? '✓ Added' : '+ Add'}</span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
