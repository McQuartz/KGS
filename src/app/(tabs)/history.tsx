import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { goalForecast, trendRate } from '../../analysis';
import { RangeSelector, useRange } from '../../components/history';
import { TrendChart, type ChartPoint, type ChartSeries } from '../../components/charts';
import { Card, Chip, Divider, ListRow, Screen, SectionLabel, StatusPill, Txt } from '../../components/ui';
import type { Metric } from '../../domain/types';
import { listMetrics } from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import {
  allExerciseAnalysis, consistencySummary, metricTrend, strengthSummary, volumeSummary,
} from '../../lib/insights';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

interface Pt { t: number; raw: number; trend: number; outlier: boolean }
interface SeriesInfo { id: string; label: string }

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={{ width: '31%', gap: 2 }}>
      <Txt v="small">{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Txt v="numLg" color={color} style={{ fontSize: 20 }}>{value}</Txt>
        {unit ? <Txt v="small">{unit}</Txt> : null}
      </View>
    </View>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, justifyContent: 'space-between' }}>{children}</View>;
}

export default function History() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const historySeries = useSettings((s) => s.historySeries);
  const chartType = useSettings((s) => s.historyChart);
  const goalWeight = useSettings((s) => s.goalWeight);
  const trendMethod = useSettings((s) => s.trendMethod);

  const metrics = useQuery(() => listMetrics(), []);
  const exercises = useQuery(() => allExerciseAnalysis(), []);

  const seriesList = useMemo<SeriesInfo[]>(() => {
    const label = (id: string) =>
      id === 'strength' ? t('series.strength') : id === 'volume' ? t('series.volume')
        : (() => { const m = metrics.find((x) => x.id === id); return m ? f.metricName(m) : id; })();
    const valid = (id: string) => id === 'weight' || id === 'strength' || id === 'volume' || metrics.some((m) => m.id === id);
    const out = historySeries.filter((s) => s.visible && valid(s.id)).map((s) => s.id);
    for (const m of metrics) if (!historySeries.some((s) => s.id === m.id) && !out.includes(m.id)) out.push(m.id);
    return out.map((id) => ({ id, label: label(id) }));
  }, [historySeries, metrics, t, f]);

  const [picked, setPicked] = useState<string | null>(null);
  const selId = seriesList.find((s) => s.id === picked)?.id ?? seriesList[0]?.id ?? 'weight';
  const metric: Metric | undefined = metrics.find((m) => m.id === selId);
  const kind: 'weight' | 'strength' | 'volume' | 'metric' = selId === 'strength' ? 'strength' : selId === 'volume' ? 'volume' : selId === 'weight' ? 'weight' : 'metric';

  const data = useQuery(() => {
    if (kind === 'strength') {
      const s = strengthSummary();
      const pts: Pt[] = s.index.combined.map((p) => ({ t: p.t, raw: p.v, trend: p.v, outlier: false }));
      return { pts, strength: s, volume: null };
    }
    if (kind === 'volume') {
      const v = volumeSummary();
      const pts: Pt[] = v.daily.map((p) => ({ t: p.t, raw: p.v, trend: p.v, outlier: false }));
      return { pts, strength: null, volume: v };
    }
    const pts: Pt[] = metricTrend(selId).map((p) => ({ t: p.t, raw: p.raw, trend: p.trend, outlier: p.outlier }));
    return { pts, strength: null, volume: null };
  }, [selId, kind, trendMethod]);

  const pts = data.pts;
  const range = useRange(pts.length ? pts[0].t : null, '3M');
  const [sel, setSel] = useState<{ t: number; v: number } | null>(null);

  // display conversion per series
  const conv = (v: number) => (kind === 'volume' ? f.wToDisplay(v) : kind === 'strength' ? v : metric ? f.metricToDisplay(metric, v) : f.wToDisplay(v));
  const dec = kind === 'volume' ? 0 : kind === 'strength' ? 1 : metric ? metric.decimals : 1;
  const unit = kind === 'volume' ? f.wUnit : kind === 'strength' ? '%' : metric ? f.metricUnit(metric) : f.wUnit;
  const fmt = (v: number, d = dec) => f.num(conv(v), d);

  const chartSeries: ChartSeries[] = useMemo(() => {
    const raw: ChartPoint[] = pts.map((p) => ({ t: p.t, v: p.raw, outlier: p.outlier }));
    const trend: ChartPoint[] = pts.map((p) => ({ t: p.t, v: p.trend }));
    return [{ id: selId, color: th.c.accent, raw, trend, agg: kind === 'volume' ? 'sum' : 'mean' }];
  }, [pts, selId, kind, th]);

  const inRange = pts.filter((p) => p.t >= range.from && p.t <= range.to);
  const shown = (() => {
    if (sel) {
      const near = pts.reduce<Pt | null>((b, p) => (!b || Math.abs(p.t - sel.t) < Math.abs(b.t - sel.t) ? p : b), null);
      if (near && Math.abs(near.t - sel.t) < DAY / 2) return { t: near.t, raw: near.raw, trend: near.trend, outlier: near.outlier };
      return { t: sel.t, raw: sel.v, trend: null as number | null, outlier: false };
    }
    const last = inRange[inRange.length - 1];
    return last ? { t: last.t, raw: last.raw, trend: last.trend as number | null, outlier: last.outlier } : null;
  })();

  const formatY = kind === 'volume'
    ? (v: number) => (v >= 10000 ? `${f.num(v / 1000, 0)}k` : f.num(v, 0))
    : kind === 'strength' ? (v: number) => `${v > 0 ? '+' : ''}${f.num(v, 0)} %` : (v: number) => f.num(v, dec);

  const onPickSeries = (id: string) => { setPicked(id); setSel(null); };

  if (!seriesList.length) {
    return <Screen title={t('tab.history')}><Card><Txt v="muted">{t('common.noData')}</Txt></Card></Screen>;
  }

  return (
    <Screen title={t('tab.history')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        {seriesList.map((s) => <Chip key={s.id} label={s.label} on={s.id === selId} onPress={() => onPickSeries(s.id)} />)}
      </ScrollView>

      <Card style={{ gap: 12 }}>
        <RangeSelector range={range} />
        {pts.length ? (
          <>
            <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {shown ? (
                <>
                  <View>
                    <Txt v="small">{f.dateLong(shown.t)}</Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Txt v="numLg">{fmt(shown.trend ?? shown.raw)}</Txt>
                      <Txt v="small">{unit}</Txt>
                    </View>
                  </View>
                  {shown.trend != null && kind !== 'strength' && kind !== 'volume' ? (
                    <Txt v="small">{t('history.rawTrend', { raw: fmt(shown.raw), trend: fmt(shown.trend) })}{shown.outlier ? ` · ${t('history.outlier')}` : ''}</Txt>
                  ) : shown.trend != null ? <Txt v="small">{t('history.valueOf', { v: fmt(shown.raw) })}</Txt> : null}
                </>
              ) : null}
            </View>
            <TrendChart
              key={`${selId}-${range.key}-${range.from}-${range.to}`}
              series={chartSeries}
              type={kind === 'volume' && chartType === 'line' ? 'line' : chartType}
              height={260}
              from={range.from}
              to={range.to}
              zoomable
              formatY={formatY}
              toDisplay={conv}
              goal={kind === 'weight' ? goalWeight : null}
              zeroLine={kind === 'strength'}
              onSelect={(s) => setSel(s ? { t: s.t, v: s.v } : null)}
            />
            <Legend type={chartType} kind={kind} />
            <Txt v="small">{t('history.gestures')}</Txt>
          </>
        ) : <Txt v="muted">{t('common.noData')}</Txt>}
      </Card>

      {pts.length ? (
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="label">{f.date(range.from)} – {f.date(Math.min(range.to, Date.now()))}</Txt>
            <Txt v="small">{inRange.length} {kind === 'volume' || kind === 'strength' ? t('history.trainingDays') : t('history.entries')}</Txt>
          </View>
          {inRange.length ? (
            kind === 'volume' ? <VolumeStats pts={inRange} from={range.from} to={range.to} volume={data.volume} /> : (
              <ValueStats kind={kind} pts={inRange} allPts={pts} metric={metric} conv={conv} dec={dec} unit={unit} />
            )
          ) : <Txt v="muted">{t('history.noEntriesInRange')}</Txt>}
          {kind === 'strength' && data.strength ? <StrengthStats data={data.strength} from={range.from} to={range.to} /> : null}
        </Card>
      ) : null}

      <SectionLabel>{t('history.exercises')}</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        {exercises.length ? exercises.map((a, i) => {
          const last = a.sessions[a.sessions.length - 1];
          return (
            <View key={a.exercise.id}>
              {i ? <Divider /> : null}
              <ListRow
                title={f.exerciseName(a.exercise)}
                subtitle={last ? `${f.date(last.ts)} · ${f.lift(last.topWeight)} × ${last.topReps} ${f.wUnit}` : undefined}
                right={<StatusPill kind={a.status.kind} label={t(`status.${a.status.kind}`)} />}
                onPress={() => router.push(`/exercise/${a.exercise.id}`)}
              />
            </View>
          );
        }) : <View style={{ padding: 12 }}><Txt v="muted">{t('history.noExercises')}</Txt></View>}
      </Card>
    </Screen>
  );
}

