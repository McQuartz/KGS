// Strings for the "data" area. English is the source of truth; German may lag (falls back to EN).
export const en = {} as const;
export const de: Partial<Record<keyof typeof en, string>> = {};
