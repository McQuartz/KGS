import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Txt } from '../ui';

export type LegendShape = 'dot' | 'line' | 'ring' | 'bar' | 'band' | 'pr';

/** Mockup .legend row: small key shape + 12px muted label. */
export function ChartLegend({ items }: { items: { shape: LegendShape; label: string }[] }) {
  const th = useTheme();
  const key = (s: LegendShape) => {
    switch (s) {
      case 'dot': return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th.c.muted, opacity: 0.6 }} />;
      case 'line': return <View style={{ width: 16, height: 2, backgroundColor: th.c.accent }} />;
      case 'ring': return <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: th.c.warn }} />;
      case 'bar': return <View style={{ width: 8, height: 10, backgroundColor: th.c.accent, opacity: 0.7, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />;
      case 'band': return <View style={{ width: 8, height: 12, backgroundColor: th.c.accent, opacity: 0.3, borderRadius: 2 }} />;
      case 'pr': return <View style={{ width: 8, height: 8, backgroundColor: th.c.accent, transform: [{ rotate: '45deg' }] }} />;
    }
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {key(it.shape)}
          <Txt v="xs">{it.label}</Txt>
        </View>
      ))}
    </View>
  );
}
