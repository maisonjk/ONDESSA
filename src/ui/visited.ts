import { useEffect } from 'react';

/** Features the person has opened at least once, so "New" hints can disappear. Not health data. */
const VISITED_KEY = 'ondessa.visited';

export function visited(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useMarkVisited(id: string, skip: boolean) {
  useEffect(() => {
    if (skip) return;
    try {
      const v = visited();
      if (!v.includes(id)) localStorage.setItem(VISITED_KEY, JSON.stringify([...v, id]));
    } catch {
      /* storage unavailable */
    }
  }, [id, skip]);
}
