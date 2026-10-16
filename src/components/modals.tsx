import { useEffect, useMemo, useState } from 'react';
import type { Folder, ID, StudySet } from '../../shared/types';
import { api } from '../api';
import { CARD_SEPARATORS, TERM_SEPARATORS, formatExport, parseImport } from '../lib/importExport';
import { Modal } from './common';

export function FolderModal(props: { folder?: Folder; onClose: () => void; onSaved: (folder: Folder) => void }) {
  const { folder, onClose, onSaved } = props;
  const [name, setName] = useState(folder?.name ?? '');
  const [description, setDescription] = useState(folder?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const input = { name, description };
      onSaved(folder ? await api.updateFolder(folder.id, input) : await api.createFolder(input));
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={folder ? 'Edit folder' : 'Create a new folder'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <input autoFocus className="input" placeholder="Title" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          className="input"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <div className="error-text">{error}</div>}
        <div className="row end">
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            {folder ? 'Save' : 'Create folder'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SeparatorPicker(props: {
  name: string;
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { name, label, options, value, onChange } = props;
  const isPreset = options.some((o) => o.value === value);
  const [custom, setCustom] = useState(isPreset ? '' : value);
  return (
    <fieldset className="sep-picker">
      <legend>{label}</legend>
      {options.map((o) => (
        <label key={o.label}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} /> {o.label}
        </label>
      ))}
      <label>
        <input type="radio" name={name} checked={!isPreset} onChange={() => onChange(custom)} />
        <input
          className="input small"
          placeholder="Custom"
          value={custom}
          onFocus={() => onChange(custom)}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
        />
      </label>
    </fieldset>
  );
}

export function ImportModal(props: {
  onClose: () => void;
  onImport: (cards: { term: string; definition: string }[]) => void;
}) {
  const [text, setText] = useState('');
  const [termSep, setTermSep] = useState('\t');
  const [cardSep, setCardSep] = useState('\n');
  const parsed = useMemo(() => parseImport(text, termSep, cardSep), [text, termSep, cardSep]);

  return (
    <Modal
      wide
      title="Import your data"
      onClose={props.onClose}
      footer={
        <button
          className="btn primary"
          disabled={!parsed.length}
          onClick={() => {
            props.onImport(parsed);
            props.onClose();
          }}
        >
          Import {parsed.length || ''} {parsed.length === 1 ? 'card' : 'cards'}
        </button>
      }
    >
      <p className="muted">Copy and paste your data here (from Word, Excel, Google Docs, etc.)</p>
      <textarea
        autoFocus
        className="input import-text"
        placeholder={'Word 1\tDefinition 1\nWord 2\tDefinition 2\nWord 3\tDefinition 3'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row wrap">
        <SeparatorPicker name="term-sep" label="Between term and definition" options={TERM_SEPARATORS} value={termSep} onChange={setTermSep} />
        <SeparatorPicker name="card-sep" label="Between cards" options={CARD_SEPARATORS} value={cardSep} onChange={setCardSep} />
      </div>
      <h3>Preview {parsed.length > 0 && <span className="muted">({parsed.length} cards)</span>}</h3>
      <div className="import-preview">
        {parsed.length === 0 && <div className="muted">Nothing to preview yet.</div>}
        {parsed.slice(0, 50).map((c, i) => (
          <div key={i} className="preview-row">
            <span>{c.term || <em className="muted">(empty)</em>}</span>
            <span>{c.definition || <em className="muted">(empty)</em>}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function ExportModal({ set, onClose }: { set: StudySet; onClose: () => void }) {
  const [termSep, setTermSep] = useState('\t');
  const [cardSep, setCardSep] = useState('\n');
  const [copied, setCopied] = useState(false);
  const text = formatExport(set.cards, termSep, cardSep);

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${set.title.replace(/[^\w-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      wide
      title={`Export "${set.title}"`}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={download}>
            Download .txt
          </button>
          <button
            className="btn primary"
            onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
          >
            {copied ? 'Copied!' : 'Copy text'}
          </button>
        </>
      }
    >
      <div className="row wrap">
        <SeparatorPicker name="exp-term-sep" label="Between term and definition" options={TERM_SEPARATORS} value={termSep} onChange={(v) => (setTermSep(v), setCopied(false))} />
        <SeparatorPicker name="exp-card-sep" label="Between cards" options={CARD_SEPARATORS} value={cardSep} onChange={(v) => (setCardSep(v), setCopied(false))} />
      </div>
      <textarea readOnly className="input import-text" value={text} onFocus={(e) => e.target.select()} />
    </Modal>
  );
}

/** Toggle which folders a set belongs to, or create a new folder and add it there. */
export function AddToFolderModal(props: { set: StudySet; onClose: () => void; onChange: (folderIds: ID[]) => void }) {
  const { set, onClose, onChange } = props;
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.listFolders().then(setFolders).catch(() => setFolders([]));
  }, []);

  function apply(updated: Folder) {
    const next = (folders ?? []).some((f) => f.id === updated.id)
      ? (folders ?? []).map((f) => (f.id === updated.id ? updated : f))
      : [...(folders ?? []), updated];
    setFolders(next);
    onChange(next.filter((f) => f.setIds.includes(set.id)).map((f) => f.id));
  }

  async function toggle(folder: Folder) {
    const inFolder = folder.setIds.includes(set.id);
    apply(inFolder ? await api.removeSetFromFolder(folder.id, set.id) : await api.addSetToFolder(folder.id, set.id));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const folder = await api.createFolder({ name: newName, description: '' });
    apply(await api.addSetToFolder(folder.id, set.id));
    setNewName('');
  }

  return (
    <Modal title="Add to folder" onClose={onClose}>
      <form onSubmit={create} className="row">
        <input className="input" placeholder="New folder name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn secondary" disabled={!newName.trim()}>
          Create
        </button>
      </form>
      <div className="folder-pick-list">
        {folders === null && <div className="muted">Loading…</div>}
        {folders?.length === 0 && <div className="muted">You don't have any folders yet.</div>}
        {folders?.map((f) => {
          const inFolder = f.setIds.includes(set.id);
          return (
            <button key={f.id} className={`folder-pick ${inFolder ? 'on' : ''}`} onClick={() => toggle(f)}>
              <span>📁 {f.name}</span>
              <span>{inFolder ? '✓ Added' : '+ Add'}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
