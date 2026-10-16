import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Card, ID, Side, StudySet } from '../../../shared/types';
import { api } from '../../api';
import { Modal, ProgressBar } from '../../components/common';
import { FlipCard } from '../../components/FlipCard';
import { StudyLayout, StudyRoute } from '../../components/StudyLayout';
import { shuffle } from '../../lib/study';

export function Flashcards() {
  return <StudyRoute render={(set) => <FlashcardsInner set={set} />} />;
}

function FlashcardsInner({ set }: { set: StudySet }) {
  const [cards, setCards] = useState(set.cards);
  const [front, setFront] = useState<Side>('term');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [track, setTrack] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [deck, setDeck] = useState<ID[]>(() => set.cards.map((c) => c.id));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<ID, boolean>>({});
  const [showOptions, setShowOptions] = useState(false);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const updateCard = (card: Card) => setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)));

  function restart(opts: { shuffle?: boolean; starredOnly?: boolean; ids?: ID[] } = {}) {
    const useShuffle = opts.shuffle ?? shuffleOn;
    const useStarred = opts.starredOnly ?? starredOnly;
    const ids = opts.ids ?? cards.filter((c) => !useStarred || c.starred).map((c) => c.id);
    setDeck(useShuffle ? shuffle(ids) : ids);
    setIndex(0);
    setFlipped(false);
    setResults({});
  }

  const done = index >= deck.length;
  const card = done ? undefined : byId.get(deck[index]);

  const go = (delta: number) => {
    setIndex((i) => Math.max(0, Math.min(deck.length, i + delta)));
    setFlipped(false);
  };

  function answer(known: boolean) {
    if (!card) return;
    setResults((r) => ({ ...r, [card.id]: known }));
    api.recordProgress([{ cardId: card.id, correct: known }]).catch(() => {});
    go(1);
  }

  function undo() {
    if (index === 0) return;
    const prev = deck[index - 1];
    setResults((r) => {
      const next = { ...r };
      delete next[prev];
      return next;
    });
    go(-1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showOptions || (e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!done) setFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        if (track) answer(true);
        else go(1);
      } else if (e.key === 'ArrowLeft') {
        if (track) answer(false);
        else go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!autoplay || done) return;
    const timer = setTimeout(() => (flipped ? go(1) : setFlipped(true)), flipped ? 2500 : 3000);
    return () => clearTimeout(timer);
  }, [autoplay, flipped, index, done]);

  const knownCount = Object.values(results).filter(Boolean).length;
  const learningIds = deck.filter((id) => results[id] === false);

  return (
    <StudyLayout
      set={set}
      mode="flashcards"
      actions={
        <button className="btn ghost" onClick={() => setShowOptions(true)}>
          ⚙ Options
        </button>
      }
    >
      <div className="flashcards">
        {deck.length === 0 ? (
          <div className="notice">
            No cards to show.{starredOnly && ' You have no starred terms. Turn off “Study starred terms only” in Options.'}
          </div>
        ) : done ? (
          track ? (
            <div className="finish">
              <h2>{learningIds.length === 0 ? 'Way to go! You know everything in this round.' : "You're doing brilliantly! Keep focusing on the tough terms."}</h2>
              <div className="finish-stats">
                <div className="stat good">
                  <b>{knownCount}</b> Know
                </div>
                <div className="stat bad">
                  <b>{learningIds.length}</b> Still learning
                </div>
              </div>
              <div className="finish-actions">
                {learningIds.length > 0 && (
                  <button className="btn primary" onClick={() => restart({ ids: learningIds })}>
                    Keep reviewing {learningIds.length} {learningIds.length === 1 ? 'term' : 'terms'}
                  </button>
                )}
                <button className="btn secondary" onClick={() => restart()}>
                  Restart flashcards
                </button>
                <Link to={`/sets/${set.id}/learn`} className="btn secondary">
                  Practice with Learn
                </Link>
              </div>
            </div>
          ) : (
            <div className="finish">
              <h2>Nice! You've reviewed all {deck.length} cards.</h2>
              <div className="finish-actions">
                <button className="btn primary" onClick={() => restart()}>
                  Restart flashcards
                </button>
                <Link to={`/sets/${set.id}/learn`} className="btn secondary">
                  Practice with Learn
                </Link>
                <Link to={`/sets/${set.id}/test`} className="btn secondary">
                  Take a test
                </Link>
              </div>
            </div>
          )
        ) : (
          card && (
            <>
              {track && (
                <div className="track-counts">
                  <span className="pill bad">{learningIds.length} Still learning</span>
                  <span className="pill good">{knownCount} Know</span>
                </div>
              )}
              <FlipCard
                key={card.id}
                card={card}
                front={front}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
                onCardChange={updateCard}
              />
              <div className="card-controls">
                {track ? (
                  <>
                    <button className="round-btn bad" onClick={() => answer(false)} title="Still learning (←)">
                      ✕
                    </button>
                    <span className="counter">
                      {index + 1} / {deck.length}
                    </span>
                    <button className="round-btn good" onClick={() => answer(true)} title="Know (→)">
                      ✓
                    </button>
                  </>
                ) : (
                  <>
                    <button className="round-btn" disabled={index === 0} onClick={() => go(-1)} title="Previous (←)">
                      ←
                    </button>
                    <span className="counter">
                      {index + 1} / {deck.length}
                    </span>
                    <button className="round-btn" onClick={() => go(1)} title="Next (→)">
                      →
                    </button>
                  </>
                )}
              </div>
              <div className="card-toolbar">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={track}
                    onChange={(e) => {
                      setTrack(e.target.checked);
                      setAutoplay(false);
                      restart();
                    }}
                  />
                  <span /> Track progress
                </label>
                <span className="spacer" />
                {track && (
                  <button className="btn ghost" disabled={index === 0} onClick={undo} title="Undo">
                    ↶ Undo
                  </button>
                )}
                {!track && (
                  <button className={`btn ghost ${autoplay ? 'active' : ''}`} onClick={() => setAutoplay((a) => !a)}>
                    {autoplay ? '❚❚ Pause' : '▶ Autoplay'}
                  </button>
                )}
                <button
                  className={`btn ghost ${shuffleOn ? 'active' : ''}`}
                  onClick={() => {
                    setShuffleOn(!shuffleOn);
                    restart({ shuffle: !shuffleOn });
                  }}
                >
                  ⇄ Shuffle
                </button>
              </div>
            </>
          )
        )}
        <ProgressBar value={Math.min(index, deck.length)} max={deck.length} />
      </div>

      {showOptions && (
        <Modal title="Options" onClose={() => setShowOptions(false)}>
          <div className="stack">
            <label className="option-row">
              <span>Front</span>
              <select className="input select" value={front} onChange={(e) => setFront(e.target.value as Side)}>
                <option value="term">Term</option>
                <option value="definition">Definition</option>
              </select>
            </label>
            <label className="option-row">
              <span>Study starred terms only</span>
              <input
                type="checkbox"
                checked={starredOnly}
                onChange={(e) => {
                  setStarredOnly(e.target.checked);
                  restart({ starredOnly: e.target.checked });
                }}
              />
            </label>
            <label className="option-row">
              <span>Shuffle</span>
              <input
                type="checkbox"
                checked={shuffleOn}
                onChange={(e) => {
                  setShuffleOn(e.target.checked);
                  restart({ shuffle: e.target.checked });
                }}
              />
            </label>
            <div className="shortcuts muted small">
              <b>Keyboard shortcuts:</b> Space / ↑ / ↓ flip · ← → navigate (or Still learning / Know while tracking)
            </div>
          </div>
        </Modal>
      )}
    </StudyLayout>
  );
}
