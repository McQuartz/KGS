import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  REP_BUCKETS, detectPlateaus, robustTrend, strengthIndex, type SessionWithPRs,
} from '../../analysis';
import { TrendChart, type ChartSeries } from '../../components/charts';
import { MiniHistory, RangeSelector, useRange } from '../../components/history';
import { Button, Card, Divider, Icon, IconButton, Screen, SectionLabel, Segmented, StatusPill, Txt } from '../../components/ui';
import { exerciseSessions, getExercise } from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { allExerciseAnalysis, relativeStrengthFor } from '../../lib/insights';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { alpha, useTheme } from '../../theme';

type Metric = 'top' | 'vol' | 'strength' | 'rel' | 'e1rm';
const DAY = 86_400_000;
const PAGE = 15;

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const show1rm = useSettings((s) => s.show1rm);
  const [metric, setMetric] = useState<Metric>('top');
  const [shown, setShown] = useState(PAGE);
  const m: Metric = metric === 'e1rm' && !show1rm ? 'top' : metric;

  const info = useQuery(() => {
    const ex = getExercise(id);
    const a = allExerciseAnalysis().find((x) => x.exercise.id === id) ?? null;
    const sessions = a?.sessions ?? [];
    return {
      ex,
      a,
      raw: exerciseSessions(id),
      rel: relativeStrengthFor(id),
      score: strengthIndex({ [id]: sessions }, { minSessions: 1 }).perExercise[id] ?? [],
      plateau: a ? detectPlateaus({ [id]: sessions }, Date.now())[0] ?? null : null,
    };
  }, [id]);

  const sessions: SessionWithPRs[] = info.a?.sessions ?? [];
  const range = useRange(sessions.length ? sessions[0].ts : null, '6M');

  const prKinds: Record<Metric, string[]> = { top: ['weight'], vol: ['volume'], strength: ['score'], rel: ['score', 'weight'], e1rm: ['score', 'weight'] };
  const cfg = {
    top: { conv: f.wToDisplay, dec: 1, unit: f.wUnit },
    vol: { conv: f.wToDisplay, dec: 0, unit: f.wUnit },
    strength: { conv: (v: number) => v, dec: 1, unit: '%' },
    rel: { conv: (v: number) => v, dec: 2, unit: '× ' + t('exercise.bw') },
    e1rm: { conv: f.wToDisplay, dec: 1, unit: f.wUnit },
  }[m];

  const points = useMemo(() => {
    switch (m) {
      case 'top': return sessions.map((s) => ({ t: s.ts, v: s.topWeight }));
      case 'vol': return sessions.map((s) => ({ t: s.ts, v: s.volume }));
      case 'strength': return info.score;
      case 'rel': return info.rel;
      case 'e1rm': return sessions.filter((s) => Number.isFinite(s.e1rm)).map((s) => ({ t: s.ts, v: s.e1rm }));
    }
  }, [m, sessions, info.score, info.rel]);

  const chartSeries = useMemo<ChartSeries[]>(() => {
    const tr = robustTrend(points, { method: 'ema', alpha: 0.5 });
    const prTs = new Set(sessions.filter((s) => s.prs.some((p) => prKinds[m].includes(p.kind))).map((s) => s.ts));
    const out: ChartSeries[] = [{
      id: 'main', color: th.c.text,
      raw: tr.map((p) => ({ t: p.t, v: p.raw })),
      trend: tr.map((p) => ({ t: p.t, v: p.trend })),
    }];
    const prPts = points.filter((p) => prTs.has(p.t));
    if (prPts.length) out.push({ id: 'pr', label: t('exercise.record'), color: th.c.accent, raw: prPts.map((p) => ({ t: p.t, v: p.v })) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, sessions, m, th, t]);

  const [sel, setSel] = useState<{ t: number; v: number } | null>(null);

  if (!info.ex) {
    return <Screen title={t('exercise.notFound')} left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}><Txt v="muted">{t('common.noData')}</Txt></Screen>;
  }
  const ex = info.ex;
  const status = info.a?.status ?? { kind: 'unknown' as const, pct: 0 };
  const lastRaw = points[points.length - 1];
  const readout = (() => {
    const p = sel ? points.find((x) => Math.abs(x.t - sel.t) < DAY / 2) ?? { t: sel.t, v: sel.v } : lastRaw;
    return p ?? null;
  })();
  const fmt = (v: number) => f.num(cfg.conv(v), cfg.dec);
  const options: { value: Metric; label: string }[] = [
    { value: 'top', label: t('exercise.m.top') },
    { value: 'vol', label: t('exercise.m.vol') },
    { value: 'strength', label: t('exercise.m.strength') },
    { value: 'rel', label: t('exercise.m.rel') },
    ...(show1rm ? [{ value: 'e1rm' as Metric, label: t('exercise.m.e1rm') }] : []),
  ];
  const rawBySession = new Map(info.raw.map((r) => [r.workoutId, r]));
  const list = [...sessions].reverse();
  const prLabel: Record<string, string> = { weight: t('exercise.pr.weight'), score: t('exercise.pr.score'), volume: t('exercise.pr.volume'), bucket: t('exercise.pr.bucket') };

  return (
    <Screen title={f.exerciseName(ex)} left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}>
      <Card style={{ gap: 10 }}>
        <Txt v="muted">{t(`muscle.${ex.muscleGroup}`)}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusPill kind={status.kind} label={status.kind === 'unknown' ? t('status.unknown') : `${t(`status.${status.kind}`)} ${f.signed(status.pct, 0)} %`} />
          <Txt v="small">{t('exercise.sessionsN', { n: sessions.length })}</Txt>
        </View>
        <Txt v="small">{t('exercise.statusNote')}</Txt>
        {info.plateau ? (
          <View style={{ backgroundColor: alpha(th.c.warn, 0.14), borderRadius: th.rSm, padding: 10 }}>
            <Txt>{t('exercise.plateau', { weeks: Math.max(1, Math.round(info.plateau.daysSincePR / 7)), n: info.plateau.sessionsSincePR })}</Txt>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 12 }}>
        <Segmented small value={m} options={options} onChange={(v) => { setMetric(v); setSel(null); }} />
        <RangeSelector range={range} />
        {points.length ? (
          <>
            <View style={{ minHeight: 44 }}>
              {readout ? (
                <>
                  <Txt v="small">{f.dateLong(readout.t)}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Txt v="numLg">{fmt(readout.v)}</Txt>
                    <Txt v="small">{cfg.unit}</Txt>
                  </View>
                </>
              ) : null}
            </View>
            <TrendChart
              key={`${m}-${range.key}-${range.from}-${range.to}`}
              series={chartSeries}
              type="line"
              height={240}
              from={range.from}
              to={range.to}
              zoomable
              toDisplay={cfg.conv}
              formatY={(v) => f.num(v, m === 'vol' ? 0 : m === 'rel' ? 2 : m === 'strength' ? 0 : 1)}
              zeroLine={m === 'strength'}
              onSelect={(s) => setSel(s ? { t: s.t, v: s.v } : null)}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              <LegendItem color={th.c.muted} shape="dot" label={t('exercise.legend.session')} />
              <LegendItem color={th.c.text} shape="line" label={t('exercise.legend.trend')} />
              <LegendItem color={th.c.accent} shape="dot" label={t('exercise.record')} />
            </View>
            {m === 'e1rm' ? <Txt v="small">{t('exercise.e1rmNote')}</Txt> : null}
            {m === 'rel' ? <Txt v="small">{t('exercise.relNote')}</Txt> : null}
          </>
        ) : <Txt v="muted">{m === 'rel' ? t('exercise.relNeedsWeight') : t('common.noData')}</Txt>}
      </Card>

      <SectionLabel>{t('exercise.byReps')}</SectionLabel>
      <Card style={{ gap: 12 }}>
        {REP_BUCKETS.map((b, i) => {
          const best = info.a?.buckets[b];
          const hist = sessions.flatMap((s) => (s.bucketTop[b] ? [{ t: s.ts, v: f.wToDisplay(s.bucketTop[b]!.weight) }] : []));
          return (
            <View key={b}>
              {i ? <View style={{ marginBottom: 12 }}><Divider /></View> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="label">{t(`bucket.${b}`)}</Txt>
                  {best ? (
                    <>
                      <Txt v="numLg" style={{ fontSize: 20 }}>{f.lift(best.weight)} {f.wUnit} × {best.reps}</Txt>
                      <Txt v="small">{f.dateLong(best.ts)}</Txt>
                    </>
                  ) : <Txt v="muted">–</Txt>}
                </View>
                <MiniHistory points={hist} decimals={1} />
              </View>
            </View>
          );
        })}
      </Card>

      <SectionLabel>{t('exercise.sessions')}</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        {list.slice(0, shown).map((s, i) => {
          const raw = rawBySession.get(s.workoutId);
          const kinds = [...new Set(s.prs.map((p) => p.kind))];
          return (
            <View key={s.workoutId + s.ts}>
              {i ? <Divider /> : null}
              <Pressable onPress={() => router.push(`/workout/${s.workoutId}`)} style={({ pressed }) => ({ paddingVertical: 12, gap: 4, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}><Txt>{f.dateWeekday(s.ts)}</Txt></View>
                  <Txt v="small">{t('exercise.volumeN', { v: f.num(f.wToDisplay(s.volume), 0), unit: f.wUnit })}</Txt>
                </View>
                <Txt v="num" style={{ fontSize: 13 }}>
                  {raw?.sets.map((x, k) => (
                    <Text key={k} style={x.isWarmup ? { color: th.c.muted, fontStyle: 'italic' } : undefined}>
                      {x.isWarmup ? 'W ' : ''}{f.lift(x.weight)}×{x.reps}{'   '}
                    </Text>
                  ))}
                </Txt>
                {kinds.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {kinds.map((k) => (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: th.c.accentSoft }}>
                        <Icon name="star" size={11} color={th.c.accent} strokeWidth={2} />
                        <Text style={{ fontFamily: th.font.semibold, fontSize: 11, color: th.c.accent }}>PR · {prLabel[k]}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
        {shown < list.length ? <View style={{ paddingVertical: 8 }}><Button kind="ghost" label={t('exercise.showMore')} onPress={() => setShown((n) => n + PAGE)} /></View> : null}
        {!list.length ? <View style={{ padding: 12 }}><Txt v="muted">{t('common.noData')}</Txt></View> : null}
      </Card>
    </Screen>
  );
}

function LegendItem({ color, shape, label }: { color: string; shape: 'dot' | 'line'; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {shape === 'dot' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : <View style={{ width: 16, height: 2.5, borderRadius: 2, backgroundColor: color }} />}
      <Txt v="small">{label}</Txt>
    </View>
  );
}
