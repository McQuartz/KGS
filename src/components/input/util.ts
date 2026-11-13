export function roundTo(v: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(v * m + (v >= 0 ? 1e-9 : -1e-9)) / m;
}

export function clampNum(v: number, min?: number, max?: number): number {
  let r = v;
  if (max !== undefined) r = Math.min(r, max);
  if (min !== undefined) r = Math.max(r, min);
  return r;
}

/** Decimal separator of a locale ('.' or ','). */
export function decimalSep(locale: string): string {
  const s = (1.1).toLocaleString(locale);
  return s.charAt(1) === ',' ? ',' : '.';
}
