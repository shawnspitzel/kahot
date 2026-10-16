import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ID, Side, StudySet } from '../../../shared/types';
import { api } from '../../api';
import { CardText, ProgressBar } from '../../components/common';
import { StudyLayout, StudyRoute } from '../../components/StudyLayout';
import { canSpeak, speak } from '../../lib/speech';
import { otherSide, shuffle, sideLabel } from '../../lib/study';

export function Spell() {
  return <StudyRoute render={(set) => <SpellInner set={set} />} />;
}

/** Spelling is strict: only case and surrounding/duplicate whitespace are forgiven. */
const strict = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

function Diff({ given, expected }: { given: string; expected: string }) {
  return (
    <span className="diff">
      {[...expected].map((ch, i) => (
        <span key={i} className={given[i]?.toLowerCase() === ch.toLowerCase() ? 'ok' : 'miss'}>
          {ch}
        </span>
      ))}
    </span>
  );
}

function SpellInner({ set }: { set: StudySet }) {
  const [side, setSide] = useState<Side>('term');
  const [queue, setQueue] = useState<ID[]>(() => shuffle(set.cards.map((c) => c.id)));
  const [state, setState] = useState<'typing' | 'correct' | 'retype'>('typing');
  const [input, setInput] = useState('');
  const [lastWrong, setLastWrong] = useState('');
  const [firstTry, setFirstTry] = useState<Record<ID, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(set.cards.map((c) => [c.id, c])), [set.cards]);
  const card = queue.length ? byId.get(queue[0]) : undefined;
  const total = set.cards.length;

  useEffect(() => {
    if (card) speak(card[side], 0.9);
    inputRef.current?.focus();
  }, [card?.id, side, queue.length]);

  function restart(newSide = side) {
    setSide(newSide);
    setQueue(shuffle(set.cards.map((c) => c.id)));
    setState('typing');
    setInput('');
    setFirstTry({});
  }

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!card || state === 'correct') return;
    const expected = card[side];
    const ok = strict(input) === strict(expected);

    if (state === 'retype') {
      if (ok) {
        // Spelled it after seeing the answer; send it to the back for another real attempt.
        setQueue((q) => [...q.slice(1), q[0]]);
        setState('typing');
        setInput('');
      } else {
        speak(expected, 0.8);
      }
      return;
    }

    if (!(card.id in firstTry)) {
      setFirstTry((f) => ({ ...f, [card.id]: ok }));
      api.recordProgress([{ cardId: card.id, correct: ok }]).catch(() => {});
    }
    if (ok) {
      setState('correct');
      setTimeout(() => {
        setQueue((q) => q.slice(1));
        setState('typing');
        setInput('');
      }, 900);
    } else {
      setLastWrong(input);
      setInput('');
      setState('retype');
      speak(expected, 0.8);
    }
  }

  const correctFirst = Object.values(firstTry).filter(Boolean).length;

  return (
    <StudyLayout
      set={set}
      mode="spell"
      actions={
        <select className="input select" value={side} onChange={(e) => restart(e.target.value as Side)} aria-label="Spell">
          <option value="term">Spell terms</option>
          <option value="definition">Spell definitions</option>
        </select>
      }
    >
      <div className="spell">
        <ProgressBar value={total - queue.length} max={total} />
        {!canSpeak && <div className="notice">Your browser doesn't support speech, so use the hint to spell the answer.</div>}

        {card ? (
          <div className="learn-card">
            <div className="q-meta">
              <span className="q-label">Hint · {sideLabel(otherSide(side))}</span>
              <span className="spacer" />
              <span className="muted small">
                {total - queue.length + 1} / {total}
              </span>
            </div>
            <CardText card={card} side={otherSide(side)} className="q-prompt" />
            {canSpeak && (
              <button className="btn secondary replay" onClick={() => (speak(card[side], 0.9), inputRef.current?.focus())}>
                🔊 Replay audio
              </button>
            )}

            {state === 'retype' && (
              <div className="written-feedback">
                <div className="answer-box incorrect">
                  <span className="muted small">You typed</span>
                  <s>{lastWrong || '(nothing)'}</s>
                </div>
                <div className="answer-box correct">
                  <span className="muted small">Correct spelling</span>
                  <Diff given={lastWrong} expected={card[side]} />
                </div>
                <div className="muted small">Type the correct answer to continue.</div>
              </div>
            )}

            <form className="written-form" onSubmit={check}>
              <input
                ref={inputRef}
                className={`input big ${state === 'correct' ? 'correct' : ''}`}
                placeholder={state === 'retype' ? 'Type the correct spelling' : `Type what you hear`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                readOnly={state === 'correct'}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="row end">
                {state === 'typing' && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      if (!(card.id in firstTry)) {
                        setFirstTry((f) => ({ ...f, [card.id]: false }));
                        api.recordProgress([{ cardId: card.id, correct: false }]).catch(() => {});
                      }
                      setLastWrong('');
                      setState('retype');
                      speak(card[side], 0.8);
                    }}
                  >
                    Don't know?
                  </button>
                )}
                <button type="submit" className="btn primary" disabled={!input.trim() || state === 'correct'}>
                  {state === 'correct' ? '✓ Correct!' : 'Check'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="finish">
            <div className="big-emoji">🔤</div>
            <h2>
              You spelled {correctFirst} of {total} correctly on the first try!
            </h2>
            <div className="finish-actions">
              <button className="btn primary" onClick={() => restart()}>
                Spell again
              </button>
              <Link className="btn secondary" to={`/sets/${set.id}`}>
                Back to set
              </Link>
            </div>
          </div>
        )}
      </div>
    </StudyLayout>
  );
}
