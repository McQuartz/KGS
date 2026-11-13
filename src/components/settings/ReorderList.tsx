import { View } from 'react-native';
import { IconButton, Txt } from '../ui';
import { useT } from '../../i18n';
import { Toggle } from './parts';

export interface ReorderItem { id: string; label: string; visible: boolean; hint?: string }

/** Up/down reorder + visibility toggle list. `onChange` receives the new id/visible order. */
export function ReorderList({ items, onChange }: { items: ReorderItem[]; onChange: (next: { id: string; visible: boolean }[]) => void }) {
  const t = useT();
  const emit = (arr: ReorderItem[]) => onChange(arr.map((i) => ({ id: i.id, visible: i.visible })));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    emit(a);
  };
  return (
    <View style={{ gap: 4 }}>
      {items.map((it, i) => (
        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ opacity: i === 0 ? 0.25 : 1 }}>
            <IconButton name="up" size={18} accessibilityLabel={t('set.moveUp')} onPress={() => move(i, -1)} />
          </View>
          <View style={{ opacity: i === items.length - 1 ? 0.25 : 1 }}>
            <IconButton name="down" size={18} accessibilityLabel={t('set.moveDown')} onPress={() => move(i, 1)} />
          </View>
          <View style={{ flex: 1, paddingLeft: 4 }}>
            <Txt numberOfLines={1}>{it.label}</Txt>
            {it.hint ? <Txt v="small">{it.hint}</Txt> : null}
          </View>
          <Toggle value={it.visible} onChange={(v) => emit(items.map((x) => (x.id === it.id ? { ...x, visible: v } : x)))} />
        </View>
      ))}
    </View>
  );
}