function Legend({ type, kind }: { type: 'line' | 'dots' | 'bars'; kind: string }) {
  const th = useTheme();
  const t = useT();
  const item = (shape: 'dot' | 'line' | 'ring' | 'bar', label: string) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {shape === 'dot' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th.c.accent, opacity: 0.55 }} />
        : shape === 'line' ? <View style={{ width: 16, height: 2.5, borderRadius: 2, backgroundColor: th.c.accent }} />
        : shape === 'bar' ? <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: th.c.accent, opacity: 0.7 }} />
        : <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: th.c.muted }} />}
      <Txt v="small">{label}</Txt>
    </View>
  );
  const derived = kind === 'strength' || kind === 'volume';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {type === 'bars'
        ? [item('bar', kind === 'volume' ? t('history.legend.weekSum') : t('history.legend.weekAvg'))]
        : [
          item('dot', derived ? t('history.legend.trainingDay') : t('history.legend.entry')),
          item('line', t('history.legend.trend')),
          ...(derived ? [] : [item('ring', t('history.legend.outlier'))]),
        ]}
    </View>
  );
}

function ValueStats({ kind, pts, allPts, metric, conv, dec, unit }: {
  kind: 'weight' | 'strength' | 'metric'; pts: Pt[]; allPts: Pt[]; metric: Metric | undefined;
  conv: (v: number) => number; dec: number; unit: string;
}) {
  const t = useT();
  const f = useFormat();
  const th = useTheme();
  const goalWeight = useSettings((s) => s.goalWeight);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const change = conv(last.trend) - conv(first.trend);
  const spanDays = (last.t - first.t) / DAY;
  const rate = trendRate(pts.map((p) => ({ t: p.t, v: p.trend })), last.t, Math.max(7, spanDays + 1));
  const perWeek = rate ? conv(rate.perWeek) - conv(0) : null;
  const good = (() => {
    if (Math.abs(change) < 1e-9) return undefined;
    if (kind === 'strength') return change > 0 ? th.c.good : undefined;
    if (kind === 'weight') {
      if (goalWeight == null) return undefined;
      return (goalWeight < last.trend ? change < 0 : change > 0) ? th.c.good : undefined;
    }
    return (metric?.lowerIsBetter ? change < 0 : change > 0) ? th.c.good : undefined;
  })();
  const clean = pts.filter((p) => !p.outlier);
  const vals = (clean.length ? clean : pts).map((p) => conv(p.raw));
  const outliers = pts.filter((p) => p.outlier).length;
  const fc = (() => {
    if (kind !== 'weight' || goalWeight == null) return null;
    const lastAll = allPts[allPts.length - 1];
    const now = Date.now();
    return goalForecast(lastAll.trend, goalWeight, trendRate(allPts.map((p) => ({ t: p.t, v: p.trend })), now), now);
  })();
  const goalTxt = fc
    ? fc.status === 'reached' ? t('history.goal.reached', { goal: `${f.bw(goalWeight as number)} ${f.wUnit}` })
      : fc.status === 'on_track' && fc.eta != null ? t('history.goal.onTrack', { goal: `${f.bw(goalWeight as number)} ${f.wUnit}`, eta: f.dateLong(fc.eta), weeks: Math.max(1, Math.round(fc.weeks ?? 0)) })
      : fc.status === 'wrong_direction' ? t('history.goal.wrong', { goal: `${f.bw(goalWeight as number)} ${f.wUnit}` })
      : fc.status === 'too_slow' ? t('history.goal.slow') : t('history.goal.unknown')
    : null;
  return (
    <>
      <StatGrid>
        <Stat label={t('history.start')} value={f.num(conv(first.trend), dec)} unit={unit} />
        <Stat label={t('history.end')} value={f.num(conv(last.trend), dec)} unit={unit} />
        <Stat label={t('history.change')} value={f.signed(change, kind === 'strength' ? 1 : dec)} unit={unit} color={good} />
        <Stat label={t('history.perWeek')} value={perWeek != null ? f.signed(perWeek, Math.max(dec, 2)) : '–'} unit={perWeek != null ? unit : undefined} />
        <Stat label={t('history.min')} value={f.num(Math.min(...vals), dec)} unit={unit} />
        <Stat label={t('history.max')} value={f.num(Math.max(...vals), dec)} unit={unit} />
      </StatGrid>
      {kind !== 'strength' ? <Txt v="small">{t('history.outliersIgnored', { n: outliers })}</Txt> : null}
      {goalTxt ? <><Divider /><Txt v="label">{t('history.goalForecast')}</Txt><Txt>{goalTxt}</Txt></> : null}
    </>
  );
}

