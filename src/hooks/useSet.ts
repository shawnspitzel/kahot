import { useCallback, useEffect, useState } from 'react';
import type { StudySet } from '../../shared/types';
import { api } from '../api';

/** Loads a study set. Study modes pass `studying` so the set moves to the top of "Recent". */
export function useSet(id: number, studying = false) {
  const [set, setSet] = useState<StudySet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      api
        .getSet(id)
        .then((s) => {
          setSet(s);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [id],
  );

  useEffect(() => {
    void reload();
    if (studying) api.markStudied(id).catch(() => {});
  }, [reload, studying, id]);

  return { set, setSet, error, reload };
}
