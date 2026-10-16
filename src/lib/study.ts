import type { Card, Side } from '../../shared/types';

/** Which side the student has to produce. 'both' picks randomly per question. */
export type AnswerWith = Side | 'both';

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const otherSide = (side: Side): Side => (side === 'term' ? 'definition' : 'term');
export const sideLabel = (side: Side) => (side === 'term' ? 'Term' : 'Definition');

export function pickSides(answerWith: AnswerWith): { prompt: Side; answer: Side } {
  const answer: Side = answerWith === 'both' ? (Math.random() < 0.5 ? 'term' : 'definition') : answerWith;
  return { prompt: otherSide(answer), answer };
}

/** Up to `count` wrong answers drawn from other cards, never duplicating the right answer. */
export function distractors(card: Card, cards: Card[], side: Side, count: number): string[] {
  const seen = new Set([normalize(card[side])]);
  const out: string[] = [];
  for (const c of shuffle(cards)) {
    const n = normalize(c[side]);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(c[side]);
    if (out.length === count) break;
  }
  return out;
}

/** Lowercases and strips accents, punctuation and extra whitespace. */
export function normalize(text: string): string {
  const cleaned = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || text.trim().toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Accepted spellings: the full answer, the answer without (parentheticals), and ;- or /-separated alternatives. */
function acceptedAnswers(expected: string): string[] {
  const accepted = [normalize(expected), normalize(expected.replace(/\([^)]*\)/g, ' '))];
  const parts = expected.split(/[;/]/).map(normalize);
  if (parts.length > 1 && parts.every((p) => p.length >= 3)) accepted.push(...parts);
  return [...new Set(accepted.filter(Boolean))];
}

/** Lenient grading for typed answers: ignores case, accents and punctuation, and allows small typos. */
export function isCorrectAnswer(given: string, expected: string): boolean {
  const g = normalize(given);
  if (!g.trim()) return false;
  return acceptedAnswers(expected).some((a) => {
    if (g === a) return true;
    if (a.length < 6) return false;
    return levenshtein(g, a) <= (a.length >= 12 ? 2 : 1);
  });
}

export const formatSeconds = (ms: number) => (ms / 1000).toFixed(1);

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const PRAISE = ['Great job!', 'Nice work!', 'You got it!', 'Awesome!', 'Correct!', 'Way to go!', 'Perfect!'];
export const randomPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
