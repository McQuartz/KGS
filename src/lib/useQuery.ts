import { useIsFocused } from 'expo-router';
import { useMemo, useRef } from 'react';
import { useDataVersion } from '../store/dataVersion';

/**
 * Runs a synchronous DB/analysis function and re-runs it whenever data changes
 * (any repo write) or `deps` change.
 *
 * Performance: tab screens stay mounted in the pager. While a screen is not focused, data
 * changes don't trigger recomputation (logging a set no longer recomputes the dashboard and
 * history analysis in the background); it catches up as soon as the screen is focused again.
 */
export function useQuery<T>(fn: () => T, deps: unknown[] = []): T {
  const v = useDataVersion((s) => s.v);
  let focused = true;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    focused = useIsFocused();
  } catch {
    focused = true; // outside a navigator (e.g. inside a Modal portal)
  }
  const seen = useRef(v);
  if (focused) seen.current = v;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, [seen.current, ...deps]);
}
