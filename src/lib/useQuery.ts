import { useMemo } from 'react';
import { useDataVersion } from '../store/dataVersion';

/**
 * Runs a synchronous DB/analysis function and re-runs it whenever data changes
 * (any repo write) or `deps` change.
 */
export function useQuery<T>(fn: () => T, deps: unknown[] = []): T {
  const v = useDataVersion((s) => s.v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, [v, ...deps]);
}
