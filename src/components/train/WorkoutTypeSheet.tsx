import { View } from 'react-native';
import { WORKOUT_TYPES } from '../../domain/catalog';
import type { WorkoutType } from '../../domain/types';
import { useT } from '../../i18n';
import { Chip, Sheet } from '../ui';

/** Sheet to pick a workout type. */
export function WorkoutTypeSheet({ visible, onClose, onPick, value, title }: {
  visible: boolean; onClose: () => void; onPick: (w: WorkoutType) => void; value?: WorkoutType; title?: string;
}) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t('train.pickType')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WORKOUT_TYPES.map((w) => (
          <Chip key={w} label={t(`wtype.${w}`)} on={w === value} onPress={() => { onPick(w); onClose(); }} />
        ))}
      </View>
    </Sheet>
  );
}
