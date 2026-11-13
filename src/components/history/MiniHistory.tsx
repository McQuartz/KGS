import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useFormat } from '../../lib/format';
import { useTheme } from '../../theme';
import { Txt } from '../ui';

/** Small labeled sparkline: y min/max on the left, first/last date below. Values in display units. */
export function MiniHistory({ points, decimals = 1 }: { points: { t: number; v: number }[]; decimals?: number }) {
  const th = useTheme();
  const f = useFormat();
  if (points.length < 2) return <Txt v="small">–</Txt>;
  const W = 150;
  const H = 44;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const sx = (t: number) => 3 + ((t - t0) / Math.max(1, t1 - t0)) * (W - 6);
  const sy = (v: number) => H - 4 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 8);
  const last = points[points.length - 1];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ justifyContent: 'space-between', alignItems: 'flex-end', height: H }}>
        <Txt v="small">{f.num(hi, decimals)}</Txt>
        <Txt v="small">{f.num(lo, decimals)}</Txt>
      </View>
      <View>
        <Svg width={W} height={H}>
          <Polyline points={points.map((p) => `${sx(p.t)},${sy(p.v)}`).join(' ')} fill="none" stroke={th.c.muted} strokeWidth={1.6} />
          <Circle cx={sx(last.t)} cy={sy(last.v)} r={3} fill={th.c.accent} />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt v="small">{f.date(t0)}</Txt>
          <Txt v="small">{f.date(t1)}</Txt>
        </View>
      </View>
    </View>
  );
}
