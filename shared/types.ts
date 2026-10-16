// Types shared by the API server and the React client.

export type ID = number;
export type Side = 'term' | 'definition';
export type ProgressStatus = 'new' | 'learning' | 'mastered';

/** Level at which a card counts as mastered (0 = not known, 1 = familiar, 2 = mastered). */
export const MASTERED_LEVEL = 2;

export interface Card {
  id: ID;
  setId: ID;
  position: number;
  term: string;
  definition: string;
  imageUrl: string | null;
  starred: boolean;
  level: number;
  timesCorrect: number;
  timesIncorrect: number;
  lastStudiedAt: string | null;
}

export interface CardInput {
  id?: ID;
  term: string;
  definition: string;
  imageUrl?: string | null;
}

export interface CardPatch {
  term?: string;
  definition?: string;
  imageUrl?: string | null;
  starred?: boolean;
}

export interface StudySetSummary {
  id: ID;
  title: string;
  description: string;
  cardCount: number;
  masteredCount: number;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
  folderIds: ID[];
}

export interface StudySet extends StudySetSummary {
  cards: Card[];
}

export interface StudySetInput {
  title: string;
  description: string;
  cards: CardInput[];
}

export interface Folder {
  id: ID;
  name: string;
  description: string;
  createdAt: string;
  setIds: ID[];
}

export interface FolderInput {
  name: string;
  description: string;
}

export interface ProgressResult {
  cardId: ID;
  correct: boolean;
}

export interface MatchScore {
  id: ID;
  setId: ID;
  timeMs: number;
  createdAt: string;
}

export interface TestResult {
  id: ID;
  setId: ID;
  score: number;
  total: number;
  createdAt: string;
}

export function cardStatus(card: Pick<Card, 'level' | 'timesCorrect' | 'timesIncorrect'>): ProgressStatus {
  if (card.level >= MASTERED_LEVEL) return 'mastered';
  if (card.timesCorrect + card.timesIncorrect === 0) return 'new';
  return 'learning';
}
