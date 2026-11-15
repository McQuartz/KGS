import { Pressable, View } from 'react-native';
import { estimate1RM } from '../../analysis';
import type { Exercise, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';
import { Icon, Txt } from '../ui';
import { shortSetText } from './util';

/** Round check circle of a set row (filled accent when done). */
export function CheckCircle({ done }: { done: boolean }) {
  const th = useTheme();
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: done ? th.c.accent : th.c.line, backgroundColor: done ? th.c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {done ? <Icon name="check" size={14} color={th.c.accentInk} strokeWidth={2.2} /> : null}
    </View>
  );
}

/** Mockup .setrow: index (W for warm-up), "weight × reps", extras, check circle. `cur` = highlighted current set. */
export function SetRow({ set, index, exercise, isPR, onPress, text, cur, pending }: {
  set?: WorkoutSet; index: number | string | null; exercise?: Exercise | undefined; isPR?: boolean; onPress?: () => void;
  /** override text for planned (not yet logged) rows */ text?: string; cur?: boolean; pending?: boolean;
}) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const show1rm = useSettings((s) => s.show1rm);
  const warm = set ? set.isWarmup : typeof index === 'string';
  const e1 = set && show1rm && !set.isWarmup && exercise?.type !== 'cardio' ? estimate1RM(set.weight, set.reps) : NaN;
  const label = warm ? 'W' : index;
  return (
    <Pressable
      onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderRadius: th.rSm, backgroundColor: cur ? th.c.accentSoft : pressed ? th.c.surface2 : 'transparent', opacity: warm ? 0.75 : 1 })}
    >
      <View style={{ width: 26 }}>
        <Txt style={{ textAlign: 'center', fontFamily: cur || warm ? th.num.semibold : th.num.regular, fontSize: 13, color: cur ? th.c.accent : th.c.muted }}>{label}</Txt>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt v="num" color={pending ? th.c.muted : th.c.text}>{text ?? (set ? shortSetText(set, exercise, f, t) : '')}</Txt>
        {isPR ? (
          <View style={{ height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: th.c.accentSoft, justifyContent: 'center' }}>
            <Txt v="xs" color={th.c.accent} style={{ fontFamily: th.font.semibold }}>PR</Txt>
          </View>
        ) : null}
      </View>
      {Number.isFinite(e1) ? <Txt v="xs">{t('train.e1rm', { v: f.lift(e1), unit: f.wUnit })}</Txt> : null}
      {set?.note ? <Icon name="note" size={13} color={th.c.muted} /> : null}
      {set && set.restSec != null ? <Txt v="xs">{t('train.rest')} {f.mmss(set.restSec)}</Txt> : null}
      <CheckCircle done={!!set} />
    </Pressable>
  );
}
