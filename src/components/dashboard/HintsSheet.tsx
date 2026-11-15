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
      {hints.map((h, i) => {
        const pr = h.key === 'hint.pr' || h.key === 'hint.streak';
        const color = pr ? t.c.accent : h.tone === 'warn' ? t.c.warn : t.c.muted;
        return (
          <Pressable
            key={h.id}
            disabled={!h.exerciseId}
            onPress={() => {
              if (!h.exerciseId) return;
              onClose();
              router.push({ pathname: '/exercise/[id]', params: { id: h.exerciseId } });
            }}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: pr ? t.c.accentSoft : t.c.surface2 }}>
              <Icon name={iconFor(h)} size={16} color={color} />
            </View>
            <View style={{ flex: 1 }}><Txt style={{ fontSize: 14 }}>{hintText(h, tr, f, exercises)}</Txt></View>
            {h.exerciseId ? <Icon name="chev" size={16} color={t.c.muted} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}
