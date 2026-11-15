import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, IconButton, Sheet, Txt } from '../ui';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useTheme } from '../../theme';

export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'All' | 'Custom';
const DAY = 86_400_000;
const RANGE_DAYS: Record<'1M' | '3M' | '6M' | '1Y', number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };
const KEYS: RangeKey[] = ['1M', '3M', '6M', '1Y', 'All', 'Custom'];

export interface RangeState {
  key: RangeKey;
  custom: { from: number; to: number } | null;
  setKey: (k: RangeKey) => void;
  setCustom: (c: { from: number; to: number }) => void;
  /** visible window in ms */
  from: number;
  to: number;
  /** full extent for panning: first data point … end of today */
  boundsFrom: number;
  boundsTo: number;
}

/** Range selection state; `first` is the earliest data timestamp (for "All"). */
export function useRange(first: number | null, initial: RangeKey = '3M'): RangeState {
  const [key, setKey] = useState<RangeKey>(initial);
  const [custom, setCustom] = useState<{ from: number; to: number } | null>(null);
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  const day = d0.getTime();
  return useMemo(() => {
    const to = day + DAY * 0.75;
    const dataFrom = first != null ? first - 2 * DAY : to - 30 * DAY;
    let from: number;
    let end = to;
    if (key === 'All') from = dataFrom;
    else if (key === 'Custom' && custom) {
      from = custom.from;
      end = custom.to;
    } else from = Math.max(dataFrom, to - RANGE_DAYS[key === 'Custom' ? '3M' : key] * DAY);
    return { key, custom, setKey, setCustom, from, to: end, boundsFrom: Math.min(dataFrom, from), boundsTo: Math.max(to, end) };
  }, [key, custom, first, day]);
}

function DateStepper({ value, onChange }: { value: number; onChange: (ts: number) => void }) {
  const t = useTheme();
  const f = useFormat();
  const shift = (unit: 'd' | 'm' | 'y', n: number) => {
    const d = new Date(value);
    const day = d.getDate();
    if (unit === 'd') d.setDate(day + n);
    else {
      d.setDate(1);
      if (unit === 'm') d.setMonth(d.getMonth() + n);
      else d.setFullYear(d.getFullYear() + n);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, dim));
    }
    onChange(d.getTime());
  };
  const d = new Date(value);
  const cell = (unit: 'd' | 'm' | 'y', label: string) => (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: t.c.surface2, borderRadius: t.rSm, paddingVertical: 4 }}>
      <IconButton name="plus" size={18} onPress={() => shift(unit, 1)} />
      <Txt v="num">{label}</Txt>
      <IconButton name="minus" size={18} onPress={() => shift(unit, -1)} />
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {cell('d', String(d.getDate()))}
      {cell('m', f.month(value))}
      {cell('y', String(d.getFullYear()))}
    </View>
  );
}

export function CustomRangeSheet({ visible, onClose, initial, onApply }: {
  visible: boolean; onClose: () => void; initial: { from: number; to: number }; onApply: (c: { from: number; to: number }) => void;
}) {
  const t = useT();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const valid = from < to;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('history.range.title')}
      footer={<Button label={t('history.range.apply')} disabled={!valid} onPress={() => { onApply({ from, to: to + DAY - 1 }); onClose(); }} />}>
      <Txt v="label">{t('history.range.from')}</Txt>
      <DateStepper value={from} onChange={setFrom} />
      <Txt v="label">{t('history.range.to')}</Txt>
      <DateStepper value={to} onChange={setTo} />
    </Sheet>
  );
}

export function RangeSelector({ range }: { range: RangeState }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const label = (k: RangeKey) => (k === 'All' ? t('history.range.all') : k === 'Custom' ? t('history.range.custom') : k);
  const initial = range.custom ?? { from: Math.max(range.from, range.to - 60 * DAY), to: Math.min(range.to, Date.now()) };
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {KEYS.map((k) => (
          <Chip key={k} label={label(k)} on={range.key === k} onPress={() => { if (k === 'Custom') setOpen(true); else range.setKey(k); }} />
        ))}
      </ScrollView>
      {open ? (
        <CustomRangeSheet visible={open} onClose={() => setOpen(false)} initial={initial}
          onApply={(c) => { range.setCustom(c); range.setKey('Custom'); }} />
      ) : null}
    </>
  );
}

