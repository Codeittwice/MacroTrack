import type MiniSearch from 'minisearch';
import { synonymVariants } from './normalize';

const OPTS = { fuzzy: 0.2, prefix: true } as const;

/**
 * Run a normalised query (plus its synonym variants) against a MiniSearch index.
 * Each variant is matched with AND (all terms); only if nothing matches do we fall back to OR.
 * Results are merged by id keeping the best score, sorted by score desc.
 */
export function runQuery<T>(
  index: MiniSearch<T>,
  text: string,
  boost?: Record<string, number>,
): { id: unknown; score: number }[] {
  if (!text.trim()) return [];
  const phrases = [text, ...synonymVariants(text)];
  const merge = (combineWith: 'AND' | 'OR') => {
    const best = new Map<unknown, number>();
    for (const p of phrases) {
      for (const r of index.search(p, boost ? { ...OPTS, boost, combineWith } : { ...OPTS, combineWith })) {
        if ((best.get(r.id) ?? -Infinity) < r.score) best.set(r.id, r.score);
      }
    }
    return [...best].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  };
  const and = merge('AND');
  return and.length ? and : merge('OR');
}
