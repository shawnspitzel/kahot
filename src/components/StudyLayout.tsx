import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { StudySet } from '../../shared/types';
import { useSet } from '../hooks/useSet';
import { Loading } from './common';

export const STUDY_MODES = [
  { path: 'flashcards', label: 'Flashcards', icon: '🗂️' },
  { path: 'learn', label: 'Learn', icon: '🎯' },
  { path: 'test', label: 'Test', icon: '📝' },
  { path: 'match', label: 'Match', icon: '🧩' },
  { path: 'spell', label: 'Spell', icon: '🔤' },
] as const;

export type StudyMode = (typeof STUDY_MODES)[number]['path'];

/** Full-screen chrome for a study mode: mode switcher, set title and close button. */
export function StudyLayout(props: { set: StudySet; mode: StudyMode; actions?: ReactNode; children: ReactNode }) {
  const { set, mode, actions, children } = props;
  const navigate = useNavigate();
  return (
    <div className="study">
      <div className="study-bar">
        <select
          className="mode-select"
          value={mode}
          onChange={(e) => navigate(`/sets/${set.id}/${e.target.value}`)}
          aria-label="Study mode"
        >
          {STUDY_MODES.map((m) => (
            <option key={m.path} value={m.path}>
              {m.icon} {m.label}
            </option>
          ))}
        </select>
        <Link to={`/sets/${set.id}`} className="study-title">
          {set.title}
        </Link>
        <div className="study-actions">
          {actions}
          <Link to={`/sets/${set.id}`} className="icon-btn" aria-label="Close" title="Close">
            ✕
          </Link>
        </div>
      </div>
      <div className="study-body">{children}</div>
    </div>
  );
}

/** Loads the set named in the URL, then renders a study mode with it. */
export function StudyRoute({ render }: { render: (set: StudySet) => ReactNode }) {
  const id = Number(useParams().id);
  const { set, error } = useSet(id, true);
  if (!set) return <Loading error={error} />;
  if (set.cards.length < 2) return <div className="notice">This set needs at least two cards to study.</div>;
  return <>{render(set)}</>;
}
