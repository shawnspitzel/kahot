import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { MASTERED_LEVEL, type Card, type ID, type Side, type StudySet } from '../../../shared/types';
import { api } from '../../api';
import { AudioButton, CardText, MasteryBar, Modal, StarButton } from '../../components/common';
import { StudyLayout, StudyRoute } from '../../components/StudyLayout';
import {
  distractors,
  isCorrectAnswer,
  pickSides,
  randomPraise,
  shuffle,
  sideLabel,
  type AnswerWith,
} from '../../lib/study';

export function Learn() {
  return <StudyRoute render={(set) => <LearnInner set={set} />} />;
}

type QType = 'mc' | 'tf' | 'written';
const QTYPE_LABELS: Record<QType, string> = { mc: 'Multiple choice', tf: 'True/False', written: 'Written' };
const ROUND_SIZE = 7;

interface LearnOptions {
  answerWith: AnswerWith;
  types: Record<QType, boolean>;
  starredOnly: boolean;
}

interface Question {
  cardId: ID;
  type: QType;
  prompt: Side;
  answer: Side;
  choices: string[];
  tfShown: string;
  tfTrue: boolean;
}

interface Feedback {
  correct: boolean;
  given: string;
  praise: string;
}

const DEFAULT_OPTIONS: LearnOptions = {
  answerWith: 'definition',
  types: { mc: true, tf: false, written: true },
  starredOnly: false,
};

