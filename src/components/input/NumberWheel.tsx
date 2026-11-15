import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTheme } from '../../theme';
import { useFormat } from '../../lib/format';
import { hapticTick } from './haptics';
import { clampNum, decimalSep, roundTo } from './util';

const ITEM_H = 44;
const ROWS = 5;

function Column({ data, index, onIndex, width }: { data: string[]; index: number; onIndex: (i: number) => void; width: number }) {
  const t = useTheme();
  const ref = useRef<FlatList<string>>(null);
  const [live, setLive] = useState(index);
  const lastScrolled = useRef(index);

  useEffect(() => {
    if (index !== lastScrolled.current) {
      lastScrolled.current = index;
      setLive(index);
      ref.current?.scrollToOffset({ offset: index * ITEM_H, animated: false });
    }
  }, [index]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (i !== lastScrolled.current) {
      lastScrolled.current = i;
      setLive(i);
      hapticTick();
      onIndex(i);
    }
  }, [data.length, onIndex]);

  return (
    <View style={{ width, height: ITEM_H * ROWS }}>
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        initialScrollIndex={index}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(ROWS / 2) }}
        renderItem={({ item, index: i }) => (
          <Text
            onPress={() => ref.current?.scrollToOffset({ offset: i * ITEM_H, animated: true })}
            style={{ height: ITEM_H, lineHeight: ITEM_H, textAlign: 'center', fontFamily: i === live ? t.num.semibold : t.num.regular, fontSize: i === live ? 26 : 20, color: i === live ? t.c.text : t.c.muted, opacity: i === live ? 1 : 0.7 }}
          >
            {item}
          </Text>
        )}
      />
    </View>
  );
}

export interface NumberWheelProps {
  value: number | null;
  onChange: (v: number) => void;
  decimals?: number;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: number | null;
  unit?: string;
  /** show the big value line above the wheels (default true) */
  showDisplay?: boolean;
}

/** Drum wheel(s): integer wheel plus a decimal wheel when decimals > 0. */
export function NumberWheel({ value, onChange, decimals = 0, step = 1, min, max, placeholder, unit, showDisplay = true }: NumberWheelProps) {
  const t = useTheme();
  const f = useFormat();
  const sep = decimalSep(f.locale);
  const lo = Math.floor(min ?? 0);
  const start = value ?? placeholder ?? lo;
  const hi = Math.max(Math.ceil(max ?? Math.max(start + 150, 300)), lo + 1);

  const decStep = decimals > 0 ? (step < 1 ? step : 10 ** -decimals) : 0;
  const nDec = decStep > 0 ? Math.max(1, Math.round(1 / decStep)) : 0;

  const ints = useMemo(() => Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)), [lo, hi]);
  const decs = useMemo(
    () => Array.from({ length: nDec }, (_, j) => String(Math.round(j * decStep * 10 ** decimals)).padStart(decimals, '0')),
    [nDec, decStep, decimals],
  );

  // initial indices derive from the starting value only; afterwards the wheels are the source of truth
  const init = useMemo(() => {
    let ip = Math.floor(start + 1e-9);
    let dj = nDec ? Math.round((start - ip) / decStep) : 0;
    if (nDec && dj >= nDec) { ip += 1; dj = 0; }
    return { ii: Math.max(0, Math.min(hi - lo, ip - lo)), dj };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ii, setIi] = useState(init.ii);
  const [dj, setDj] = useState(init.dj);

  const emit = (i: number, j: number) => {
    const v = roundTo(lo + i + (nDec ? j * decStep : 0), decimals);
    onChange(clampNum(v, min, max));
  };

  const shown = roundTo(lo + ii + (nDec ? dj * decStep : 0), decimals);
  const dispText = clampNum(shown, min, max);

  return (
    <View style={{ gap: 8 }}>
      {showDisplay ? <View style={{ alignItems: 'center' }}>
        <Text>
          <Text style={{ fontFamily: t.num.semibold, fontSize: 36, color: t.c.text, letterSpacing: -1 }}>{f.num(dispText, decimals)}</Text>
          {unit ? <Text style={{ fontFamily: t.font.regular, fontSize: 16, color: t.c.muted }}>{' ' + unit}</Text> : null}
        </Text>
      </View> : null}
      <View style={{ height: ITEM_H * ROWS, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ITEM_H * Math.floor(ROWS / 2), height: ITEM_H, backgroundColor: t.c.accentSoft, borderRadius: t.rSm }} />
        <Column data={ints} index={ii} width={110} onIndex={(i) => { setIi(i); emit(i, dj); }} />
        {nDec ? (
          <>
            <Text style={{ fontFamily: t.num.semibold, fontSize: 26, color: t.c.text, width: 18, textAlign: 'center' }}>{sep}</Text>
            <Column data={decs} index={dj} width={80} onIndex={(j) => { setDj(j); emit(ii, j); }} />
          </>
        ) : null}
        {unit ? <Text style={{ fontFamily: t.font.regular, fontSize: 16, color: t.c.muted, marginLeft: 10, width: 36 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}
