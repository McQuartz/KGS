import { Pressable, View } from 'react-native';
import { estimate1RM } from '../../analysis';
import type { Exercise, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';
import { Icon, Txt } from '../ui';
import { setText } from './util';

/** One logged set line: index (W for warm-up), weight × reps, PR pill, note icon, optional 1RM. */
export function SetRow({ set, index, exercise, isPR, onPress }: {
  set: WorkoutSet; index: number | null; exercise: Exercise | undefined; isPR?: boolean; onPress?: () => void;
}) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const show1rm = useSettings((s) => s.show1rm);
  const muted = set.isWarmup;
  const e1 = show1rm && !set.isWarmup && exercise?.type !== 'cardio' ? estimate1RM(set.weight, set.reps) : NaN;
  const col = muted ? th.c.muted : th.c.text;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: th.c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Txt v="small" style={{ fontFamily: th.num.medium }}>{set.isWarmup || index == null ? 'W' : index}</Txt>
      </View>
      <Txt v="num" color={col} style={{ flex: 1 }}>{setText(set, exercise, f, t)}</Txt>
      {Number.isFinite(e1) ? <Txt v="small">{t('train.e1rm', { v: f.lift(e1), unit: f.wUnit })}</Txt> : null}
      {isPR ? (
        <View style={{ height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: th.c.accentSoft, justifyContent: 'center' }}>
          <Txt v="small" color={th.c.accent} style={{ fontFamily: th.font.semibold }}>PR</Txt>
        </View>
      ) : null}
      {set.note ? <Icon name="note" size={15} color={th.c.muted} /> : null}
      {set.restSec != null ? <Txt v="small">{f.mmss(set.restSec)}</Txt> : null}
    </Pressable>
  );
}
