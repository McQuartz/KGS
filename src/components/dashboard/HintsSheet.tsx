import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, Sheet, Txt } from '../ui';
import type { IconName } from '../ui';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { hintText } from '../../lib/hintText';
import type { Hint } from '../../analysis';
import { listExercises } from '../../db/repo';

export function HintsSheet({ visible, onClose, hints }: { visible: boolean; onClose: () => void; hints: Hint[] }) {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const exercises = useMemo(() => new Map(listExercises(true).map((e) => [e.id, e])), [visible]);
  const iconFor = (h: Hint): IconName => (h.key === 'hint.pr' || h.key === 'hint.streak' ? 'star' : h.tone === 'warn' ? 'down' : 'info');
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('dash.hintsTitle')}>
      {hints.length === 0 ? <Txt v="muted">{tr('hints.empty')}</Txt> : null}
      {hints.map((h) => {
        const color = h.tone === 'good' ? t.c.good : h.tone === 'warn' ? t.c.warn : t.c.muted;
        return (
          <Pressable
            key={h.id}
            disabled={!h.exerciseId}
            onPress={() => {
              if (!h.exerciseId) return;
              onClose();
              router.push({ pathname: '/exercise/[id]', params: { id: h.exerciseId } });
            }}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: t.c.surface, borderRadius: t.r, padding: 14 }}
          >
            <View style={{ marginTop: 2 }}><Icon name={iconFor(h)} size={18} color={color} /></View>
            <View style={{ flex: 1 }}><Txt>{hintText(h, tr, f, exercises)}</Txt></View>
            {h.exerciseId ? <Icon name="chev" size={18} color={t.c.muted} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}
