import type { ThemeName } from '../store/settings';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  good: string;
  warn: string;
  bad: string;
}

export interface Theme {
  name: ThemeName;
  dark: boolean;
  c: Palette;
  font: { regular: string; medium: string; semibold: string; bold: string };
  num: { regular: string; medium: string; semibold: string };
  r: number;
  rSm: number;
  /** card border width (0 for ash, 1 for stone) */
  cardBorder: number;
  /** cards have a soft shadow in ash light */
  cardShadow: boolean;
  titleWeight: '600' | '700';
}

// Values taken 1:1 from the approved mockup (mockups/index.html).
const PALETTES: Record<ThemeName, { light: Palette; dark: Palette }> = {
  ash: {
    light: { bg: '#F1F1EF', surface: '#FAFAF9', surface2: '#E7E7E4', text: '#1F1F21', muted: '#6A6A6E', line: '#DCDCD8', accent: '#985C58', accentInk: '#FFFFFF', accentSoft: '#EFE1DE', good: '#3E7957', warn: '#A3772D', bad: '#A64F49' },
    dark: { bg: '#141414', surface: '#1C1C1D', surface2: '#262627', text: '#E7E6E3', muted: '#908F8C', line: '#2D2D2E', accent: '#D6A09A', accentInk: '#241615', accentSoft: '#3A2826', good: '#86C19A', warn: '#D9AE63', bad: '#E0918A' },
  },
  stone: {
    light: { bg: '#EFEEEA', surface: '#F9F8F5', surface2: '#E7E5E0', text: '#23262A', muted: '#6B6F75', line: '#DAD7D1', accent: '#3E6D61', accentInk: '#FFFFFF', accentSoft: '#DCE6E1', good: '#3D7A55', warn: '#A97A2C', bad: '#A6544A' },
    dark: { bg: '#15181A', surface: '#1D2124', surface2: '#272C30', text: '#E3E5E2', muted: '#8E9591', line: '#2E3337', accent: '#86B8A8', accentInk: '#0F201B', accentSoft: '#21342E', good: '#7DBB8F', warn: '#D3A65A', bad: '#DA8B7F' },
  },
};

export function makeTheme(name: ThemeName, dark: boolean): Theme {
  const c = PALETTES[name][dark ? 'dark' : 'light'];
  if (name === 'ash') {
    return {
      name, dark, c,
      font: { regular: 'Figtree_400Regular', medium: 'Figtree_500Medium', semibold: 'Figtree_600SemiBold', bold: 'Figtree_700Bold' },
      num: { regular: 'Figtree_500Medium', medium: 'Figtree_600SemiBold', semibold: 'Figtree_700Bold' },
      r: 12, rSm: 9, cardBorder: 0, cardShadow: !dark, titleWeight: '700',
    };
  }
  return {
    name, dark, c,
    font: { regular: 'IBMPlexSans_400Regular', medium: 'IBMPlexSans_500Medium', semibold: 'IBMPlexSans_600SemiBold', bold: 'IBMPlexSans_600SemiBold' },
    num: { regular: 'IBMPlexMono_400Regular', medium: 'IBMPlexMono_500Medium', semibold: 'IBMPlexMono_500Medium' },
    r: 14, rSm: 10, cardBorder: 1, cardShadow: false, titleWeight: '600',
  };
}

/** Hex + alpha → rgba() */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Ordered series colors for multi-line charts (derived from palette). */
export function seriesColors(t: Theme): string[] {
  return [t.c.accent, t.c.good, t.c.warn, t.c.muted, t.c.bad];
}
