import { db, transaction } from './db';
import {
  MASTERED_LEVEL,
  type Card,
  type CardInput,
  type CardPatch,
  type Folder,
  type FolderInput,
  type MatchScore,
  type ProgressResult,
  type StudySet,
  type StudySetInput,
  type StudySetSummary,
  type TestResult,
} from '../shared/types';

type Row = Record<string, any>;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();

// ---------- row mapping ----------

function mapCard(r: Row): Card {
  return {
    id: r.id,
    setId: r.set_id,
    position: r.position,
    term: r.term,
    definition: r.definition,
    imageUrl: r.image_url ?? null,
    starred: !!r.starred,
    level: r.level,
    timesCorrect: r.times_correct,
    timesIncorrect: r.times_incorrect,
    lastStudiedAt: r.last_studied_at ?? null,
  };
}

function mapSummary(r: Row, folderIds: number[]): StudySetSummary {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    cardCount: Number(r.card_count),
    masteredCount: Number(r.mastered_count),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastStudiedAt: r.last_studied_at ?? null,
    folderIds,
  };
}

const SUMMARY_SELECT = `
  SELECT s.*,
    (SELECT COUNT(*) FROM cards c WHERE c.set_id = s.id) AS card_count,
    (SELECT COUNT(*) FROM cards c WHERE c.set_id = s.id AND c.level >= ${MASTERED_LEVEL}) AS mastered_count
  FROM sets s`;

function folderIdsBySet(): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const r of db.prepare('SELECT folder_id, set_id FROM folder_sets').all() as Row[]) {
    const list = map.get(r.set_id) ?? [];
    list.push(r.folder_id);
    map.set(r.set_id, list);
  }
  return map;
}

// ---------- sets ----------

export function listSets(query?: string): StudySetSummary[] {
  let sql = SUMMARY_SELECT;
  const params: string[] = [];
  if (query) {
    const like = `%${query}%`;
    sql += ` WHERE s.title LIKE ? OR s.description LIKE ?
      OR EXISTS (SELECT 1 FROM cards c WHERE c.set_id = s.id AND (c.term LIKE ? OR c.definition LIKE ?))`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY COALESCE(s.last_studied_at, s.updated_at) DESC';
  const folders = folderIdsBySet();
  return (db.prepare(sql).all(...params) as Row[]).map((r) => mapSummary(r, folders.get(r.id) ?? []));
}

export function getSet(id: number): StudySet {
  const row = db.prepare(`${SUMMARY_SELECT} WHERE s.id = ?`).get(id) as Row | undefined;
  if (!row) throw new HttpError(404, 'Study set not found');
  const folderIds = (db.prepare('SELECT folder_id FROM folder_sets WHERE set_id = ?').all(id) as Row[]).map(
    (r) => r.folder_id as number,
  );
  const cards = (db.prepare('SELECT * FROM cards WHERE set_id = ? ORDER BY position').all(id) as Row[]).map(mapCard);
  return { ...mapSummary(row, folderIds), cards };
}

export function parseSetInput(body: any): StudySetInput {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) throw new HttpError(400, 'Title is required');
  if (!Array.isArray(body.cards)) throw new HttpError(400, 'cards must be an array');
  const cards: CardInput[] = body.cards
    .map((c: any) => ({
      id: Number.isInteger(c?.id) ? c.id : undefined,
      term: String(c?.term ?? '').trim(),
      definition: String(c?.definition ?? '').trim(),
      imageUrl: c?.imageUrl ? String(c.imageUrl).trim() : null,
    }))
    .filter((c: CardInput) => c.term || c.definition);
  if (cards.length < 2) throw new HttpError(400, 'A study set needs at least two cards');
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  return { title, description, cards };
}

