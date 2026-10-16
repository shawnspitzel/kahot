import type {
  Card,
  CardPatch,
  Folder,
  FolderInput,
  ID,
  MatchScore,
  ProgressResult,
  StudySet,
  StudySetInput,
  StudySetSummary,
  TestResult,
} from '../shared/types';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  listSets: (q?: string) => request<StudySetSummary[]>('GET', `/api/sets${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getSet: (id: ID) => request<StudySet>('GET', `/api/sets/${id}`),
  createSet: (input: StudySetInput) => request<StudySet>('POST', '/api/sets', input),
  updateSet: (id: ID, input: StudySetInput) => request<StudySet>('PUT', `/api/sets/${id}`, input),
  deleteSet: (id: ID) => request<void>('DELETE', `/api/sets/${id}`),
  duplicateSet: (id: ID) => request<StudySet>('POST', `/api/sets/${id}/duplicate`),
  markStudied: (id: ID) => request<void>('POST', `/api/sets/${id}/studied`),
  resetProgress: (id: ID) => request<StudySet>('POST', `/api/sets/${id}/reset-progress`),

  updateCard: (id: ID, patch: CardPatch) => request<Card>('PATCH', `/api/cards/${id}`, patch),
  recordProgress: (results: ProgressResult[]) => request<Card[]>('POST', '/api/progress', { results }),

  listMatchScores: (setId: ID) => request<MatchScore[]>('GET', `/api/sets/${setId}/match-scores`),
  addMatchScore: (setId: ID, timeMs: number) => request<MatchScore>('POST', `/api/sets/${setId}/match-scores`, { timeMs }),
  listTests: (setId: ID) => request<TestResult[]>('GET', `/api/sets/${setId}/tests`),
  addTest: (setId: ID, score: number, total: number) =>
    request<TestResult>('POST', `/api/sets/${setId}/tests`, { score, total }),

  listFolders: () => request<Folder[]>('GET', '/api/folders'),
  getFolder: (id: ID) => request<Folder>('GET', `/api/folders/${id}`),
  createFolder: (input: FolderInput) => request<Folder>('POST', '/api/folders', input),
  updateFolder: (id: ID, input: FolderInput) => request<Folder>('PUT', `/api/folders/${id}`, input),
  deleteFolder: (id: ID) => request<void>('DELETE', `/api/folders/${id}`),
  addSetToFolder: (folderId: ID, setId: ID) => request<Folder>('PUT', `/api/folders/${folderId}/sets/${setId}`),
  removeSetFromFolder: (folderId: ID, setId: ID) =>
    request<Folder>('DELETE', `/api/folders/${folderId}/sets/${setId}`),
};
