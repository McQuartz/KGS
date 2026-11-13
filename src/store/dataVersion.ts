import { create } from 'zustand';

/** Incremented after every DB write so `useQuery` hooks re-run. */
export const useDataVersion = create<{ v: number }>(() => ({ v: 0 }));
export const bumpData = () => useDataVersion.setState((s) => ({ v: s.v + 1 }));
