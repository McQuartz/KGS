import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFormat } from '../../lib/format';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { hapticLight } from '../input/haptics';
import { NumberWheel } from '../input/NumberWheel';
import { decimalSep } from '../input/util';
import { Button, Txt } from '../ui';
import { MockSheet } from './MockSheet';

export interface EntryField {
  key: string;
  label: string;
  value: number;
  unit?: string;
  decimals: number;
  min: number;
  max: number;
  /** wheel decimal granularity (e.g. 0.5) */
  step?: number;
}

/** Mockup editor sheet (editorSheet/padKeys/wheelField): field boxes on top, number pad or wheels below, Cancel / Next / Done. */
export function SetEntrySheet({ title, fields, startIndex = 0, mode, onCancel, onDone }: {
  title: string; fields: EntryField[]; startIndex?: number; mode: 'pad' | 'wheel';
  onCancel: () => void; onDone: (values: number[]) => void;
}) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const sep = decimalSep(f.locale);
  const [vals, setVals] = useState(() => fields.map((x) => x.value));
  const [fi, setFi] = useState(startIndex);
  const bufRef = useRef('');
  const freshRef = useRef(true);
  const [bufShown, setBufShown] = useState<string | null>(null);

  const last = fi === fields.length - 1;
  const cur = fields[fi];

  const setVal = (i: number, v: number) => setVals((a) => a.map((x, j) => (j === i ? v : x)));
  const switchTo = (i: number) => { setFi(i); freshRef.current = true; bufRef.current = ''; setBufShown(null); };

  const press = (k: string) => {
    hapticLight();
    if (freshRef.current) { bufRef.current = ''; freshRef.current = false; }
    let b = bufRef.current;
    if (k === 'del') b = b.slice(0, -1);
    else if (k === '.') {
      if (cur.decimals <= 0 || b.includes('.')) return;
      b = (b || '0') + '.';
    } else {
      const [a, d] = b.split('.');
      if (d === undefined) { if (a.length >= 3 && a !== '0') return; } else if (d.length >= cur.decimals) return;
      b = (b === '0' ? '' : b) + k;
    }
    const n = parseFloat(b) || 0;
    if (n > cur.max) return;
    bufRef.current = b;
    setBufShown(b === '' ? '0' : b.replace('.', sep));
    setVal(fi, n);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', cur.decimals > 0 ? '.' : '', '0', 'del'];
  const shownFor = (i: number) => (mode === 'pad' && i === fi && bufShown !== null ? bufShown : f.num(vals[i], fields[i].decimals));

  return (
    <MockSheet
      visible onClose={onCancel} title={title} scroll={false}
      right={<Txt v="xs">{mode === 'wheel' ? t('train.wheel') : t('train.numberPad')}</Txt>}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {fields.map((x, i) => {
          const on = mode === 'wheel' || i === fi;
          return (
            <Pressable
              key={x.key} disabled={mode === 'wheel'} onPress={() => switchTo(i)}
              style={{ flex: 1, padding: 10, paddingHorizontal: 12, borderRadius: th.rSm, backgroundColor: th.c.surface, borderWidth: 1.5, borderColor: on && mode === 'pad' ? th.c.accent : th.c.line, gap: 2 }}
            >
              <Txt v="label">{x.label}</Txt>
              <Text>
                <Text style={{ fontFamily: th.num.semibold, fontSize: 28, color: th.c.text, letterSpacing: -0.5 }}>{shownFor(i)}</Text>
                {x.unit ? <Text style={{ fontFamily: th.font.regular, fontSize: 14, color: th.c.muted }}> {x.unit}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mode === 'wheel' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
          {fields.map((x, i) => (
            <NumberWheel
              key={x.key} value={vals[i]} onChange={(v) => setVal(i, v)} decimals={x.decimals} step={x.step} min={x.min} max={x.max} unit={x.unit} showDisplay={false}
            />
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {keys.map((k, i) => (k === '' ? <View key={i} style={{ width: '31.6%', flexGrow: 1, height: 54 }} /> : (
            <Pressable
              key={i} accessibilityLabel={k === 'del' ? 'Delete' : k} onPress={() => press(k)}
              style={({ pressed }) => ({ width: '31.6%', flexGrow: 1, height: 54, borderRadius: th.rSm, backgroundColor: pressed ? th.c.accentSoft : th.c.surface, borderWidth: th.cardBorder, borderColor: th.c.line, alignItems: 'center', justifyContent: 'center', ...(th.cardShadow ? { shadowColor: '#141414', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null) })}
            >
              <Text style={{ fontFamily: th.num.medium, fontSize: 22, color: th.c.text }}>{k === 'del' ? '⌫' : k === '.' ? sep : k}</Text>
            </Pressable>
          )))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button kind="ghost" label={t('common.cancel')} onPress={onCancel} style={{ flex: 1 }} />
        <Button
          label={mode === 'pad' && !last ? `${t('train.next')} →` : t('common.done')}
          onPress={() => (mode === 'pad' && !last ? switchTo(fi + 1) : onDone(vals))} style={{ flex: 2 }}
        />
      </View>
    </MockSheet>
  );
}
