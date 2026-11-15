import Svg, { Circle, Path } from 'react-native-svg';
import { alpha, useTheme } from '../../theme';

export interface SparkPoint { t: number; v: number }

/** Tiny sparkline (mockup .minispark): faint raw dots, trend line with soft area, end dot. No axes. */
export function MiniSpark({ raw, trend, from, to, width = 64, height = 30 }: { raw: SparkPoint[]; trend: SparkPoint[]; from: number; to: number; width?: number; height?: number }) {
  const t = useTheme();
  if (trend.length < 1) return <Svg width={width} height={height} />;
  const pad = 4;
  const all = [...raw, ...trend].map((p) => p.v);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const span = Math.max(1, to - from);
  const x = (ts: number) => pad + ((ts - from) / span) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad);
  const line = trend.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const first = trend[0];
  const last = trend[trend.length - 1];
  const area = `${line}L${x(last.t).toFixed(1)} ${height}L${x(first.t).toFixed(1)} ${height}Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={alpha(t.c.accent, 0.1)} />
      {raw.map((p, i) => <Circle key={i} cx={x(p.t)} cy={y(p.v)} r={1.3} fill={t.c.muted} opacity={0.6} />)}
      <Path d={line} stroke={t.c.accent} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(last.t)} cy={y(last.v)} r={2.4} fill={t.c.accent} />
    </Svg>
  );
}
