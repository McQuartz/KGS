import { useMemo, useState, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { robustTrend } from '../../analysis';
import type { SessionWithPRs } from '../../analysis';
import { TrendChart, type ChartPoint, type ChartSeries } from '../../components/charts';
import { ChartLegend, RangeSelector, useRange } from '../../components/history';
import { Toggle } from '../../components/settings';
import { Card, IconButton, Screen, Segmented, StatusPill, Txt } from '../../components/ui';
import { exerciseSessions, getExercise } from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { allExerciseAnalysis } from '../../lib/insights';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';

type Metric = 'top' | 'vol' | 'e1rm';
const DAY = 86_400_000;

function Tile({ cap, value, unit, sub }: { cap: string; value: string; unit?: string; sub: string }) {
  const th = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: th.c.surface2, borderRadius: th.rSm, padding: 12, gap: 2 }}>
      <Txt v="xs">{cap}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Txt style={{ fontFamily: th.num.medium, fontSize: 22, lineHeight: 30, fontVariant: ['tabular-nums'] }}>{value}</Txt>
        {unit ? <Txt v="unit" style={{ marginLeft: 4 }}>{unit}</Txt> : null}
      </View>
      <Txt v="xs">{sub}</Txt>
    </View>
  );
}

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const show1rm = useSettings((s) => s.show1rm);
  const [metric, setMetric] = useState<Metric>('top');
  const m: Metric = metric === 'e1rm' && !show1rm ? 'top' : metric;

  const info = useQuery(() => {
    const ex = getExercise(id);
    const a = allExerciseAnalysis().find((x) => x.exercise.id === id) ?? null;
    return { ex, a, raw: exerciseSessions(id) };
  }, [id]);

  const sessions: SessionWithPRs[] = info.a?.sessions ?? [];
  const range = useRange(sessions.length ? sessions[0].ts : null, '6M');
  const prKinds: Record<Metric, string[]> = { top: ['weight'], vol: ['volume'], e1rm: ['score', 'weight'] };

  const chartSeries = useMemo<ChartSeries[]>(() => {
    const src = (m === 'e1rm' ? sessions.filter((s) => Number.isFinite(s.e1rm)) : sessions);
    const pts = src.map((s) => ({ t: s.ts, v: m === 'top' ? s.topWeight : m === 'vol' ? s.volume : s.e1rm, s }));
    const tr = robustTrend(pts.map((p) => ({ t: p.t, v: p.v })), { method: 'median', window: 5 });
    const raw: ChartPoint[] = pts.map((p, i) => {
      const pr = p.s.prs.some((x) => prKinds[m].includes(x.kind));
      return {
        t: p.t, v: p.v, pr,
        outlier: !pr && tr[i] ? p.v < tr[i].trend * 0.95 : false,
        label: m === 'top' ? `${f.lift(p.s.topWeight)} × ${p.s.topReps}` : undefined,
      };
    });
    return [{ id: 'main', color: th.c.accent, raw, trend: tr.map((p) => ({ t: p.t, v: p.trend })) }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, sessions, th, f.units]);

  if (!info.ex) {
    return <Screen bar title={t('exercise.notFound')} left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}><Txt v="muted">{t('common.noData')}</Txt></Screen>;
  }
  const ex = info.ex;
  const status = info.a?.status ?? { kind: 'unknown' as const, pct: 0 };
  const rawBySession = new Map(info.raw.map((r) => [r.workoutId, r]));
  const list = [...sessions].reverse().slice(0, 10);
  const options: { value: Metric; label: string }[] = [
    { value: 'top', label: t('exercise.m.top') },
    { value: 'vol', label: t('exercise.m.vol') },
    ...(show1rm ? [{ value: 'e1rm' as Metric, label: t('exercise.m.e1rm') }] : []),
  ];

  // records
  const heavy = sessions.reduce<SessionWithPRs | null>((a, s) => (!a || s.topWeight > a.topWeight || (s.topWeight === a.topWeight && s.topReps >= a.topReps) ? s : a), null);
  const bestVol = sessions.reduce<SessionWithPRs | null>((a, s) => (!a || s.volume > a.volume ? s : a), null);
  const best1 = sessions.reduce<SessionWithPRs | null>((a, s) => (Number.isFinite(s.e1rm) && (!a || s.e1rm > a.e1rm) ? s : a), null);
  const refW = heavy ? heavy.topWeight - 2.5 : 0;
  const mostReps = Math.max(0, ...info.raw.flatMap((r) => r.sets.filter((x) => !x.isWarmup && Math.abs(x.weight - refW) < 0.01).map((x) => x.reps)));
  const tiles: { key: string; node: ReactElement }[] = [];
  if (heavy) tiles.push({ key: 'h', node: <Tile cap={t('exercise.heaviest')} value={`${f.lift(heavy.topWeight)} × ${heavy.topReps}`} sub={f.dateWeekday(heavy.ts)} /> });
  if (bestVol) tiles.push({ key: 'v', node: <Tile cap={t('exercise.bestVolume')} value={f.num(Math.round(f.wToDisplay(bestVol.volume)), 0)} unit={f.wUnit} sub={f.dateWeekday(bestVol.ts)} /> });
  if (show1rm && best1) tiles.push({ key: 'e', node: <Tile cap={t('exercise.e1rmEpley')} value={`≈ ${f.lift(best1.e1rm)}`} unit={f.wUnit} sub={t('exercise.roughEstimate')} /> });
  if (heavy) tiles.push({ key: 'r', node: <Tile cap={t('exercise.mostRepsAt', { w: f.lift(refW), unit: f.wUnit })} value={mostReps ? String(mostReps) : '–'} sub={t('exercise.reps')} /> });
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <Screen bar title={f.exerciseName(ex)} left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <StatusPill fixed={false} kind={status.kind} label={t(`status.${status.kind}`)} pct={status.kind === 'up' || status.kind === 'down' ? `${f.signed(status.pct, 1)} %` : undefined} />
          <Txt v="xs">{t('exercise.sessionsN', { n: sessions.length })}</Txt>
        </View>
        <Txt style={{ fontSize: 13 }}>{t(`exercise.note.${status.kind}`)}</Txt>
      </Card>

      <Card>
        <Segmented<Metric> value={m} options={options} onChange={setMetric} />
        <RangeSelector range={range} />
        {sessions.length ? (
          <>
            <TrendChart
              key={`${m}-${range.key}-${range.from}-${range.to}`}
              series={chartSeries}
              type="line"
              height={250}
              from={range.from}
              to={range.to}
              boundsFrom={range.boundsFrom}
              boundsTo={range.boundsTo}
              zoomable
              toDisplay={f.wToDisplay}
              unit={f.wUnit}
              decimals={m === 'vol' ? 0 : 1}
            />
            <ChartLegend items={[
              { shape: 'dot', label: t('exercise.legend.session') },
              { shape: 'line', label: t('exercise.legend.trend') },
              { shape: 'pr', label: t('exercise.record') },
              { shape: 'ring', label: t('exercise.offDay') },
            ]} />
          </>
        ) : <Txt v="muted" style={{ paddingVertical: 30, textAlign: 'center' }}>{t('common.noData')}</Txt>}
      </Card>

      {tiles.length ? (
        <Card>
          <Txt v="label">{t('exercise.records')}</Txt>
          <View style={{ gap: 10 }}>
            {rows.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                {r.map((x) => <View key={x.key} style={{ flex: 1, flexDirection: 'row' }}>{x.node}</View>)}
                {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: th.c.line }}>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontSize: 13 }}>{t('exercise.show1rm')}</Txt>
              <Txt v="xs">{t('exercise.show1rmCap')}</Txt>
            </View>
            <Toggle value={show1rm} onChange={(v) => useSettings.getState().set({ show1rm: v })} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Txt v="label">{t('exercise.sessions')}</Txt>
        <View>
          {list.map((s, i) => {
            const raw = rawBySession.get(s.workoutId);
            const pr = s.prs.length > 0;
            const off = !pr && chartOff(chartSeries, s.ts);
            return (
              <Pressable
                key={s.workoutId + s.ts}
                onPress={() => router.push(`/workout/${s.workoutId}`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: th.c.line, opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontSize: 13, fontFamily: th.font.medium }}>{f.dateWeekday(s.ts)}</Txt>
                  <Txt v="xs" style={{ fontFamily: th.num.regular }}>
                    {raw?.sets.map((x, k) => (
                      <Text key={k} style={x.isWarmup ? { fontStyle: 'italic' } : undefined}>
                        {x.isWarmup ? 'W ' : ''}{f.lift(x.weight)}×{x.reps}{'  '}
                      </Text>
                    ))}
                  </Txt>
                </View>
                {pr ? <StatusPill fixed={false} kind="pr" label="PR" /> : off ? (
                  <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: th.c.surface2 }}>
                    <Text style={{ fontFamily: th.font.semibold, fontSize: 12, color: th.c.muted }}>{t('exercise.offDay')}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

/** true if the top-set series flags this session as an off day (clearly below trend). */
function chartOff(series: ChartSeries[], ts: number): boolean {
  const p = series[0]?.raw?.find((x) => Math.abs(x.t - ts) < DAY / 2);
  return !!p?.outlier;
}

