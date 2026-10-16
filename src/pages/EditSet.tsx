import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Loading } from '../components/common';
import { ImportModal } from '../components/modals';

interface Row {
  key: string;
  id?: number;
  term: string;
  definition: string;
  imageUrl: string;
  showImage: boolean;
}

let keySeq = 0;
const newRow = (init: Partial<Row> = {}): Row => ({
  key: `row-${++keySeq}`,
  term: '',
  definition: '',
  imageUrl: '',
  showImage: false,
  ...init,
});

const isBlank = (r: Row) => !r.term.trim() && !r.definition.trim();

export function EditSet() {
  const params = useParams();
  const editingId = params.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(editingId === null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow(), newRow()]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const termRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusKey = useRef<string | null>(null);

  useEffect(() => {
    if (editingId === null) return;
    api
      .getSet(editingId)
      .then((s) => {
        setTitle(s.title);
        setDescription(s.description);
        setRows(
          s.cards.map((c) =>
            newRow({ id: c.id, term: c.term, definition: c.definition, imageUrl: c.imageUrl ?? '', showImage: !!c.imageUrl }),
          ),
        );
        setLoaded(true);
      })
      .catch((e: Error) => setError(e.message));
  }, [editingId]);

  useEffect(() => {
    if (focusKey.current) {
      termRefs.current.get(focusKey.current)?.focus();
      focusKey.current = null;
    }
  });

  if (!loaded) return <Loading error={error} />;

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addRow(focus = false) {
    const row = newRow();
    if (focus) focusKey.current = row.key;
    setRows((rs) => [...rs, row]);
  }

  function move(index: number, delta: number) {
    setRows((rs) => {
      const next = [...rs];
      const target = index + delta;
      if (target < 0 || target >= next.length) return rs;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setError(null);
    const filled = rows.filter((r) => !isBlank(r));
    if (!title.trim()) return setError('Please add a title.');
    if (filled.length < 2) return setError('You need at least two cards to create a set.');
    setSaving(true);
    try {
      const input = {
        title,
        description,
        cards: filled.map((r) => ({ id: r.id, term: r.term, definition: r.definition, imageUrl: r.imageUrl || null })),
      };
      const saved = editingId === null ? await api.createSet(input) : await api.updateSet(editingId, input);
      navigate(`/sets/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="editor">
      <div className="editor-head">
        <h1>{editingId === null ? 'Create a new study set' : 'Edit study set'}</h1>
        <div className="row">
          {editingId !== null && (
            <Link to={`/sets/${editingId}`} className="btn ghost">
              Cancel
            </Link>
          )}
          <button className="btn primary" onClick={save} disabled={saving}>
            {editingId === null ? 'Create' : 'Done'}
          </button>
        </div>
      </div>

      <input
        className="input big"
        placeholder='Enter a title, like "Biology - Chapter 22: Evolution"'
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={editingId === null}
      />
      <textarea
        className="input"
        placeholder="Add a description..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="row editor-tools">
        <button className="btn secondary" onClick={() => setImporting(true)}>
          + Import
        </button>
        <button
          className="btn secondary"
          title="Swap terms and definitions"
          onClick={() => setRows((rs) => rs.map((r) => ({ ...r, term: r.definition, definition: r.term })))}
        >
          ⇄ Flip terms and definitions
        </button>
        <span className="spacer" />
        <span className="muted small">{rows.filter((r) => !isBlank(r)).length} cards</span>
      </div>

      {error && <div className="notice error">{error}</div>}

      {rows.map((row, i) => (
        <div key={row.key} className="edit-row">
          <div className="edit-row-head">
            <span className="edit-num">{i + 1}</span>
            <span className="spacer" />
            <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" title="Move up">
              ↑
            </button>
            <button
              className="icon-btn"
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
            <button
              className="icon-btn"
              onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
              disabled={rows.length <= 1}
              aria-label="Delete card"
              title="Delete card"
            >
              🗑
            </button>
          </div>
          <div className="edit-fields">
            <label className="edit-field">
              <textarea
                ref={(el) => {
                  if (el) termRefs.current.set(row.key, el);
                  else termRefs.current.delete(row.key);
                }}
                className="underline-input"
                rows={1}
                value={row.term}
                onChange={(e) => update(row.key, { term: e.target.value })}
              />
              <span className="field-label">TERM</span>
            </label>
            <label className="edit-field">
              <textarea
                className="underline-input"
                rows={1}
                value={row.definition}
                onChange={(e) => update(row.key, { definition: e.target.value })}
                onKeyDown={(e) => {
                  // Like Quizlet: tabbing out of the last definition adds a new card.
                  if (e.key === 'Tab' && !e.shiftKey && i === rows.length - 1) {
                    e.preventDefault();
                    addRow(true);
                  }
                }}
              />
              <span className="field-label">DEFINITION</span>
            </label>
            {row.showImage ? (
              <div className="image-field">
                {row.imageUrl && <img src={row.imageUrl} alt="" />}
                <input
                  className="input small"
                  placeholder="Image URL"
                  value={row.imageUrl}
                  onChange={(e) => update(row.key, { imageUrl: e.target.value })}
                />
                <button className="icon-btn" onClick={() => update(row.key, { imageUrl: '', showImage: false })} aria-label="Remove image">
                  ✕
                </button>
              </div>
            ) : (
              <button className="image-add" onClick={() => update(row.key, { showImage: true })}>
                🖼 Image
              </button>
            )}
          </div>
        </div>
      ))}

      <button className="add-card" onClick={() => addRow(true)}>
        + ADD CARD
      </button>

      <div className="row end">
        <button className="btn primary big" onClick={save} disabled={saving}>
          {editingId === null ? 'Create' : 'Done'}
        </button>
      </div>

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImport={(cards) => setRows((rs) => [...rs.filter((r) => !isBlank(r)), ...cards.map((c) => newRow(c))])}
        />
      )}
    </div>
  );
}
