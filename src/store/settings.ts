import { create } from 'zustand';
import { kvGet, kvSet } from '../db/repo';

export type ThemeName = 'ash' | 'stone';
export type ColorMode = 'system' | 'light' | 'dark';
export type Lang = 'en' | 'de';
export type Units = 'metric' | 'imperial';
export type InputMethod = 'pad' | 'wheel' | 'stepper';
export type ChartType = 'line' | 'dots' | 'bars';
export type DashboardCardId = 'weight' | 'strength' | 'last' | 'body' | 'volume' | 'consistency' | 'goal';
export type HistorySeriesId = 'weight' | 'strength' | 'volume' | string; // + metric ids

export interface Settings {
  theme: ThemeName;
  mode: ColorMode;
  lang: Lang;
  units: Units;
  input: InputMethod;
  /** +/- stepper small step in display units (large step = 10×) */
  stepperStep: number;
  prefill: boolean;
  /** show/log warm-up sets */
  warmups: boolean;
  /** 'all' = log every set, 'pr' = only the day's best set per exercise */
  logMode: 'all' | 'pr';
  /** show estimated 1RM (off by default) */
  show1rm: boolean;
  restSec: number;
  hints: boolean;
  trendMethod: 'ema' | 'median';
  goalWeight: number | null; // kg
  weeklyTarget: number;
  dashboardCards: { id: DashboardCardId; visible: boolean }[];
  dashboardChart: ChartType;
  historySeries: { id: HistorySeriesId; visible: boolean }[];
  historyChart: ChartType;
  demoData: boolean;
  seenHintIds: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'ash',
  mode: 'system',
  lang: 'en',
  units: 'metric',
  input: 'pad',
  stepperStep: 1,
  prefill: true,
  warmups: false,
  logMode: 'all',
  show1rm: false,
  restSec: 120,
  hints: true,
  trendMethod: 'ema',
  goalWeight: null,
  weeklyTarget: 3,
  dashboardCards: [
    { id: 'weight', visible: true },
    { id: 'strength', visible: true },
    { id: 'last', visible: false },
    { id: 'goal', visible: false },
    { id: 'body', visible: false },
    { id: 'volume', visible: false },
    { id: 'consistency', visible: false },
  ],
  dashboardChart: 'line',
  historySeries: [
    { id: 'weight', visible: true },
    { id: 'strength', visible: true },
    { id: 'volume', visible: true },
    { id: 'waist', visible: true },
    { id: 'bf', visible: true },
    { id: 'muscle', visible: true },
  ],
  historyChart: 'line',
  demoData: false,
  seenHintIds: [],
};

const KEY = 'settings.v1';

interface SettingsStore extends Settings {
  loaded: boolean;
  load: () => void;
  set: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: () => {
    let stored: Partial<Settings> = {};
    try {
      const raw = kvGet(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = {};
    }
    set({ ...DEFAULT_SETTINGS, ...stored, loaded: true });
  },
  set: (patch) => {
    set(patch);
    const { loaded, load, set: _s, ...rest } = { ...get() };
    kvSet(KEY, JSON.stringify(rest));
  },
}));

export function getSettings(): Settings {
  return useSettings.getState();
}
