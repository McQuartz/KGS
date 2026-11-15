import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Txt } from '../ui';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Toggle } from './parts';

export interface ReorderItem { id: string; label: string; visible: boolean; hint?: string }

/** Mockup "History values" rows: move-up button (hidden on the first), label, toggle. Rendered as card rows; wrap in a Group. */
export function ReorderRows({ items, onChange }: { items: ReorderItem[]; onChange: (next: { id: string; visible: boolean }[]) => void }) {
  const t = useT();
  const th = useTheme();
  const emit = (arr: ReorderItem[]) => onChange(arr.map((i) => ({ id: i.id, visible: i.visible })));
  const up = (i: number) => {
    if (i < 1) return;
    const a = [...items];
    [a[i - 1], a[i]] = [a[i], a[i - 1]];
    emit(a);
  };
  return (
    <>
      {items.map((it, i) => (
        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, ...(i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: th.c.line } : null) }}>
          <Pressable
            accessibilityLabel={t('set.moveUp')}
            disabled={i === 0}
            hitSlop={6}
            onPress={() => up(i)}
            style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0 : 1 }}
          >
            <Icon name="up" size={16} color={th.c.text} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Txt style={{ fontSize: 13, lineHeight: 19 }} numberOfLines={1}>{it.label}</Txt>
            {it.hint ? <Txt v="xs" style={{ lineHeight: 17 }}>({it.hint})</Txt> : null}
          </View>
          <Toggle value={it.visible} onChange={(v) => emit(items.map((x) => (x.id === it.id ? { ...x, visible: v } : x)))} />
        </View>
      ))}
    </>
  );
}
