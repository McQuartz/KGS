import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Vibration, View } from 'react-native';
import { alpha, useTheme } from '../../theme';
import { useFormat } from '../../lib/format';
import { useT } from '../../i18n';
import { Txt } from '../ui';

export interface RestState { start: number; dur: number }

/** Countdown bar (mockup .restbar). Ticks itself every second so the rest of the screen does not re-render. */
export function RestBar({ rest, onAdjust, onSkip }: { rest: RestState; onAdjust: (d: number) => void; onSkip: () => void }) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const [now, setNow] = useState(Date.now());
  const notified = useRef(false);
  useEffect(() => {
    notified.current = false;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rest.start]);
  const el = (now - rest.start) / 1000;
  const rem = rest.dur - el;
  const over = rem < 0;
  useEffect(() => {
    if (rem <= 0 && !notified.current) {
      notified.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Vibration.vibrate([0, 300, 150, 300]);
    }
  }, [rem]);
  const btn = { height: 32, paddingHorizontal: 10, borderRadius: th.rSm, justifyContent: 'center', backgroundColor: alpha(th.c.bg, 0.16) } as const;
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: th.c.text, borderRadius: th.r, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt v="xs" color={th.c.bg} style={{ opacity: 0.7 }}>{t('train.rest')} · {t('train.target')} {f.mmss(rest.dur)}</Txt>
        <Txt v="num" color={over ? th.c.warn : th.c.bg} style={{ fontSize: 22, fontFamily: th.num.semibold }}>{over ? '+' : ''}{f.mmss(Math.abs(rem))}</Txt>
      </View>
      <Pressable style={btn} onPress={() => onAdjust(-15)}><Txt color={th.c.bg} style={{ fontFamily: th.font.semibold, fontSize: 13 }}>−15</Txt></Pressable>
      <Pressable style={btn} onPress={() => onAdjust(15)}><Txt color={th.c.bg} style={{ fontFamily: th.font.semibold, fontSize: 13 }}>+15</Txt></Pressable>
      <Pressable style={btn} onPress={onSkip}><Txt color={th.c.bg} style={{ fontFamily: th.font.semibold, fontSize: 13 }}>{t('train.skip')}</Txt></Pressable>
      <View style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${Math.min(100, Math.max(0, (el / Math.max(1, rest.dur)) * 100))}%`, backgroundColor: th.c.accent }} />
    </View>
  );
}
