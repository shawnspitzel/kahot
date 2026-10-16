import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Card, ID, Side, StudySet, TestResult } from '../../../shared/types';
import { api } from '../../api';
import { CardText } from '../../components/common';
import { StudyLayout, StudyRoute } from '../../components/StudyLayout';
import {
  distractors,
  formatDate,
  isCorrectAnswer,
  otherSide,
  pickSides,
  shuffle,
  sideLabel,
  type AnswerWith,
} from '../../lib/study';

export function Test() {
  return <StudyRoute render={(set) => <TestInner set={set} />} />;
}

type TType = 'tf' | 'mc' | 'matching' | 'written';
const TYPE_ORDER: TType[] = ['tf', 'mc', 'matching', 'written'];
const TYPE_LABELS: Record<TType, string> = {
  tf: 'True/False',
  mc: 'Multiple choice',
  matching: 'Matching',
  written: 'Written',
};

interface TestConfig {
  count: number;
  types: Record<TType, boolean>;
  answerWith: AnswerWith;
  starredOnly: boolean;
}

interface TestQ {
  cardId: ID;
  type: TType;
  prompt: Side;
  answer: Side;
  choices: string[];
  tfShown: string;
  tfTrue: boolean;
}

/** Splits the chosen cards evenly across the enabled question types, grouped in TYPE_ORDER. */
function buildTest(allCards: Card[], pool: Card[], cfg: TestConfig): TestQ[] {
  const chosen = shuffle(pool).slice(0, Math.max(1, Math.min(cfg.count, pool.length)));
  const enabled = TYPE_ORDER.filter((t) => cfg.types[t]);
  const questions: TestQ[] = chosen.map((card, i) => {
    const { prompt, answer } = pickSides(cfg.answerWith);
    const wrong = distractors(card, allCards, answer, 3);
    const tfTrue = wrong.length === 0 || Math.random() < 0.5;
    return {
      cardId: card.id,
      type: enabled[Math.floor((i * enabled.length) / chosen.length)],
      prompt,
      answer,
      choices: shuffle([card[answer], ...wrong]),
      tfShown: tfTrue ? card[answer] : wrong[0],
      tfTrue,
    };
  });
  const matching = questions.filter((q) => q.type === 'matching');
  if (matching.length === 1) matching[0].type = 'mc';
  else if (matching.length > 1) {
    // One shared answer bank, so every matching question answers with the same side.
    for (const q of matching) {
      q.answer = matching[0].answer;
      q.prompt = otherSide(q.answer);
    }
  }
  return questions.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function TestInner({ set }: { set: StudySet }) {
  const cards = set.cards;
  const starredCount = cards.filter((c) => c.starred).length;
  const [config, setConfig] = useState<TestConfig>({
    count: Math.min(20, cards.length),
    types: { tf: true, mc: true, matching: true, written: true },
    answerWith: 'definition',
    starredOnly: false,
  });
  const [phase, setPhase] = useState<'setup' | 'taking' | 'results'>('setup');
  const [questions, setQuestions] = useState<TestQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [graded, setGraded] = useState<boolean[]>([]);
  const [history, setHistory] = useState<TestResult[]>([]);

  useEffect(() => {
    api.listTests(set.id).then(setHistory).catch(() => {});
  }, [set.id]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const poolSize = config.starredOnly ? starredCount : cards.length;
  const bank = useMemo(
    () => shuffle(questions.filter((q) => q.type === 'matching').map((q) => byId.get(q.cardId)![q.answer])),
    [questions, byId],
  );

  function start(onlyIds?: ID[]) {
    const pool = onlyIds
      ? cards.filter((c) => onlyIds.includes(c.id))
      : cards.filter((c) => !config.starredOnly || c.starred);
    setQuestions(buildTest(cards, pool, onlyIds ? { ...config, count: pool.length } : config));
    setAnswers({});
    setGraded([]);
    setPhase('taking');
    window.scrollTo(0, 0);
  }

  function grade(q: TestQ, given = ''): boolean {
    const expected = byId.get(q.cardId)![q.answer];
    if (q.type === 'written') return isCorrectAnswer(given, expected);
    if (q.type === 'tf') return given !== '' && (given === 'true') === q.tfTrue;
    return given === expected;
  }

  function submit() {
    const unanswered = questions.filter((_, i) => !answers[i]?.trim()).length;
    if (unanswered && !confirm(`You have ${unanswered} unanswered ${unanswered === 1 ? 'question' : 'questions'}. Submit anyway?`)) {
      return;
    }
    const results = questions.map((q, i) => grade(q, answers[i]));
    setGraded(results);
    setPhase('results');
    window.scrollTo(0, 0);
    const score = results.filter(Boolean).length;
    api.recordProgress(questions.map((q, i) => ({ cardId: q.cardId, correct: results[i] }))).catch(() => {});
    api
      .addTest(set.id, score, questions.length)
      .then((r) => setHistory((h) => [r, ...h]))
      .catch(() => {});
  }

  const setAnswer = (i: number, value: string) => setAnswers((a) => ({ ...a, [i]: value }));

  if (phase === 'setup') {
    const enabledCount = Object.values(config.types).filter(Boolean).length;
    return (
      <StudyLayout set={set} mode="test">
        <div className="test-setup panel">
          <h1>Set up your test</h1>
          <div className="stack">
            <label className="option-row">
              <span>
                Questions <span className="muted small">(max {poolSize})</span>
              </span>
              <input
                type="number"
                className="input select"
                min={1}
                max={poolSize}
                value={Math.min(config.count, poolSize)}
                onChange={(e) => setConfig({ ...config, count: Math.max(1, Math.min(poolSize, Number(e.target.value) || 1)) })}
              />
            </label>
            <label className="option-row">
              <span>Answer with</span>
              <select
                className="input select"
                value={config.answerWith}
                onChange={(e) => setConfig({ ...config, answerWith: e.target.value as AnswerWith })}
              >
                <option value="definition">Definition</option>
                <option value="term">Term</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="option-row">
              <span>Starred terms only {starredCount === 0 && <span className="muted small">(none starred)</span>}</span>
              <input
                type="checkbox"
                checked={config.starredOnly}
                disabled={starredCount === 0}
                onChange={(e) => setConfig({ ...config, starredOnly: e.target.checked })}
              />
            </label>
            <hr />
            {TYPE_ORDER.map((t) => (
              <label key={t} className="option-row">
                <span>{TYPE_LABELS[t]}</span>
                <input
                  type="checkbox"
                  checked={config.types[t]}
                  disabled={config.types[t] && enabledCount === 1}
                  onChange={(e) => setConfig({ ...config, types: { ...config.types, [t]: e.target.checked } })}
                />
              </label>
            ))}
          </div>
          <div className="row end">
            <button className="btn primary big" disabled={poolSize === 0} onClick={() => start()}>
              Start test
            </button>
          </div>
        </div>
        {history.length > 0 && (
          <div className="panel test-history">
            <h3>Past results</h3>
            {history.map((t) => (
              <div key={t.id} className="history-row">
                <b>{Math.round((t.score / t.total) * 100)}%</b>
                <span>
                  {t.score}/{t.total} correct
                </span>
                <span className="muted small">{formatDate(t.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </StudyLayout>
    );
  }

  const score = graded.filter(Boolean).length;
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const missed = questions.filter((_, i) => graded[i] === false).map((q) => q.cardId);
  const showResults = phase === 'results';
  const answeredCount = questions.filter((_, i) => answers[i]?.trim()).length;

  return (
    <StudyLayout
      set={set}
      mode="test"
      actions={!showResults && <span className="muted small">{answeredCount} / {questions.length} answered</span>}
    >
      <div className="test">
        {showResults && (
          <div className="panel results-head">
            <div className={`score-ring ${pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad'}`}>{pct}%</div>
            <div>
              <h2>{pct === 100 ? 'Perfect score! 🎉' : pct >= 80 ? "You're doing great!" : 'Keep practicing!'}</h2>
              <div className="muted">
                {score} correct · {questions.length - score} incorrect
              </div>
              <div className="row">
                {missed.length > 0 && (
                  <button className="btn primary" onClick={() => start(missed)}>
                    Retest {missed.length} missed {missed.length === 1 ? 'term' : 'terms'}
                  </button>
                )}
                <button className="btn secondary" onClick={() => setPhase('setup')}>
                  Take a new test
                </button>
                <Link className="btn secondary" to={`/sets/${set.id}/learn`}>
                  Practice with Learn
                </Link>
              </div>
            </div>
          </div>
        )}

        {TYPE_ORDER.map((type) => {
          const indexes = questions.map((q, i) => (q.type === type ? i : -1)).filter((i) => i >= 0);
          if (!indexes.length) return null;
          return (
            <section key={type} className="test-section">
              <h2 className="section-title">
                {TYPE_LABELS[type]} <span className="muted small">{indexes.length} questions</span>
              </h2>
              {type === 'matching' && !showResults && (
                <div className="panel bank">
                  {bank.map((text, i) => (
                    <div key={i}>
                      <b>{LETTERS[i]}.</b> {text}
                    </div>
                  ))}
                </div>
              )}
              {indexes.map((i) => (
                <TestQuestion
                  key={i}
                  number={i + 1}
                  total={questions.length}
                  q={questions[i]}
                  card={byId.get(questions[i].cardId)!}
                  bank={bank}
                  value={answers[i] ?? ''}
                  onChange={(v) => setAnswer(i, v)}
                  result={showResults ? graded[i] : undefined}
                  onOverride={() => setGraded((g) => g.map((r, j) => (j === i ? true : r)))}
                />
              ))}
            </section>
          );
        })}

        {!showResults && (
          <div className="center submit-row">
            <p className="muted">All done! Ready to submit your test?</p>
            <button className="btn primary big" onClick={submit}>
              Submit test
            </button>
          </div>
        )}
      </div>
    </StudyLayout>
  );
}

function TestQuestion(props: {
  number: number;
  total: number;
  q: TestQ;
  card: Card;
  bank: string[];
  value: string;
  onChange: (value: string) => void;
  result?: boolean;
  onOverride: () => void;
}) {
  const { number, total, q, card, bank, value, onChange, result, onOverride } = props;
  const graded = result !== undefined;
  const expected = card[q.answer];
  const locked = graded;

  return (
    <div className={`panel test-q ${graded ? (result ? 'is-correct' : 'is-incorrect') : ''}`}>
      <div className="q-meta">
        <span className="q-label">{sideLabel(q.prompt)}</span>
        <span className="spacer" />
        {graded && <span className={`pill ${result ? 'good' : 'bad'}`}>{result ? 'Correct' : 'Incorrect'}</span>}
        <span className="muted small">
          {number} of {total}
        </span>
      </div>
      <CardText card={card} side={q.prompt} className="q-prompt" />

      {q.type === 'tf' && (
        <>
          <div className="tf-pair">
            <span className="q-label">{sideLabel(q.answer)}</span>
            <div className="q-prompt small">{q.tfShown}</div>
          </div>
          <div className="choices two">
            {(['true', 'false'] as const).map((v) => {
              const isRight = (v === 'true') === q.tfTrue;
              const cls = graded ? (isRight ? 'correct' : v === value ? 'incorrect' : 'dim') : value === v ? 'selected' : '';
              return (
                <button key={v} className={`choice ${cls}`} disabled={locked} onClick={() => onChange(v)}>
                  {v === 'true' ? 'True' : 'False'}
                </button>
              );
            })}
          </div>
          {graded && !q.tfTrue && (
            <div className="answer-reveal">
              Correct {sideLabel(q.answer).toLowerCase()}: <b>{expected}</b>
            </div>
          )}
        </>
      )}

      {q.type === 'mc' && (
        <div className="choices">
          {q.choices.map((c, i) => {
            const cls = graded ? (c === expected ? 'correct' : c === value ? 'incorrect' : 'dim') : value === c ? 'selected' : '';
            return (
              <button key={i} className={`choice ${cls}`} disabled={locked} onClick={() => onChange(c)}>
                {c}
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'matching' && (
        <>
          <select className="input" value={value} disabled={locked} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose an answer…</option>
            {bank.map((text, i) => (
              <option key={i} value={text}>
                {LETTERS[i]}. {text}
              </option>
            ))}
          </select>
          {graded && !result && (
            <div className="answer-reveal">
              Correct answer: <b>{expected}</b>
            </div>
          )}
        </>
      )}

      {q.type === 'written' && (
        <>
          <input
            className={`input ${graded ? (result ? 'correct' : 'incorrect') : ''}`}
            placeholder="Type the answer"
            value={value}
            disabled={locked}
            onChange={(e) => onChange(e.target.value)}
          />
          {graded && !result && (
            <div className="answer-reveal row">
              <span>
                Correct answer: <b>{expected}</b>
              </span>
              {value.trim() && (
                <button className="btn ghost small" onClick={onOverride}>
                  Override: I was right
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
