import { Pressable, View } from 'react-native';
import { BUILTIN_EXERCISES, WORKOUT_TYPES, WORKOUT_TYPE_GROUPS } from '../../domain/catalog';
import type { WorkoutType } from '../../domain/types';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Txt } from '../ui';
import { MockSheet } from './MockSheet';

function suggestionCount(w: WorkoutType): number {
  const g = WORKOUT_TYPE_GROUPS[w];
  return g.length ? BUILTIN_EXERCISES.filter((e) => g.includes(e.muscleGroup)).length : 0;
}

/** Sheet to pick a workout type: a vertical list of rows (name + muted caption), styled like the mockup's type buttons. */
export function WorkoutTypeSheet({ visible, onClose, onPick, value, title }: {
  visible: boolean; onClose: () => void; onPick: (w: WorkoutType) => void; value?: WorkoutType; title?: string;
}) {
  const t = useT();
  const th = useTheme();
  return (
    <MockSheet visible={visible} onClose={onClose} title={title ?? t('train.pickType')}>
      <View style={{ gap: 8 }}>
        {WORKOUT_TYPES.map((w) => {
          const on = w === value;
          const n = suggestionCount(w);
          return (
            <Pressable
              key={w}
              onPress={() => { onPick(w); onClose(); }}
              style={({ pressed }) => ({ padding: 14, borderRadius: th.rSm, backgroundColor: pressed || on ? th.c.accentSoft : th.c.surface, borderWidth: 1, borderColor: on ? th.c.accent : th.c.line, gap: 2 })}
            >
              <Txt style={{ fontFamily: th.font.semibold }}>{t(`wtype.${w}`)}</Txt>
              <Txt v="xs">{n ? t('train.suggestions', { n }) : t('train.allExercises')}</Txt>
            </Pressable>
          );
        })}
      </View>
    </MockSheet>
  );
}
