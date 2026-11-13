import { useCallback } from 'react';
import { useSettings, type Lang } from '../store/settings';
import * as common from './strings/common';
import * as dashboard from './strings/dashboard';
import * as train from './strings/train';
import * as history from './strings/history';
import * as exercise from './strings/exercise';
import * as body from './strings/body';
import * as settings from './strings/settings';
import * as data from './strings/data';

const parts = [common, dashboard, train, history, exercise, body, settings, data];
const EN: Record<string, string> = Object.assign({}, ...parts.map((p) => p.en));
const DE: Record<string, string> = Object.assign({}, ...parts.map((p) => p.de));

export type TFunc = (key: string, params?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = (lang === 'de' ? DE[key] : undefined) ?? EN[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT(): TFunc {
  const lang = useSettings((s) => s.lang);
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

export function locale(lang: Lang) {
  return lang === 'de' ? 'de-DE' : 'en-US';
}
