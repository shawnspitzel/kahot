import { useEffect, useState } from 'react';
import type { ID, MatchScore, Side, StudySet } from '../../../shared/types';
import { api } from '../../api';
import { StudyLayout, StudyRoute } from '../../components/StudyLayout';
import { formatDate, formatSeconds, shuffle } from '../../lib/study';

export function Match() {
  return <StudyRoute render={(set) => <MatchInner set={set} />} />;
}

interface Tile {
  key: string;
  cardId: ID;
  side: Side;
  text: string;
  imageUrl: string | null;
}

const PAIRS = 6;
const PENALTY_MS = 1000;

function MatchInner({ set }: { set: StudySet }) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [prevBest, setPrevBest] = useState<number | null>(null);

  useEffect(() => {
    api.listMatchScores(set.id).then(setScores).catch(() => {});
  }, [set.id]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(timer);
  }, [phase]);

  function start() {
    const picked = shuffle(set.cards).slice(0, PAIRS);
    setTiles(
      shuffle(
        picked.flatMap((c): Tile[] => [
          { key: `${c.id}-t`, cardId: c.id, side: 'term', text: c.term, imageUrl: null },
          { key: `${c.id}-d`, cardId: c.id, side: 'definition', text: c.definition, imageUrl: c.imageUrl },
        ]),
      ),
    );
    setMatched(new Set());
    setSelected(null);
    setWrong([]);
    setPenalty(0);
    const t = Date.now();
    setStartedAt(t);
    setNowMs(t);
    setPhase('playing');
  }

  function finish() {
    const elapsed = Date.now() - startedAt + penalty;
    setFinalMs(elapsed);
    setPrevBest(scores.length ? Math.min(...scores.map((s) => s.timeMs)) : null);
    setPhase('done');
    api
      .addMatchScore(set.id, elapsed)
      .then((s) => setScores((prev) => [...prev, s].sort((a, b) => a.timeMs - b.timeMs).slice(0, 10)))
      .catch(() => {});
  }

  /** Two tiles match if they are opposite sides of the same card, or of cards with identical text. */
  function isPair(a: Tile, b: Tile) {
    if (a.side === b.side) return false;
    if (a.cardId === b.cardId) return true;
    const [term, def] = a.side === 'term' ? [a, b] : [b, a];
    return set.cards.some((c) => c.term === term.text && c.definition === def.text);
  }

  function click(tile: Tile) {
    if (matched.has(tile.key) || wrong.length) return;
    if (!selected) return setSelected(tile.key);
    if (selected === tile.key) return setSelected(null);
    const other = tiles.find((t) => t.key === selected)!;
    setSelected(null);
    if (isPair(tile, other)) {
      const next = new Set(matched).add(tile.key).add(other.key);
      setMatched(next);
      if (next.size === tiles.length) finish();
    } else {
      setWrong([tile.key, other.key]);
      setPenalty((p) => p + PENALTY_MS);
      setTimeout(() => setWrong([]), 500);
    }
  }

  const best = scores.length ? Math.min(...scores.map((s) => s.timeMs)) : null;

  return (
    <StudyLayout
      set={set}
      mode="match"
      actions={phase === 'playing' && <span className="timer">{formatSeconds(nowMs - startedAt + penalty)}</span>}
    >
      {phase === 'ready' && (
        <div className="finish">
          <div className="big-emoji">🧩</div>
          <h2>Ready to play?</h2>
          <p className="muted">
            Match all the terms with their definitions as fast as you can.
            <br />
            Avoid wrong matches, they add {PENALTY_MS / 1000} second to your time!
          </p>
          {best !== null && <p>Your best time: <b>{formatSeconds(best)} seconds</b></p>}
          <button className="btn primary big" onClick={start}>
            Start game
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="match-grid">
          {tiles.map((t) => (
            <button
              key={t.key}
              className={`match-tile ${selected === t.key ? 'selected' : ''} ${wrong.includes(t.key) ? 'wrong' : ''} ${
                matched.has(t.key) ? 'matched' : ''
              }`}
              onClick={() => click(t)}
              disabled={matched.has(t.key)}
            >
              {t.imageUrl && <img src={t.imageUrl} alt="" />}
              <span>{t.text}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 'done' && (
        <div className="finish">
          <div className="big-emoji">{prevBest === null || finalMs < prevBest ? '🏆' : '⏱️'}</div>
          <h2>Nice work! You finished in {formatSeconds(finalMs)} seconds.</h2>
          {prevBest !== null && finalMs < prevBest && <p className="good-text">New personal record! Previous best was {formatSeconds(prevBest)}s.</p>}
          {prevBest !== null && finalMs >= prevBest && (
            <p className="muted">Try to beat your record of {formatSeconds(prevBest)} seconds.</p>
          )}
          {penalty > 0 && <p className="muted small">Includes {penalty / 1000}s of penalties.</p>}
          <div className="panel leaderboard">
            <h3>Your top times</h3>
            <ol>
              {scores.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <b>{formatSeconds(s.timeMs)}s</b> <span className="muted small">{formatDate(s.createdAt)}</span>
                </li>
              ))}
            </ol>
          </div>
          <button className="btn primary big" onClick={start}>
            Play again
          </button>
        </div>
      )}
    </StudyLayout>
  );
}