function VolumeStats({ pts, from, to, volume }: { pts: Pt[]; from: number; to: number; volume: ReturnType<typeof volumeSummary> | null }) {
  const t = useT();
  const f = useFormat();
  const cons = useQuery(() => consistencySummary(), []);
  const end = Math.min(to, Date.now());
  const weeks = Math.max(1, (end - from) / WEEK);
  const total = pts.reduce((a, p) => a + p.raw, 0);
  const days = Math.max(1, pts.length);
  const kfmt = (kg: number) => `${f.num(f.wToDisplay(kg) / 1000, 1)}k`;
  const byGroup = new Map<string, number>();
  for (const w of volume?.byMuscle ?? []) if (w.t0 + WEEK > from && w.t0 <= end) byGroup.set(w.group, (byGroup.get(w.group) ?? 0) + w.sets);
  const groups = [...byGroup.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <>
      <StatGrid>
        <Stat label={t('history.total')} value={kfmt(total)} unit={f.wUnit} />
        <Stat label={t('history.perWeek')} value={kfmt(total / weeks)} unit={f.wUnit} />
        <Stat label={t('history.perSession')} value={kfmt(total / days)} unit={f.wUnit} />
      </StatGrid>
      <Txt v="small">{t('history.volumeNote')}</Txt>
      <Divider />
      <Txt v="label">{t('history.setsPerWeek')}</Txt>
      {groups.length ? groups.map(([g, n]) => (
        <View key={g} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt>{t(`muscle.${g}`)}</Txt>
          <Txt v="num">{f.num(n / weeks, 1)}</Txt>
        </View>
      )) : <Txt v="muted">{t('common.noData')}</Txt>}
      <Divider />
      <Txt v="label">{t('history.consistency')}</Txt>
      <StatGrid>
        <Stat label={t('history.avgPerWeek')} value={f.num(cons.avgPerWeek, 1)} />
        <Stat label={t('history.hitRate')} value={f.num(cons.hitRate * 100, 0)} unit="%" />
        <Stat label={t('history.streak')} value={String(cons.streakWeeks)} unit={t('history.weeksUnit')} />
      </StatGrid>
      <Txt v="small">{t('history.consistencyNote')}</Txt>
    </>
  );
}

