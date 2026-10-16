import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Card, Side, StudySetSummary } from '../../shared/types';
import { api } from '../api';
import { canSpeak, speak } from '../lib/speech';

export function Loading({ error }: { error?: string | null }) {
  return error ? <div className="notice error">{error}</div> : <div className="notice">Loading…</div>;
}

export function Modal(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { title, onClose, children, footer, wide } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function StarButton({ card, onChange }: { card: Card; onChange: (card: Card) => void }) {
  return (
    <button
      className={`icon-btn star ${card.starred ? 'on' : ''}`}
      title={card.starred ? 'Unstar' : 'Star'}
      aria-label={card.starred ? 'Unstar' : 'Star'}
      onClick={(e) => {
        e.stopPropagation();
        const next = { ...card, starred: !card.starred };
        onChange(next);
        api.updateCard(card.id, { starred: next.starred }).catch(() => onChange(card));
      }}
    >
      {card.starred ? '★' : '☆'}
    </button>
  );
}

export function AudioButton({ text }: { text: string }) {
  if (!canSpeak) return null;
  return (
    <button
      className="icon-btn"
      title="Listen"
      aria-label="Listen"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      🔊
    </button>
  );
}

export function CardText({ card, side, className = '' }: { card: Card; side: Side; className?: string }) {
  return (
    <div className={`card-text ${className}`}>
      {side === 'definition' && card.imageUrl && <img src={card.imageUrl} alt="" />}
      {card[side] ? <span>{card[side]}</span> : <em className="muted">(empty)</em>}
    </div>
  );
}

export function ProgressBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`progress ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Stacked bar of not-yet-known / familiar / mastered counts. */
export function MasteryBar({ counts }: { counts: [number, number, number] }) {
  const total = counts[0] + counts[1] + counts[2] || 1;
  return (
    <div className="mastery">
      <div className="mastery-bar">
        <div className="seg mastered" style={{ width: `${(counts[2] / total) * 100}%` }} />
        <div className="seg familiar" style={{ width: `${(counts[1] / total) * 100}%` }} />
      </div>
      <div className="mastery-legend">
        <span>
          <i className="dot new" /> Not known {counts[0]}
        </span>
        <span>
          <i className="dot familiar" /> Familiar {counts[1]}
        </span>
        <span>
          <i className="dot mastered" /> Mastered {counts[2]}
        </span>
      </div>
    </div>
  );
}

export function SetTile({ set }: { set: StudySetSummary }) {
  return (
    <Link to={`/sets/${set.id}`} className="set-tile">
      <div className="set-tile-title">{set.title}</div>
      <div className="set-tile-meta">
        <span className="pill">{set.cardCount} terms</span>
        {set.masteredCount > 0 && <span className="muted">{Math.round((set.masteredCount / set.cardCount) * 100)}% mastered</span>}
      </div>
      <ProgressBar value={set.masteredCount} max={set.cardCount} className="thin" />
    </Link>
  );
}