/** Upserts cards in order, keeping ids (and progress) of cards that still exist. Call inside a transaction. */
function saveCards(setId: number, cards: CardInput[]) {
  const existing = new Set(
    (db.prepare('SELECT id FROM cards WHERE set_id = ?').all(setId) as Row[]).map((r) => r.id as number),
  );
  const update = db.prepare(
    'UPDATE cards SET position = ?, term = ?, definition = ?, image_url = ? WHERE id = ? AND set_id = ?',
  );
  const insert = db.prepare(
    'INSERT INTO cards (set_id, position, term, definition, image_url) VALUES (?, ?, ?, ?, ?)',
  );
  const kept = new Set<number>();
  cards.forEach((c, position) => {
    if (c.id && existing.has(c.id)) {
      update.run(position, c.term, c.definition, c.imageUrl ?? null, c.id, setId);
      kept.add(c.id);
    } else {
      insert.run(setId, position, c.term, c.definition, c.imageUrl ?? null);
    }
  });
  const remove = db.prepare('DELETE FROM cards WHERE id = ?');
  for (const id of existing) if (!kept.has(id)) remove.run(id);
}

export function createSet(input: StudySetInput): StudySet {
  const id = transaction(() => {
    const t = now();
    const { lastInsertRowid } = db
      .prepare('INSERT INTO sets (title, description, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(input.title, input.description, t, t);
    const setId = Number(lastInsertRowid);
    saveCards(setId, input.cards.map((c) => ({ ...c, id: undefined })));
    return setId;
  });
  return getSet(id);
}

export function updateSet(id: number, input: StudySetInput): StudySet {
  getSet(id);
  transaction(() => {
    db.prepare('UPDATE sets SET title = ?, description = ?, updated_at = ? WHERE id = ?').run(
      input.title,
      input.description,
      now(),
      id,
    );
    saveCards(id, input.cards);
  });
  return getSet(id);
}

export function deleteSet(id: number) {
  if (db.prepare('DELETE FROM sets WHERE id = ?').run(id).changes === 0) throw new HttpError(404, 'Study set not found');
}

export function duplicateSet(id: number): StudySet {
  const original = getSet(id);
  return createSet({
    title: `${original.title} (copy)`,
    description: original.description,
    cards: original.cards.map(({ term, definition, imageUrl }) => ({ term, definition, imageUrl })),
  });
}

export function markStudied(id: number) {
  if (db.prepare('UPDATE sets SET last_studied_at = ? WHERE id = ?').run(now(), id).changes === 0) {
    throw new HttpError(404, 'Study set not found');
  }
}

export function resetProgress(id: number): StudySet {
  db.prepare(
    'UPDATE cards SET level = 0, times_correct = 0, times_incorrect = 0, last_studied_at = NULL WHERE set_id = ?',
  ).run(id);
  return getSet(id);
}

// ---------- cards & progress ----------

export function patchCard(id: number, patch: CardPatch): Card {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (typeof patch.term === 'string') (fields.push('term = ?'), values.push(patch.term.trim()));
  if (typeof patch.definition === 'string') (fields.push('definition = ?'), values.push(patch.definition.trim()));
  if (patch.imageUrl !== undefined) (fields.push('image_url = ?'), values.push(patch.imageUrl?.trim() || null));
  if (typeof patch.starred === 'boolean') (fields.push('starred = ?'), values.push(patch.starred ? 1 : 0));
  if (fields.length) db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new HttpError(404, 'Card not found');
  return mapCard(row);
}

export function recordProgress(results: ProgressResult[]): Card[] {
  const t = now();
  const correct = db.prepare(
    `UPDATE cards SET level = MIN(level + 1, ${MASTERED_LEVEL}), times_correct = times_correct + 1, last_studied_at = ? WHERE id = ?`,
  );
  const incorrect = db.prepare(
    'UPDATE cards SET level = 0, times_incorrect = times_incorrect + 1, last_studied_at = ? WHERE id = ?',
  );
  const touchSet = db.prepare('UPDATE sets SET last_studied_at = ? WHERE id = (SELECT set_id FROM cards WHERE id = ?)');
  transaction(() => {
    for (const r of results) {
      (r.correct ? correct : incorrect).run(t, r.cardId);
      touchSet.run(t, r.cardId);
    }
  });
  const ids = [...new Set(results.map((r) => r.cardId))];
  if (!ids.length) return [];
  return (db.prepare(`SELECT * FROM cards WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Row[]).map(
    mapCard,
  );
}

// ---------- match scores & tests ----------

export function listMatchScores(setId: number): MatchScore[] {
  return (db.prepare('SELECT * FROM match_scores WHERE set_id = ? ORDER BY time_ms LIMIT 10').all(setId) as Row[]).map(
    (r) => ({ id: r.id, setId: r.set_id, timeMs: r.time_ms, createdAt: r.created_at }),
  );
}

export function addMatchScore(setId: number, timeMs: number): MatchScore {
  getSet(setId);
  const createdAt = now();
  const { lastInsertRowid } = db
    .prepare('INSERT INTO match_scores (set_id, time_ms, created_at) VALUES (?, ?, ?)')
    .run(setId, Math.round(timeMs), createdAt);
  return { id: Number(lastInsertRowid), setId, timeMs: Math.round(timeMs), createdAt };
}

export function listTests(setId: number): TestResult[] {
  return (
    db.prepare('SELECT * FROM test_results WHERE set_id = ? ORDER BY created_at DESC LIMIT 20').all(setId) as Row[]
  ).map((r) => ({ id: r.id, setId: r.set_id, score: r.score, total: r.total, createdAt: r.created_at }));
}

export function addTest(setId: number, score: number, total: number): TestResult {
  getSet(setId);
  const createdAt = now();
  const { lastInsertRowid } = db
    .prepare('INSERT INTO test_results (set_id, score, total, created_at) VALUES (?, ?, ?, ?)')
    .run(setId, score, total, createdAt);
  return { id: Number(lastInsertRowid), setId, score, total, createdAt };
}

// ---------- folders ----------

export function listFolders(): Folder[] {
  const rows = db.prepare('SELECT * FROM folders ORDER BY name COLLATE NOCASE').all() as Row[];
  const links = db.prepare('SELECT folder_id, set_id FROM folder_sets ORDER BY added_at').all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.created_at,
    setIds: links.filter((l) => l.folder_id === r.id).map((l) => l.set_id as number),
  }));
}

export function getFolder(id: number): Folder {
  const folder = listFolders().find((f) => f.id === id);
  if (!folder) throw new HttpError(404, 'Folder not found');
  return folder;
}

export function parseFolderInput(body: any): FolderInput {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) throw new HttpError(400, 'Folder name is required');
  return { name, description: typeof body.description === 'string' ? body.description.trim() : '' };
}

export function createFolder(input: FolderInput): Folder {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO folders (name, description, created_at) VALUES (?, ?, ?)')
    .run(input.name, input.description, now());
  return getFolder(Number(lastInsertRowid));
}

export function updateFolder(id: number, input: FolderInput): Folder {
  db.prepare('UPDATE folders SET name = ?, description = ? WHERE id = ?').run(input.name, input.description, id);
  return getFolder(id);
}

export function deleteFolder(id: number) {
  if (db.prepare('DELETE FROM folders WHERE id = ?').run(id).changes === 0) throw new HttpError(404, 'Folder not found');
}

export function addSetToFolder(folderId: number, setId: number): Folder {
  getFolder(folderId);
  getSet(setId);
  db.prepare('INSERT OR IGNORE INTO folder_sets (folder_id, set_id, added_at) VALUES (?, ?, ?)').run(
    folderId,
    setId,
    now(),
  );
  return getFolder(folderId);
}

export function removeSetFromFolder(folderId: number, setId: number): Folder {
  db.prepare('DELETE FROM folder_sets WHERE folder_id = ? AND set_id = ?').run(folderId, setId);
  return getFolder(folderId);
}
