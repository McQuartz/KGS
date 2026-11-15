import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RangeSelector, useRange } from '../../components/history';
import { ChartLegend } from '../../components/history/ChartLegend';
import { TrendChart, type ChartPoint, type ChartSeries, type ChartType } from '../../components/charts';
import { Card, Chip, Icon, Screen, Segmented, StatusPill, Txt } from '../../components/ui';
import type { Metric } from '../../domain/types';
import { listMetrics } from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { allExerciseAnalysis, metricTrend, strengthSummary, volumeSummary } from '../../lib/insights';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { alpha, useTheme } from '../../theme';

const DAY = 86_400_000;

interface Pt { t: number; raw: number; trend: number; outlier: boolean }
interface SeriesInfo { id: string; label: string }
type Kind = 'weight' | 'strength' | 'volume' | 'metric';
type ChartMode = 'trend' | 'weekly' | 'spread';

/** mockup .statgrid cell: caption, big number, unit */
function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  const th = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Txt v="xs">{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Txt color={color} style={{ fontFamily: th.num.medium, fontSize: 17, lineHeight: 24, fontVariant: ['tabular-nums'] }}>{value}</Txt>
        {unit ? <Txt v="unit" style={{ marginLeft: 4 }}>{unit}</Txt> : null}
      </View>
    </View>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 12 }}>{children}</View>;
}

export default function History() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const historySeries = useSettings((s) => s.historySeries);
  const savedChart = useSettings((s) => s.historyChart);
  const trendMethod = useSettings((s) => s.trendMethod);
  const [mode, setMode] = useState<ChartMode>(savedChart === 'bars' ? 'weekly' : 'trend');

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
  const kind: Kind = selId === 'strength' ? 'strength' : selId === 'volume' ? 'volume' : selId === 'weight' ? 'weight' : 'metric';

  const data = useQuery(() => {
    if (kind === 'strength') {
      const s = strengthSummary();
      return { pts: s.index.combined.map((p): Pt => ({ t: p.t, raw: p.v, trend: p.v, outlier: false })) };
    }
    if (kind === 'volume') {
      const v = volumeSummary();
      return { pts: v.daily.map((p): Pt => ({ t: p.t, raw: p.v, trend: p.v, outlier: false })) };
    }
    return { pts: metricTrend(selId).map((p): Pt => ({ t: p.t, raw: p.raw, trend: p.trend, outlier: p.outlier })) };
  }, [selId, kind, trendMethod]);

  const pts = data.pts;
  const range = useRange(pts.length ? pts[0].t : null, '3M');
  const [view, setView] = useState<{ key: string; t0: number; t1: number } | null>(null);
  const chartKey = `${selId}-${mode}-${range.key}-${range.from}-${range.to}`;

  // display conversion per series
  const conv = (v: number) => (kind === 'volume' ? f.wToDisplay(v) : kind === 'strength' ? v : metric ? f.metricToDisplay(metric, v) : f.wToDisplay(v));
  const dec = kind === 'volume' ? 0 : kind === 'strength' ? 1 : metric ? metric.decimals : 1;
  const unit = kind === 'volume' ? f.wUnit : kind === 'strength' ? '%' : metric ? f.metricUnit(metric) : f.wUnit;
  const derived = kind === 'strength' || kind === 'volume';
  const lowerBetter = kind === 'weight' || (kind === 'metric' && !!metric?.lowerIsBetter);

  const chartSeries: ChartSeries[] = useMemo(() => {
    const raw: ChartPoint[] = pts.map((p) => ({ t: p.t, v: p.raw, outlier: p.outlier }));
    const trend: ChartPoint[] = pts.map((p) => ({ t: p.t, v: p.trend }));
    return [{ id: selId, color: th.c.accent, raw, trend, agg: kind === 'volume' ? 'sum' : 'mean' }];
  }, [pts, selId, kind, th]);

  const chartType: ChartType = mode === 'weekly' ? 'bars' : mode === 'spread' ? 'band' : 'line';

  const v = view && view.key === chartKey ? view : { t0: range.from, t1: range.to };
  const inView = pts.filter((p) => p.t >= v.t0 && p.t <= v.t1);

  if (!seriesList.length) {
    return <Screen title={t('tab.history')}><Card><Txt v="muted">{t('common.noData')}</Txt></Card></Screen>;
  }

  return (
    <Screen title={t('tab.history')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {seriesList.map((s) => <Chip key={s.id} label={s.label} on={s.id === selId} onPress={() => { setPicked(s.id); setView(null); }} />)}
      </ScrollView>

      <Card>
        <Segmented<ChartMode>
          value={mode}
          onChange={setMode}
          options={[{ value: 'trend', label: t('history.chart.trend') }, { value: 'weekly', label: t('history.chart.weekly') }, { value: 'spread', label: t('history.chart.spread') }]}
        />
        <RangeSelector range={range} />
        {pts.length ? (
          <>
            <TrendChart
              key={chartKey}
              series={chartSeries}
              type={chartType}
              height={250}
              from={range.from}
              to={range.to}
              boundsFrom={range.boundsFrom}
              boundsTo={range.boundsTo}
              zoomable
              toDisplay={conv}
              unit={unit}
              decimals={dec}
              zeroLine={false}
              onViewChange={(nv) => setView({ key: chartKey, ...nv })}
            />
            <ChartLegend items={
              mode === 'weekly' ? [{ shape: 'bar', label: kind === 'volume' ? t('history.legend.weekSum') : t('history.legend.weekAvg') }]
                : mode === 'spread' ? [{ shape: 'band', label: t('history.legend.spread') }, { shape: 'line', label: 'Ø' }]
                : [
                  { shape: 'dot', label: derived ? t('history.legend.trainingDay') : t('history.legend.entry') },
                  { shape: 'line', label: t('history.legend.trend') },
                  ...(derived ? [] : [{ shape: 'ring' as const, label: t('history.legend.outlier') }]),
                ]
            } />
            <Txt v="xs">{t('history.gestures')}</Txt>
          </>
        ) : <Txt v="muted" style={{ paddingVertical: 30, textAlign: 'center' }}>{t('history.noEntries')}</Txt>}
      </Card>

      {pts.length ? (
        <Card>
          {inView.length ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Txt v="label">{f.date(v.t0)} – {f.date(v.t1)}</Txt>
                <Txt v="xs">{derived && kind === 'volume' ? t('history.nTrainingDays', { n: inView.length }) : t('history.nEntries', { n: inView.length })}</Txt>
              </View>
              {kind === 'volume' ? <VolumeStats pts={inView} t0={v.t0} t1={v.t1} /> : <ValueStats pts={inView} conv={conv} dec={dec} unit={unit} lowerBetter={lowerBetter} />}
            </>
          ) : <Txt v="muted" style={{ paddingVertical: 30, textAlign: 'center' }}>{t('history.noEntries')}</Txt>}
        </Card>
      ) : null}

      <Card>
        <Txt v="label">{t('history.exercises')}</Txt>
        <View>
          {exercises.length ? exercises.map((a, i) => (
            <Pressable
              key={a.exercise.id}
              onPress={() => router.push(`/exercise/${a.exercise.id}`)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: th.c.line, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ flex: 1 }}><Txt numberOfLines={1} style={{ fontFamily: th.font.medium }}>{f.exerciseName(a.exercise)}</Txt></View>
              <StatusPill kind={a.status.kind} label={t(`status.${a.status.kind}`)} pct={a.status.kind === 'up' || a.status.kind === 'down' ? `${f.signed(a.status.pct, 1)} %` : undefined} />
              <Icon name="chev" size={16} color={th.c.muted} />
            </Pressable>
          )) : <Txt v="muted">{t('history.noExercises')}</Txt>}
        </View>
      </Card>
    </Screen>
  );
}

