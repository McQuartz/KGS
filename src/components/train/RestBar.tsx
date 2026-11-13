import { Pressable, View } from 'react-native';
import { useFormat } from '../../lib/format';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Txt } from '../ui';

export interface RestState { start: number; dur: number }

/** Countdown bar shown above the footer after logging a set. `now` ticks every second from the parent. */
export function RestBar({ rest, now, onAdjust, onSkip }: { rest: RestState; now: number; onAdjust: (d: number) => void; onSkip: () => void }) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const el = (now - rest.start) / 1000;
  const rem = rest.dur - el;
  const over = rem < 0;
  const btn = { paddingHorizontal: 12, height: 36, borderRadius: th.rSm, justifyContent: 'center' } as const;
  const lbl = { color: th.c.accentInk, fontFamily: th.font.semibold, fontSize: 14 } as const;
  return (
    <View style={{ backgroundColor: th.c.text, borderRadius: th.r, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 14, gap: 4 }}>
        <View style={{ flex: 1 }}>
          <Txt v="small" color={th.c.bg} style={{ opacity: 0.7 }}>{t('train.rest')} · {t('train.target')} {f.mmss(rest.dur)}</Txt>
          <Txt v="numLg" color={over ? th.c.warn : th.c.bg}>{over ? '+' : ''}{f.mmss(Math.abs(rem))}</Txt>
        </View>
        <Pressable style={btn} onPress={() => onAdjust(-15)}><Txt style={{ ...lbl, color: th.c.bg }}>−15</Txt></Pressable>
        <Pressable style={btn} onPress={() => onAdjust(15)}><Txt style={{ ...lbl, color: th.c.bg }}>+15</Txt></Pressable>
        <Pressable style={btn} onPress={onSkip}><Txt style={{ ...lbl, color: th.c.bg }}>{t('train.skip')}</Txt></Pressable>
      </View>
      <View style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${Math.min(100, Math.max(0, (el / Math.max(1, rest.dur)) * 100))}%`, backgroundColor: over ? th.c.warn : th.c.accent }} />
    </View>
  );
}