function LearnInner({ set }: { set: StudySet }) {
  const [cards, setCards] = useState(set.cards);
  const [opts, setOpts] = useState<LearnOptions>(DEFAULT_OPTIONS);
  const [levels, setLevels] = useState<Record<ID, number>>(() =>
    Object.fromEntries(set.cards.map((c) => [c.id, Math.min(c.level, MASTERED_LEVEL)])),
  );
  const [phase, setPhase] = useState<'question' | 'summary' | 'done'>('question');
  const [queue, setQueue] = useState<ID[]>([]);
  const [roundIds, setRoundIds] = useState<ID[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const pool = useMemo(() => cards.filter((c) => !opts.starredOnly || c.starred), [cards, opts.starredOnly]);
  const updateCard = (card: Card) => setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)));

  function makeQuestion(cardId: ID, level: number, o: LearnOptions): Question {
    const card = byId.get(cardId)!;
    const { prompt, answer } = pickSides(o.answerWith);
    // New cards start with recognition (multiple choice); familiar ones must be recalled (written).
    const order: QType[] = level >= 1 ? ['written', 'mc', 'tf'] : ['mc', 'tf', 'written'];
    const type = order.find((t) => o.types[t]) ?? 'mc';
    const wrong = distractors(card, cards, answer, 3);
    const tfTrue = wrong.length === 0 || Math.random() < 0.5;
    return {
      cardId,
      type,
      prompt,
      answer,
      choices: shuffle([card[answer], ...wrong]),
      tfShown: tfTrue ? card[answer] : wrong[0],
      tfTrue,
    };
  }

  function startRound(lv = levels, o = opts) {
    const remaining = cards
      .filter((c) => (!o.starredOnly || c.starred) && lv[c.id] < MASTERED_LEVEL)
      .sort((a, b) => lv[b.id] - lv[a.id] || a.position - b.position);
    setFeedback(null);
    setInput('');
    if (remaining.length === 0) {
      setQuestion(null);
      setPhase('done');
      return;
    }
    const ids = shuffle(remaining.slice(0, ROUND_SIZE).map((c) => c.id));
    setRoundIds(ids);
    setQueue(ids);
    setQuestion(makeQuestion(ids[0], lv[ids[0]], o));
    setPhase('question');
  }

  useEffect(() => startRound(), []);

  function submit(given: string) {
    if (!question || feedback) return;
    const card = byId.get(question.cardId)!;
    const expected = card[question.answer];
    const correct =
      question.type === 'written'
        ? isCorrectAnswer(given, expected)
        : question.type === 'tf'
          ? (given === 'true') === question.tfTrue
          : given === expected;
    setFeedback({ correct, given, praise: randomPraise() });
  }

  function advance(correct: boolean) {
    if (!question) return;
    const id = question.cardId;
    api.recordProgress([{ cardId: id, correct }]).catch(() => {});
    const next = { ...levels, [id]: correct ? Math.min(levels[id] + 1, MASTERED_LEVEL) : 0 };
    setLevels(next);
    // Missed cards go to the back of the round and come up again.
    const rest = correct ? queue.slice(1) : [...queue.slice(1), id];
    setQueue(rest);
    setFeedback(null);
    setInput('');
    if (rest.length === 0) {
      setQuestion(null);
      setPhase('summary');
    } else {
      setQuestion(makeQuestion(rest[0], next[rest[0]], opts));
    }
  }

  useEffect(() => {
    if (!feedback?.correct) return;
    const timer = setTimeout(() => advance(true), 1000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (question?.type === 'written' && !feedback) inputRef.current?.focus();
  }, [question, feedback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showOptions) return;
      const target = e.target as HTMLElement;
      if (phase === 'summary' && e.key === 'Enter' && !target.closest('button')) return startRound();
      if (phase !== 'question' || !question) return;
      if (feedback) {
        if (!feedback.correct && e.key === 'Enter' && !target.closest('button')) {
          e.preventDefault();
          advance(false);
        }
        return;
      }
      if (target.closest('input, textarea')) return;
      const n = Number(e.key);
      if (question.type === 'mc' && n >= 1 && n <= question.choices.length) submit(question.choices[n - 1]);
      if (question.type === 'tf' && (n === 1 || n === 2)) submit(n === 1 ? 'true' : 'false');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const counts: [number, number, number] = [0, 0, 0];
  for (const c of pool) counts[levels[c.id] ?? 0]++;

  function resetAndRestart() {
    const reset = { ...levels };
    for (const c of pool) reset[c.id] = 0;
    setLevels(reset);
    startRound(reset);
  }

  let body: React.ReactNode;
  if (pool.length === 0) {
    body = <div className="notice">You have no starred terms. Turn off “Study starred terms only” in Options.</div>;
  } else if (phase === 'done') {
    body = (
      <div className="finish">
        <div className="big-emoji">🎉</div>
        <h2>Congratulations, you've mastered all {pool.length} terms!</h2>
        <p className="muted">Study again to keep them fresh, or check yourself with a practice test.</p>
        <div className="finish-actions">
          <button className="btn primary" onClick={resetAndRestart}>
            Study again
          </button>
          <Link className="btn secondary" to={`/sets/${set.id}/test`}>
            Take a practice test
          </Link>
          <Link className="btn secondary" to={`/sets/${set.id}`}>
            Back to set
          </Link>
        </div>
      </div>
    );
  } else if (phase === 'summary') {
    body = (
      <div className="round-summary">
        <h2>Round complete! Keep it up.</h2>
        <MasteryBar counts={counts} />
        <h3>Terms studied in this round</h3>
        <div className="summary-list">
          {roundIds.map((id) => {
            const card = byId.get(id)!;
            const lv = levels[id];
            return (
              <div key={id} className="summary-row">
                <b>{card.term}</b>
                <span>{card.definition}</span>
                <span className={`pill ${lv >= MASTERED_LEVEL ? 'good' : lv === 1 ? 'warn' : 'bad'}`}>
                  {lv >= MASTERED_LEVEL ? 'Mastered' : lv === 1 ? 'Familiar' : 'Learning'}
                </span>
              </div>
            );
          })}
        </div>
        <button className="btn primary big" onClick={() => startRound()}>
          Continue to next round
        </button>
      </div>
    );
  } else if (question) {
    const card = byId.get(question.cardId)!;
    const expected = card[question.answer];
    const choiceClass = (value: string, isCorrect: boolean) =>
      !feedback ? '' : isCorrect ? 'correct' : value === feedback.given ? 'incorrect' : 'dim';

    body = (
      <div className="learn-card">
        <div className="q-meta">
          <span className="q-label">{sideLabel(question.prompt)}</span>
          {levels[question.cardId] === 1 && <span className="pill warn">Familiar</span>}
          <span className="spacer" />
          <AudioButton text={card[question.prompt]} />
          <StarButton card={card} onChange={updateCard} />
        </div>
        <CardText card={card} side={question.prompt} className="q-prompt" />

        {question.type === 'tf' && (
          <div className="tf-pair">
            <span className="q-label">{sideLabel(question.answer)}</span>
            <div className="q-prompt small">{question.tfShown}</div>
          </div>
        )}

        <div className={`q-instructions ${feedback ? (feedback.correct ? 'good-text' : 'bad-text') : ''}`}>
          {feedback
            ? feedback.correct
              ? feedback.praise
              : question.type === 'written'
                ? feedback.given
                  ? 'Not quite, you’re still learning!'
                  : 'No worries, here’s the answer.'
                : 'Not quite, you’re still learning!'
            : question.type === 'mc'
              ? `Choose the correct ${sideLabel(question.answer).toLowerCase()}`
              : question.type === 'tf'
                ? 'Is this pair correct?'
                : `Type the ${sideLabel(question.answer).toLowerCase()}`}
        </div>

        {question.type === 'mc' && (
          <div className="choices">
            {question.choices.map((c, i) => (
              <button
                key={i}
                className={`choice ${choiceClass(c, c === expected)}`}
                disabled={!!feedback}
                onClick={() => submit(c)}
              >
                <span className="choice-num">{i + 1}</span>
                {c}
              </button>
            ))}
          </div>
        )}

        {question.type === 'tf' && (
          <div className="choices two">
            {(['true', 'false'] as const).map((v, i) => (
              <button
                key={v}
                className={`choice ${choiceClass(v, (v === 'true') === question.tfTrue)}`}
                disabled={!!feedback}
                onClick={() => submit(v)}
              >
                <span className="choice-num">{i + 1}</span>
                {v === 'true' ? 'True' : 'False'}
              </button>
            ))}
            {feedback && !question.tfTrue && (
              <div className="answer-reveal">
                Correct {sideLabel(question.answer).toLowerCase()}: <b>{expected}</b>
              </div>
            )}
          </div>
        )}

        {question.type === 'written' && (
          <>
            {feedback && !feedback.correct ? (
              <div className="written-feedback">
                {feedback.given && (
                  <div className="answer-box incorrect">
                    <span className="muted small">Your answer</span>
                    <s>{feedback.given}</s>
                  </div>
                )}
                <div className="answer-box correct">
                  <span className="muted small">Correct answer</span>
                  {expected}
                </div>
              </div>
            ) : (
              <form
                className="written-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) submit(input);
                }}
              >
                <input
                  ref={inputRef}
                  className={`input big ${feedback?.correct ? 'correct' : ''}`}
                  placeholder="Type the answer"
                  value={input}
                  disabled={!!feedback}
                  onChange={(e) => setInput(e.target.value)}
                />
                <div className="row end">
                  <button type="button" className="btn ghost" disabled={!!feedback} onClick={() => submit('')}>
                    Don't know?
                  </button>
                  <button type="submit" className="btn primary" disabled={!!feedback || !input.trim()}>
                    Answer
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {feedback && !feedback.correct && (
          <div className="row end continue-row">
            {question.type === 'written' && feedback.given && (
              <button className="btn ghost" onClick={() => advance(true)}>
                Override: I was right
              </button>
            )}
            <span className="muted small">Press Enter to continue</span>
            <button className="btn primary" onClick={() => advance(false)} autoFocus>
              Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <StudyLayout
      set={set}
      mode="learn"
      actions={
        <button className="btn ghost" onClick={() => setShowOptions(true)}>
          ⚙ Options
        </button>
      }
    >
      <div className="learn">
        {pool.length > 0 && phase === 'question' && <MasteryBar counts={counts} />}
        {body}
      </div>
      {showOptions && (
        <LearnOptionsModal
          opts={opts}
          onClose={() => setShowOptions(false)}
          onApply={(o) => {
            setOpts(o);
            setShowOptions(false);
            startRound(levels, o);
          }}
          onReset={async () => {
            if (!confirm('Reset your progress for this set?')) return;
            await api.resetProgress(set.id);
            const reset = Object.fromEntries(cards.map((c) => [c.id, 0]));
            setLevels(reset);
            setShowOptions(false);
            startRound(reset);
          }}
        />
      )}
    </StudyLayout>
  );
}

function LearnOptionsModal(props: {
  opts: LearnOptions;
  onClose: () => void;
  onApply: (o: LearnOptions) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(props.opts);
  const enabledCount = Object.values(draft.types).filter(Boolean).length;
  return (
    <Modal
      title="Options"
      onClose={props.onClose}
      footer={
        <>
          <button className="btn ghost danger" onClick={props.onReset}>
            Reset progress
          </button>
          <button className="btn primary" onClick={() => props.onApply(draft)}>
            Apply
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="option-row">
          <span>Answer with</span>
          <select
            className="input select"
            value={draft.answerWith}
            onChange={(e) => setDraft({ ...draft, answerWith: e.target.value as AnswerWith })}
          >
            <option value="definition">Definition</option>
            <option value="term">Term</option>
            <option value="both">Both</option>
          </select>
        </label>
        <div className="option-group">
          <div className="muted small">Question types</div>
          {(Object.keys(QTYPE_LABELS) as QType[]).map((t) => (
            <label key={t} className="option-row">
              <span>{QTYPE_LABELS[t]}</span>
              <input
                type="checkbox"
                checked={draft.types[t]}
                disabled={draft.types[t] && enabledCount === 1}
                onChange={(e) => setDraft({ ...draft, types: { ...draft.types, [t]: e.target.checked } })}
              />
            </label>
          ))}
        </div>
        <label className="option-row">
          <span>Study starred terms only</span>
          <input
            type="checkbox"
            checked={draft.starredOnly}
            onChange={(e) => setDraft({ ...draft, starredOnly: e.target.checked })}
          />
        </label>
      </div>
    </Modal>
  );
}
