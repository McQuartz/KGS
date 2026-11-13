import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useFormat } from '../../lib/format';
import { hapticLight } from './haptics';
import { clampNum, decimalSep } from './util';

export interface NumberPadProps {
  value: number | null;
  onChange: (v: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
  placeholder?: number | null;
  label?: string;
  unit?: string;
  /** show the value display above the keys (default true) */
  showDisplay?: boolean;
  size?: 'md' | 'lg';
}

/** Custom numeric keypad. The first key press replaces the current value. */
export function NumberPad({ value, onChange, decimals = 0, min, max, placeholder, label, unit, showDisplay = true, size = 'lg' }: NumberPadProps) {
  const t = useTheme();
  const f = useFormat();
  const sep = decimalSep(f.locale);
  const [buf, setBuf] = useState<string | null>(null); // null = untouched ("fresh")
  const lastEmitted = useRef<number | null>(null);

  // when value changes from outside, return to fresh state
  useEffect(() => {
    if (value !== lastEmitted.current) setBuf(null);
  }, [value]);

  const maxInt = max !== undefined && Number.isFinite(max) ? String(Math.floor(Math.max(0, max))).length : 5;

  const press = (k: string) => {
    hapticLight();
    let b = buf ?? '';
    if (k === 'del') b = b.slice(0, -1);
    else if (k === '.') {
      if (decimals <= 0 || b.includes('.')) return;
      b = (b || '0') + '.';
    } else {
      const [a, d] = b.split('.');
      if (d === undefined) {
        if (a.length >= maxInt && a !== '0') return;
      } else if (d.length >= decimals) return;
      b = (b === '0' ? '' : b) + k;
    }
    const parsed = parseFloat(b);
    const num = Number.isFinite(parsed) ? parsed : 0;
    if (max !== undefined && num > max) return;
    setBuf(b);
    const out = clampNum(num, min, max);
    lastEmitted.current = out;
    onChange(out);
  };

  const shown = buf !== null ? (buf === '' ? '0' : buf.replace('.', sep)) : value !== null ? f.num(value, decimals) : placeholder != null ? f.num(placeholder, decimals) : '0';
  const dim = buf === null && value === null && placeholder != null;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals > 0 ? '.' : '', '0', 'del'];

  return (
    <View style={{ gap: 12 }}>
      {showDisplay ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', backgroundColor: t.c.surface, borderRadius: t.rSm, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: 12, color: t.c.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label ?? ''}</Text>
          <Text>
            <Text style={{ fontFamily: t.num.semibold, fontSize: size === 'lg' ? 36 : 28, color: dim ? t.c.muted : t.c.text, letterSpacing: -1 }}>{shown}</Text>
            {unit ? <Text style={{ fontFamily: t.font.regular, fontSize: 16, color: t.c.muted }}>{' ' + unit}</Text> : null}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={{ width: '31.5%', height: 56 }} />
          ) : (
            <Pressable
              key={i}
              accessibilityLabel={k === 'del' ? 'Delete' : k}
              onPress={() => press(k)}
              onLongPress={k === 'del' ? () => { hapticLight(); setBuf(''); lastEmitted.current = clampNum(0, min, max); onChange(lastEmitted.current); } : undefined}
              style={({ pressed }) => ({ width: '31.5%', flexGrow: 1, height: 56, borderRadius: t.rSm, backgroundColor: pressed ? t.c.line : t.c.surface2, alignItems: 'center', justifyContent: 'center' })}
            >
              <Text style={{ fontFamily: t.num.medium, fontSize: 24, color: t.c.text }}>{k === 'del' ? '⌫' : k === '.' ? sep : k}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}
