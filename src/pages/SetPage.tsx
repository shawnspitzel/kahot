import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { cardStatus, type Card, type MatchScore, type ProgressStatus, type TestResult } from '../../shared/types';
import { api } from '../api';
import { AudioButton, Loading, MasteryBar, StarButton } from '../components/common';
import { FlipCard } from '../components/FlipCard';
import { AddToFolderModal, ExportModal } from '../components/modals';
import { STUDY_MODES } from '../components/StudyLayout';
import { useSet } from '../hooks/useSet';
import { formatDate, formatSeconds } from '../lib/study';

export function SetPage() {
  const id = Number(useParams().id);
  return <SetPageInner key={id} id={id} />;
}

type SortMode = 'original' | 'progress' | 'alpha';

const STATUS_SECTIONS: { status: ProgressStatus; title: string; blurb: string }[] = [
  { status: 'learning', title: 'Still learning', blurb: "You've started learning these terms. Keep up the good work!" },
  { status: 'new', title: 'Not studied', blurb: "You haven't studied these terms yet." },
  { status: 'mastered', title: 'Mastered', blurb: 'You know these terms well.' },
];

function SetPageInner({ id }: { id: number }) {
  const navigate = useNavigate();
  const { set, setSet, error } = useSet(id);
  const [modal, setModal] = useState<'export' | 'folders' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [filter, setFilter] = useState<'all' | 'starred'>('all');
  const [sort, setSort] = useState<SortMode>('original');
  const [preview, setPreview] = useState({ index: 0, flipped: false });

  useEffect(() => {
    api.listTests(id).then(setTests).catch(() => {});
    api.listMatchScores(id).then(setScores).catch(() => {});
  }, [id]);

  if (!set) return <Loading error={error} />;

  const updateCard = (card: Card) => setSet({ ...set, cards: set.cards.map((c) => (c.id === card.id ? card : c)) });
  const counts: [number, number, number] = [0, 0, 0];
  for (const c of set.cards) counts[Math.min(c.level, 2)]++;
  const starredCount = set.cards.filter((c) => c.starred).length;
  const visible = set.cards.filter((c) => filter === 'all' || c.starred);
  const previewCard = set.cards[Math.min(preview.index, set.cards.length - 1)];

  async function act(action: 'duplicate' | 'reset' | 'delete') {
    setMenuOpen(false);
    if (action === 'duplicate') {
      const copy = await api.duplicateSet(id);
      navigate(`/sets/${copy.id}`);
    } else if (action === 'reset' && confirm('Reset all study progress for this set?')) {
      setSet(await api.resetProgress(id));
    } else if (action === 'delete' && confirm(`Delete "${set!.title}"? This cannot be undone.`)) {
      await api.deleteSet(id);
      navigate('/');
    }
  }

  const sortedForAlpha = [...visible].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="set-page">
      <div className="set-head">
        <div>
          <h1>{set.title}</h1>
          {set.description && <p className="muted">{set.description}</p>}
          <div className="muted small">
            {set.cardCount} terms · created {formatDate(set.createdAt)}
          </div>
        </div>
        <div className="row">
          <Link to={`/sets/${id}/edit`} className="btn secondary">
            ✏️ Edit
          </Link>
          <div className="menu-wrap">
            <button className="btn secondary" onClick={() => setMenuOpen((o) => !o)} aria-label="More actions">
              •••
            </button>
            {menuOpen && (
              <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button onClick={() => (setMenuOpen(false), setModal('folders'))}>📁 Add to folder</button>
                <button onClick={() => act('duplicate')}>⧉ Make a copy</button>
                <button onClick={() => (setMenuOpen(false), setModal('export'))}>⤓ Export</button>
                <button onClick={() => (setMenuOpen(false), window.print())}>🖨 Print</button>
                <button onClick={() => act('reset')}>↺ Reset progress</button>
                <button className="danger" onClick={() => act('delete')}>
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mode-grid">
        {STUDY_MODES.map((m) => (
          <Link key={m.path} to={`/sets/${id}/${m.path}`} className="mode-btn">
            <span className="mode-icon">{m.icon}</span>
            {m.label}
          </Link>
        ))}
      </div>

      {previewCard && (
        <div className="preview">
          <FlipCard
            key={previewCard.id}
            card={previewCard}
            front="term"
            flipped={preview.flipped}
            onFlip={() => setPreview((p) => ({ ...p, flipped: !p.flipped }))}
            onCardChange={updateCard}
          />
          <div className="card-controls">
            <button
              className="round-btn"
              disabled={preview.index === 0}
              onClick={() => setPreview((p) => ({ index: p.index - 1, flipped: false }))}
              aria-label="Previous"
            >
              ←
            </button>
            <span className="counter">
              {preview.index + 1} / {set.cards.length}
            </span>
            <button
              className="round-btn"
              disabled={preview.index >= set.cards.length - 1}
              onClick={() => setPreview((p) => ({ index: p.index + 1, flipped: false }))}
              aria-label="Next"
            >
              →
            </button>
          </div>
        </div>
      )}

      <div className="stats-row">
        <div className="panel">
          <h3>Your progress</h3>
          <MasteryBar counts={counts} />
        </div>
        <div className="panel">
          <h3>Match best times</h3>
          {scores.length === 0 ? (
            <div className="muted small">No games yet.</div>
          ) : (
            <ol className="score-list">
              {scores.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <b>{formatSeconds(s.timeMs)}s</b> <span className="muted small">{formatDate(s.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="panel">
          <h3>Recent tests</h3>
          {tests.length === 0 ? (
            <div className="muted small">No tests yet.</div>
          ) : (
            <ol className="score-list">
              {tests.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <b>{Math.round((t.score / t.total) * 100)}%</b> ({t.score}/{t.total}){' '}
                  <span className="muted small">{formatDate(t.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="terms-head">
        <h2>Terms in this set ({set.cards.length})</h2>
        <div className="row">
          <div className="tabs small">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All
            </button>
            <button className={filter === 'starred' ? 'active' : ''} onClick={() => setFilter('starred')}>
              Starred ({starredCount})
            </button>
          </div>
          <select className="input select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="original">Original order</option>
            <option value="progress">Your stats</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </div>
      </div>

      {visible.length === 0 && <div className="muted">No starred terms. Click ☆ on a term to star it.</div>}

      {sort === 'progress' ? (
        STATUS_SECTIONS.map(({ status, title, blurb }) => {
          const group = visible.filter((c) => cardStatus(c) === status);
          if (!group.length) return null;
          return (
            <section key={status}>
              <h3 className={`status-title ${status}`}>
                {title} ({group.length})
              </h3>
              <p className="muted small">{blurb}</p>
              {group.map((c) => (
                <TermRow key={c.id} card={c} onChange={updateCard} />
              ))}
            </section>
          );
        })
      ) : (
        (sort === 'alpha' ? sortedForAlpha : visible).map((c) => <TermRow key={c.id} card={c} onChange={updateCard} />)
      )}

      <div className="center">
        <Link to={`/sets/${id}/edit`} className="btn primary">
          Add or remove terms
        </Link>
      </div>

      {modal === 'export' && <ExportModal set={set} onClose={() => setModal(null)} />}
      {modal === 'folders' && (
        <AddToFolderModal set={set} onClose={() => setModal(null)} onChange={(folderIds) => setSet({ ...set, folderIds })} />
      )}
    </div>
  );
}

function TermRow({ card, onChange }: { card: Card; onChange: (card: Card) => void }) {
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(card.term);
  const [definition, setDefinition] = useState(card.definition);

  async function save() {
    onChange(await api.updateCard(card.id, { term, definition }));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="term-row editing">
        <textarea className="input" value={term} autoFocus onChange={(e) => setTerm(e.target.value)} />
        <textarea className="input" value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <div className="term-tools">
          <button className="btn primary small" onClick={save}>
            Save
          </button>
          <button className="btn ghost small" onClick={() => (setEditing(false), setTerm(card.term), setDefinition(card.definition))}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="term-row">
      <div className="term-term">{card.term}</div>
      <div className="term-def">
        {card.imageUrl && <img src={card.imageUrl} alt="" />}
        <span>{card.definition}</span>
      </div>
      <div className="term-tools">
        <StarButton card={card} onChange={onChange} />
        <AudioButton text={card.term} />
        <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(true)}>
          ✏️
        </button>
      </div>
    </div>
  );
}
