import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as repo from './repo';
import { HttpError } from './repo';
import type { ProgressResult } from '../shared/types';

const app = express();
app.use(express.json({ limit: '5mb' }));

function toId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

// ---------- sets ----------

app.get('/api/sets', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  res.json(repo.listSets(q || undefined));
});
app.post('/api/sets', (req, res) => {
  res.status(201).json(repo.createSet(repo.parseSetInput(req.body)));
});
app.get('/api/sets/:id', (req, res) => {
  res.json(repo.getSet(toId(req.params.id)));
});
app.put('/api/sets/:id', (req, res) => {
  res.json(repo.updateSet(toId(req.params.id), repo.parseSetInput(req.body)));
});
app.delete('/api/sets/:id', (req, res) => {
  repo.deleteSet(toId(req.params.id));
  res.status(204).end();
});
app.post('/api/sets/:id/duplicate', (req, res) => {
  res.status(201).json(repo.duplicateSet(toId(req.params.id)));
});
app.post('/api/sets/:id/studied', (req, res) => {
  repo.markStudied(toId(req.params.id));
  res.status(204).end();
});
app.post('/api/sets/:id/reset-progress', (req, res) => {
  res.json(repo.resetProgress(toId(req.params.id)));
});

// ---------- cards & progress ----------

app.patch('/api/cards/:id', (req, res) => {
  res.json(repo.patchCard(toId(req.params.id), req.body ?? {}));
});
app.post('/api/progress', (req, res) => {
  const results = req.body?.results;
  if (!Array.isArray(results)) throw new HttpError(400, 'results must be an array');
  const parsed: ProgressResult[] = results.map((r: any) => ({ cardId: toId(r?.cardId), correct: !!r?.correct }));
  res.json(repo.recordProgress(parsed));
});

// ---------- match scores & tests ----------

app.get('/api/sets/:id/match-scores', (req, res) => {
  res.json(repo.listMatchScores(toId(req.params.id)));
});
app.post('/api/sets/:id/match-scores', (req, res) => {
  const timeMs = Number(req.body?.timeMs);
  if (!Number.isFinite(timeMs) || timeMs <= 0) throw new HttpError(400, 'timeMs must be a positive number');
  res.status(201).json(repo.addMatchScore(toId(req.params.id), timeMs));
});
app.get('/api/sets/:id/tests', (req, res) => {
  res.json(repo.listTests(toId(req.params.id)));
});
app.post('/api/sets/:id/tests', (req, res) => {
  const score = Number(req.body?.score);
  const total = Number(req.body?.total);
  if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0 || score > total) {
    throw new HttpError(400, 'Invalid score');
  }
  res.status(201).json(repo.addTest(toId(req.params.id), score, total));
});

// ---------- folders ----------

app.get('/api/folders', (_req, res) => {
  res.json(repo.listFolders());
});
app.post('/api/folders', (req, res) => {
  res.status(201).json(repo.createFolder(repo.parseFolderInput(req.body)));
});
app.get('/api/folders/:id', (req, res) => {
  res.json(repo.getFolder(toId(req.params.id)));
});
app.put('/api/folders/:id', (req, res) => {
  res.json(repo.updateFolder(toId(req.params.id), repo.parseFolderInput(req.body)));
});
app.delete('/api/folders/:id', (req, res) => {
  repo.deleteFolder(toId(req.params.id));
  res.status(204).end();
});
app.put('/api/folders/:id/sets/:setId', (req, res) => {
  res.json(repo.addSetToFolder(toId(req.params.id), toId(req.params.setId)));
});
app.delete('/api/folders/:id/sets/:setId', (req, res) => {
  res.json(repo.removeSetFromFolder(toId(req.params.id), toId(req.params.setId)));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------- built client (production) ----------

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET') res.sendFile(path.join(distDir, 'index.html'));
    else next();
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Quizzle API listening on http://localhost:${port}`);
});