function StrengthStats({ data, from, to }: { data: ReturnType<typeof strengthSummary>; from: number; to: number }) {
  const t = useT();
  const f = useFormat();
  const th = useTheme();
  const rows = data.exercises
    .map((a) => {
      const arr = (data.index.perExercise[a.exercise.id] ?? []).filter((p) => p.t >= from && p.t <= to);
      return { a, change: arr.length >= 2 ? arr[arr.length - 1].v - arr[0].v : null };
    })
    .filter((r) => data.index.perExercise[r.a.exercise.id]);
  return (
    <>
      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="label">{t('history.overall')}</Txt>
        <StatusPill kind={data.status.kind} label={data.status.kind === 'unknown' ? t('status.unknown') : `${t(`status.${data.status.kind}`)} ${f.signed(data.status.pct, 0)} %`} />
      </View>
      <Txt v="small">{t('history.strengthNote')}</Txt>
      {rows.map(({ a, change }) => (
        <View key={a.exercise.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><Txt numberOfLines={1}>{f.exerciseName(a.exercise)}</Txt></View>
          <Txt v="num" color={change != null && change > 0 ? th.c.good : change != null && change < 0 ? th.c.bad : th.c.muted}>
            {change != null ? `${f.signed(change, 1)} %` : '–'}
          </Txt>
        </View>
      ))}
    </>
  );
}
