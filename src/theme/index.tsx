import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { useSettings } from '../store/settings';
import { makeTheme, type Theme } from './tokens';

export * from './tokens';

export function useTheme(): Theme {
  const name = useSettings((s) => s.theme);
  const mode = useSettings((s) => s.mode);
  const sys = useColorScheme();
  const dark = mode === 'system' ? sys === 'dark' : mode === 'dark';
  return useMemo(() => makeTheme(name, dark), [name, dark]);
}
