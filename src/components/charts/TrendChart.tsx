import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText, Circle } from 'react-native-svg';
import { GestureDetector, useExclusiveGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { useTheme, seriesColors, alpha } from '../../theme';
import { useFormat } from '../../lib/format';
import { useT } from '../../i18n';
import { Txt } from '../ui';
import { weekly } from '../../analysis/trend';
import type { ChartSeries, TrendChartProps } from './types';


const DAY = 86_400_000;
const MIN_SPAN = 5 * DAY;

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}

function xTicks(t0: number, t1: number, loc: string): { t: number; l: string }[] {
  const span = (t1 - t0) / DAY;
  const out: { t: number; l: string }[] = [];
  if (span > 75) {
    const mstep = span > 500 ? 3 : span > 250 ? 2 : 1;
    const d = new Date(t0);
    d.setDate(1);
    d.setHours(12, 0, 0, 0);
    let guard = 0;
    while (d.getTime() <= t1 && guard++ < 200) {
      if (d.getTime() >= t0 && d.getMonth() % mstep === 0) out.push({ t: d.getTime(), l: d.toLocaleDateString(loc, { month: 'short' }) });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const step = span > 35 ? 14 : span > 16 ? 7 : span > 8 ? 3 : 1;
    const d = new Date(t0);
    d.setHours(12, 0, 0, 0);
    if (step >= 7) while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    let guard = 0;
    while (d.getTime() <= t1 && guard++ < 200) {
      if (d.getTime() >= t0) out.push({ t: d.getTime(), l: d.toLocaleDateString(loc, { month: 'short', day: 'numeric' }) });
      d.setDate(d.getDate() + step);
    }
  }
  return out;
}

interface Pt { t: number; dv: number; sv: number; outlier: boolean; pr: boolean; label?: string }
interface Bucket { t0: number; t: number; dv: number; sv: number; lo: number; hi: number }
interface Prep { id: string; color: string; raw: Pt[]; trend: Pt[]; weeks: Bucket[] }
interface Cand { si: number; t: number; dv: number; sv: number; out: boolean; pr: boolean; label?: string; week?: { t0: number; lo: number; hi: number } }
interface Range { t0: number; t1: number }

export function TrendChart(props: TrendChartProps) {
  const { series, type = 'line', height = 180, zoomable = false, formatY, toDisplay, goal, zeroLine, onSelect, compact = false, unit, decimals, onViewChange } = props;
  const th = useTheme();
  const f = useFormat();
  const t = useT();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [W, setW] = useState(0);
  const [view, setView] = useState<Range | null>(null);
  const [sel, setSel] = useState<Cand | null>(null);

  const td = toDisplay ?? ((v: number) => v);
  const colors = seriesColors(th);

  // ---- data prep (display units) ----
  const prep: Prep[] = useMemo(
    () =>
      series.map((s: ChartSeries, i: number) => {
        const mapPts = (a: { t: number; v: number; outlier?: boolean; pr?: boolean; label?: string }[] | undefined): Pt[] =>
          (a ?? []).map((p) => ({ t: p.t, dv: td(p.v), sv: p.v, outlier: !!p.outlier, pr: !!p.pr, label: p.label })).sort((x, y) => x.t - y.t);
        const raw = mapPts(s.raw);
        const trend = mapPts(s.trend);
        let weeks: Bucket[] = [];
        if (type === 'bars' || type === 'band') {
          const srcArr = s.raw && s.raw.length ? s.raw.filter((p) => !p.outlier) : s.trend ?? [];
          weeks = weekly(srcArr.map((p) => ({ t: p.t, v: p.v })), s.agg ?? 'mean').map((w) => ({ t0: w.t0, t: w.t, sv: w.v, dv: td(w.v), lo: td(w.lo), hi: td(w.hi) }));
        }
        return { id: s.id, color: s.color ?? colors[i % colors.length], raw, trend, weeks };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, type, toDisplay, th],
  );

  // ---- x domain ----
  const domain: Range | null = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of prep) {
      for (const a of [p.raw, p.trend]) for (const x of a) { lo = Math.min(lo, x.t); hi = Math.max(hi, x.t); }
      for (const w of p.weeks) { lo = Math.min(lo, w.t0); hi = Math.max(hi, w.t0 + 7 * DAY); }
    }
    if (props.from !== undefined) lo = props.from;
    if (props.to !== undefined) hi = props.to;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    if (type !== 'bars' && props.from === undefined && props.to === undefined) { lo -= DAY / 2; hi += DAY / 2; }
    if (hi - lo < MIN_SPAN) {
      const c = (hi + lo) / 2;
      lo = c - MIN_SPAN / 2;
      hi = c + MIN_SPAN / 2;
    }
    return { t0: lo, t1: hi };
  }, [prep, props.from, props.to, type]);

  // full extent the user may pan/zoom within (at least the initial window)
  const bounds: Range | null = domain
    ? { t0: Math.min(domain.t0, props.boundsFrom ?? domain.t0), t1: Math.max(domain.t1, props.boundsTo ?? domain.t1) }
    : null;

  const clampView = (t0: number, span: number, d: Range): Range => {
    const full = d.t1 - d.t0;
    const sp = Math.max(Math.min(MIN_SPAN, full), Math.min(span, full));
    const a = Math.max(d.t0, Math.min(d.t1 - sp, t0));
    return { t0: a, t1: a + sp };
  };

  const eff: Range | null = domain && bounds ? (view ? clampView(view.t0, view.t1 - view.t0, bounds) : domain) : null;
  const viewCb = useRef(onViewChange);
  viewCb.current = onViewChange;
  useEffect(() => {
    if (eff) viewCb.current?.({ t0: eff.t0, t1: eff.t1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff?.t0, eff?.t1]);

  // ---- geometry ----
  const fs = 11;
  const T = 10;
  const B = compact ? 20 : 24;
  const R = 8;
  const bandLike = type === 'bars' || type === 'band';

  const geo = useMemo(() => {
    if (!eff || W <= 0) return null;
    const { t0, t1 } = eff;
    const vals: number[] = [];
    const allVals: number[] = [];
    const inView = (tm: number) => tm >= t0 && tm <= t1;
    for (const p of prep) {
      if (bandLike) {
        for (const w of p.weeks) {
          const ws = type === 'band' ? [w.lo, w.hi] : [w.dv];
          allVals.push(...ws);
          if (w.t0 + 7 * DAY >= t0 && w.t0 <= t1) vals.push(...ws);
        }
      } else {
        for (const x of p.trend) { allVals.push(x.dv); if (inView(x.t)) vals.push(x.dv); }
        for (const x of p.raw) { allVals.push(x.dv); if (inView(x.t)) vals.push(x.dv); }
      }
    }
    const hasVis = vals.length > 0;
    const use = hasVis ? vals : allVals;
    const extra: number[] = [];
    if (goal !== null && goal !== undefined) extra.push(td(goal));
    const sumAgg = bandLike && series.some((s) => s.agg === 'sum');
    if (zeroLine || sumAgg) extra.push(0);
    const arr = [...use, ...extra];
    if (!arr.length) return null;
    let lo = Math.min(...arr);
    let hi = Math.max(...arr);
    const pad = (hi - lo) * 0.14 || Math.max(1, Math.abs(hi) * 0.02);
    lo = sumAgg ? 0 : lo - pad;
    hi += pad;
    const ph = height - T - B;
    const st = niceStep((hi - lo) / (compact ? 2.2 : 3.2));
    const fy = formatY ?? ((v: number) => (Math.abs(v) >= 1000 ? `${f.num(v / 1000, st < 1000 ? 1 : 0)}k` : f.num(v, st < 1 ? 1 : 0)));
    const yt: { v: number; l: string }[] = [];
    for (let k = Math.ceil(lo / st - 1e-9); k * st <= hi + 1e-9 && yt.length < 20; k++) yt.push({ v: k * st, l: fy(k * st) });
    const maxLen = yt.reduce((m, x) => Math.max(m, x.l.length), 1);
    const L = Math.max(compact ? 34 : 40, Math.ceil(maxLen * (fs * 0.62)) + 12);
    const pw = W - L - R;
    const X = (tm: number) => L + ((tm - t0) / (t1 - t0)) * pw;
    const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * ph;
    return { t0, t1, lo, hi, ph, pw, L, X, Y, yt, fy, st, hasVis, xt: xTicks(t0, t1, f.locale) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff?.t0, eff?.t1, prep, W, height, goal, zeroLine, type, formatY, compact, f.locale, series]);

  // candidates for selection
  const cands: Cand[] = useMemo(() => {
    const out: Cand[] = [];
    prep.forEach((p, si) => {
      if (bandLike) for (const w of p.weeks) out.push({ si, t: w.t, dv: w.dv, sv: w.sv, out: false, pr: false, week: { t0: w.t0, lo: w.lo, hi: w.hi } });
      else for (const x of p.raw.length ? p.raw : p.trend) out.push({ si, t: x.t, dv: x.dv, sv: x.sv, out: x.outlier, pr: x.pr, label: x.label });
    });
    return out;
  }, [prep, bandLike]);

  // latest values for gesture callbacks
  const live = useRef({ eff, domain, geo, cands, view, W });
  live.current = { eff, domain, geo, cands, view, W };
  const baseView = useRef<Range | null>(null);
  const boundsRef = useRef<Range | null>(bounds);
  boundsRef.current = bounds;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const seriesIds = prep.map((p) => p.id);
  const idsRef = useRef(seriesIds);
  idsRef.current = seriesIds;

  const applySel = (c: Cand | null) => {
    setSel(c);
    onSelectRef.current?.(c ? { seriesId: idsRef.current[c.si], t: c.t, v: c.sv } : null);
  };

  const nearest = (x: number, y: number | null, maxDist: number): Cand | null => {
    const { geo: g, cands: cs } = live.current;
    if (!g) return null;
    let best: Cand | null = null;
    let bd = Infinity;
    for (const c of cs) {
      if (c.t < g.t0 || c.t > g.t1) continue;
      const dx = g.X(c.t) - x;
      const dy = y === null ? 0 : g.Y(c.dv) - y;
      const d = Math.sqrt(dx * dx + dy * dy * 0.25);
      if (d < bd) { bd = d; best = c; }
    }
    return bd <= maxDist ? best : null;
  };

  const scrub = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: 250,
    onActivate: (e) => applySel(nearest(e.x, null, Infinity)),
    onUpdate: (e) => applySel(nearest(e.x, null, Infinity)),
  });
  const pan = usePanGesture({
    runOnJS: true,
    enabled: zoomable,
    maxPointers: 1,
    activeOffsetX: [-10, 10],
    failOffsetY: [-14, 14],
    onBegin: () => { baseView.current = live.current.eff; },
    onUpdate: (e) => {
      const { geo: g } = live.current;
      const b = baseView.current;
      const d = boundsRef.current;
      if (!d || !g || !b) return;
      const span = b.t1 - b.t0;
      setView(clampView(b.t0 - (e.translationX / g.pw) * span, span, d));
    },
  });
  const pinch = usePinchGesture({
    runOnJS: true,
    enabled: zoomable,
    onBegin: () => { baseView.current = live.current.eff; },
    onUpdate: (e) => {
      const { geo: g } = live.current;
      const b = baseView.current;
      const d = boundsRef.current;
      if (!d || !g || !b || !(e.scale > 0)) return;
      const span = b.t1 - b.t0;
      const frac = Math.max(0, Math.min(1, (e.focalX - g.L) / g.pw));
      const ft = b.t0 + frac * span;
      const ns = Math.max(MIN_SPAN, span / e.scale);
      setView(clampView(ft - frac * ns, ns, d));
    },
  });
  const single = useTapGesture({
    runOnJS: true,
    numberOfTaps: 1,
    onActivate: (e) => applySel(nearest(e.x, null, Infinity)),
  });
  const dbl = useTapGesture({
    runOnJS: true,
    enabled: zoomable,
    numberOfTaps: 2,
    onActivate: () => { setView(null); applySel(null); },
  });
  const composed = useSimultaneousGestures(pinch, useExclusiveGestures(scrub, pan), useExclusiveGestures(dbl, single));

  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  const hasData = !!domain;
  if (!hasData) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Txt v="muted">{t('common.noData')}</Txt>
      </View>
    );
  }

  const font = th.num.medium;
  const children: React.ReactNode[] = [];
  const noVis = !!geo && !compact && !geo.hasVis;

  if (geo && !noVis) {
    const { X, Y, L, pw, ph, t0, t1, lo, hi } = geo;
    const plotBottom = T + ph;
    const single1 = prep.length === 1;

    // grid + y labels
    geo.yt.forEach((tk, i) => {
      const y = Math.round(Y(tk.v)) + 0.5;
      children.push(<Line key={`g${i}`} x1={L} x2={W - R} y1={y} y2={y} stroke={th.c.line} strokeWidth={1} />);
      children.push(<SvgText key={`gl${i}`} x={L - 6} y={y + fs * 0.35} fontSize={fs} fontFamily={font} fill={th.c.muted} textAnchor="end">{tk.l}</SvgText>);
    });
    geo.xt.forEach((tk, i) => {
      const x = X(tk.t);
      if (x < L + 14 || x > W - R - 14) return;
      children.push(<SvgText key={`xl${i}`} x={x} y={height - 6} fontSize={fs} fontFamily={font} fill={th.c.muted} textAnchor="middle">{tk.l}</SvgText>);
    });

    // clipped plot content
    const plot: React.ReactNode[] = [];
    if (zeroLine && lo <= 0 && hi >= 0) {
      plot.push(<Line key="zero" x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke={th.c.muted} strokeWidth={1.2} />);
    }
    if (goal !== null && goal !== undefined) {
      const gy = Y(td(goal));
      plot.push(<Line key="goal" x1={L} x2={W - R} y1={gy} y2={gy} stroke={th.c.good} strokeWidth={1.2} strokeDasharray="5 4" />);
    }

    prep.forEach((p, si) => {
      if (bandLike) {
        const n = prep.length;
        const sw = type === 'band';
        for (const w of p.weeks) {
          if (w.t0 + 7 * DAY < t0 || w.t0 > t1) continue;
          const x0 = X(w.t0);
          const x1 = X(w.t0 + 7 * DAY);
          const gap = Math.max(1, (x1 - x0) * 0.14);
          const gw = x1 - x0 - 2 * gap;
          const bw = Math.max(1.5, gw / n - (n > 1 ? 1 : 0));
          const bx = x0 + gap + si * (gw / n);
          const partial = w.t0 + 7 * DAY > Date.now();
          const r = Math.min(4, bw / 2);
          if (sw) {
            const y0 = Y(w.hi);
            const h = Math.max(3, Y(w.lo) - y0);
            plot.push(<Rect key={`b${si}-${w.t0}`} x={bx} y={y0} width={bw} height={h} rx={r} fill={alpha(p.color, partial ? 0.12 : 0.24)} />);
            plot.push(<Rect key={`m${si}-${w.t0}`} x={bx} y={Y(w.dv) - 1} width={bw} height={2.2} fill={p.color} />);
          } else {
            const y = Y(w.dv);
            const top = Math.min(y, plotBottom - 2);
            const d = `M${bx},${plotBottom} L${bx},${top + r} Q${bx},${top} ${bx + r},${top} L${bx + bw - r},${top} Q${bx + bw},${top} ${bx + bw},${top + r} L${bx + bw},${plotBottom} Z`;
            plot.push(<Path key={`b${si}-${w.t0}`} d={d} fill={alpha(p.color, partial ? 0.3 : 0.7)} />);
          }
        }
        return;
      }
      const tr = p.trend.filter((x) => x.t >= t0 - 40 * DAY && x.t <= t1 + 40 * DAY);
      const rawVis = p.raw.filter((x) => x.t >= t0 && x.t <= t1);
      const lineSrc = tr.length > 1 ? tr : type === 'line' && !p.trend.length && p.raw.length > 1 ? p.raw.filter((x) => !x.outlier && x.t >= t0 - 40 * DAY && x.t <= t1 + 40 * DAY) : [];
      if (lineSrc.length > 1) {
        const d = lineSrc.map((x, i) => `${i ? 'L' : 'M'}${X(x.t).toFixed(1)},${Y(x.dv).toFixed(1)}`).join(' ');
        if (single1 && type === 'line') {
          const area = `${d} L${X(lineSrc[lineSrc.length - 1].t).toFixed(1)},${plotBottom} L${X(lineSrc[0].t).toFixed(1)},${plotBottom} Z`;
          plot.push(<Path key={`a${si}`} d={area} fill={`url(#grad${uid})`} />);
        }
        plot.push(<Path key={`l${si}`} d={d} fill="none" stroke={p.color} strokeWidth={type === 'dots' ? 1.4 : 2.2} strokeLinejoin="round" strokeLinecap="round" opacity={type === 'dots' ? 0.7 : 1} />);
      }
      const rr = rawVis.length > 120 ? 1.8 : compact ? 2 : type === 'dots' ? 3.2 : 2.6;
      rawVis.forEach((x, i) => {
        const cx = X(x.t);
        const cy = Y(x.dv);
        if (x.outlier) plot.push(<Circle key={`o${si}-${i}`} cx={cx} cy={cy} r={rr + 1.6} fill="none" stroke={th.c.warn} strokeWidth={1.5} />);
        else if (x.pr && !compact) plot.push(<Rect key={`p${si}-${i}`} x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={p.color} stroke={th.c.bg} strokeWidth={1.5} transform={`rotate(45 ${cx} ${cy})`} />);
        else plot.push(<Circle key={`r${si}-${i}`} cx={cx} cy={cy} r={rr} fill={type === 'dots' ? p.color : th.c.muted} opacity={type === 'dots' ? 0.9 : 0.6} />);
      });
      if (!p.raw.length && type === 'dots') {
        for (const x of p.trend) if (x.t >= t0 && x.t <= t1) plot.push(<Circle key={`td${si}-${x.t}`} cx={X(x.t)} cy={Y(x.dv)} r={3} fill={p.color} />);
      }
    });

    children.push(
      <G key="plot" clipPath={`url(#clip${uid})`}>{plot}</G>,
    );

    // selection readout (mockup: dark box with date + value)
    if (sel && sel.t >= t0 && sel.t <= t1 && prep[sel.si]) {
      const x = X(sel.t);
      const y = Y(sel.dv);
      const l1 = sel.week
        ? `${t('history.weekOf')} ${f.date(sel.week.t0)}`
        : f.date(sel.t) + (sel.out ? ` · ${t('history.legend.outlier')}` : sel.pr ? ` · ${t('exercise.record')}` : '');
      const u = unit ? ` ${unit}` : '';
      const dd = decimals ?? (geo.st < 1 ? 1 : 0);
      const l2 = sel.week
        ? type === 'band'
          ? `${f.num(sel.week.lo, dd)} – ${f.num(sel.week.hi, dd)}${u}`
          : `${series.find((s) => s.id === prep[sel.si].id)?.agg === 'sum' ? 'Σ ' : 'Ø '}${f.num(sel.dv, dd)}${u}`
        : sel.label ?? `${f.num(sel.dv, dd)}${u}`;
      const bw = Math.max(l1.length * 6.1, l2.length * 8.2) + 20;
      const bh = 42;
      const bx = Math.max(L, Math.min(W - R - bw, x - bw / 2));
      const by = y - bh - 12 < T ? y + 12 : y - bh - 12;
      children.push(<Line key="sl" x1={x} x2={x} y1={T} y2={plotBottom} stroke={th.c.muted} strokeWidth={1} strokeDasharray="3 3" />);
      children.push(<Circle key="sd" cx={x} cy={y} r={4.5} fill={th.c.text} />);
      children.push(<Rect key="sb" x={bx} y={by} width={bw} height={bh} rx={6} fill={th.c.text} />);
      children.push(<SvgText key="s1" x={bx + 10} y={by + 16} fontSize={11} fontFamily={th.font.medium} fill={th.c.bg}>{l1}</SvgText>);
      children.push(<SvgText key="s2" x={bx + 10} y={by + 33} fontSize={14} fontFamily={th.num.semibold} fill={th.c.bg}>{l2}</SvgText>);
    }
    void pw;
  }

  return (
    <GestureDetector gesture={composed}>
      <View style={{ height }} onLayout={onLayout}>
        {W > 0 ? (
          noVis ? (
            <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="muted">{t('history.noDataRange')}</Txt>
            </View>
          ) : (
            <Svg width={W} height={height}>
              <Defs>
                <ClipPath id={`clip${uid}`}>
                  <Rect x={geo ? geo.L : 0} y={0} width={geo ? geo.pw : W} height={height - B + 2} />
                </ClipPath>
                <LinearGradient id={`grad${uid}`} x1="0" y1={T} x2="0" y2={height - B} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={prep[0]?.color ?? th.c.accent} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={prep[0]?.color ?? th.c.accent} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {children}
            </Svg>
          )
        ) : null}
      </View>
    </GestureDetector>
  );
}