function ValueStats({ pts, conv, dec, unit, lowerBetter }: { pts: Pt[]; conv: (v: number) => number; dec: number; unit: string; lowerBetter: boolean }) {
  const t = useT();
  const f = useFormat();
  const th = useTheme();
  const first = pts[0];
  const last = pts[pts.length - 1];
  const ch = conv(last.trend) - conv(first.trend);
  const wk = Math.max(1, (last.t - first.t) / DAY / 7);
  const good = Math.abs(ch) > 1e-9 && (lowerBetter ? ch < 0 : ch > 0);
  return (
    <>
      <StatGrid>
        <Stat label={t('history.trend')} value={f.num(conv(last.trend), dec)} unit={unit} />
        <Stat label={t('history.change')} value={f.signed(ch, 1)} unit={unit} color={good ? th.c.good : undefined} />
        <Stat label={t('history.perWeek')} value={f.signed(ch / wk, 2)} />
      </StatGrid>
      <View>
        {pts.slice(-6).reverse().map((p, i) => (
          <View key={p.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: th.c.line }}>
            <View style={{ flex: 1 }}><Txt style={{ fontSize: 13 }}>{f.dateWeekday(p.t)}</Txt></View>
            {p.outlier ? (
              <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: alpha(th.c.warn, 0.16) }}>
                <Text style={{ fontFamily: th.font.semibold, fontSize: 12, color: th.c.warn }}>{t('history.outlier')}</Text>
              </View>
            ) : null}
            <Txt style={{ fontFamily: th.num.medium, fontSize: 13, fontVariant: ['tabular-nums'] }}>{f.num(conv(p.raw), dec)} {unit}</Txt>
          </View>
        ))}
      </View>
    </>
  );
}

function VolumeStats({ pts, t0, t1 }: { pts: Pt[]; t0: number; t1: number }) {
  const t = useT();
  const f = useFormat();
  const tot = pts.reduce((a, p) => a + p.raw, 0);
  const wks = Math.max(1, (t1 - t0) / DAY / 7);
  const r = (kg: number) => f.num(Math.round(f.wToDisplay(kg)), 0);
  return (
    <>
      <StatGrid>
        <Stat label={t('history.total')} value={f.num(Math.round(f.wToDisplay(tot) / 1000), 0)} unit={f.wUnit === 'kg' ? 't' : 't (lb×1000)'} />
        <Stat label={t('history.perWeek')} value={r(tot / wks)} unit={f.wUnit} />
        <Stat label={t('history.perSession')} value={r(tot / Math.max(1, pts.length))} unit={f.wUnit} />
      </StatGrid>
      <Txt v="xs">{t('history.volumeNote')}</Txt>
    </>
  );
}
