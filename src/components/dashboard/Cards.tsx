import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Divider, StatusPill, Txt } from '../ui';
import { Pressable } from 'react-native';
import { TrendChart } from '../charts';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { consistencySummary, strengthSummary, volumeSummary, weightSummary } from '../../lib/insights';
import { latestMeasurement, listMeasurements, listMetrics } from '../../db/repo';
import { startOfWeek } from '../../analysis';
import { useSettings } from '../../store/settings';

const DAY = 86_400_000;

function Head({ title, sub, right }: { title: string; sub?: string; right?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt v="label">{title}</Txt>
      {right ? <Txt v="small">{right}</Txt> : sub ? <Txt v="small">{sub}</Txt> : null}
    </View>
  );
}

// ---------- strength ----------
export function StrengthCard() {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const s = useQuery(() => strengthSummary(), []);
  const combined = s.index.combined;
  const top = s.exercises.filter((a) => a.status.kind !== 'unknown').slice(0, 4);
  const now = Date.now();
  return (
    <Card>
      <Head title={tr('dash.strength')} sub={tr('dash.strengthSub')} />
      {combined.length < 2 ? (
        <Txt v="muted" style={{ marginTop: 8 }}>{tr('dash.strengthEmpty')}</Txt>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Txt v="numLg">{f.signed(combined[combined.length - 1].v, 1)} %</Txt>
            <StatusPill kind={s.status.kind} label={tr(`status.${s.status.kind}`)} />
          </View>
          <View style={{ marginTop: 6 }}>
            <TrendChart
              series={[{ id: 'strength', trend: combined }]}
              height={130}
              compact
              zeroLine
              from={now - 180 * DAY}
              to={now}
              formatY={(v) => `${f.signed(v, 0)} %`}
            />
          </View>
        </>
      )}
      {top.length ? <View style={{ marginTop: 8 }}><Divider /></View> : null}
      {top.map((a, i) => (
        <View key={a.exercise.id}>
          <Pressable
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: a.exercise.id } })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1}>{f.exerciseName(a.exercise)}</Txt>
              <Txt v="small">{f.signed(a.status.pct, 1)} %</Txt>
            </View>
            <StatusPill kind={a.status.kind} label={tr(`status.${a.status.kind}`)} />
          </Pressable>
          {i < top.length - 1 ? <Divider /> : null}
        </View>
      ))}
      <Txt v="small" style={{ marginTop: 6, color: t.c.muted }}>{tr('dash.strengthCap')}</Txt>
    </Card>
  );
}

// ---------- goal ----------
export function GoalCard() {
  const tr = useT();
  const f = useFormat();
  const goalWeight = useSettings((s) => s.goalWeight);
  const w = useQuery(() => weightSummary(), [goalWeight]);
  const t = useTheme();
  let body: ReactElement;
  if (goalWeight == null) {
    body = <Txt v="muted" style={{ marginTop: 8 }}>{tr('dash.goalNone')}</Txt>;
  } else if (w.current == null) {
    body = <Txt v="muted" style={{ marginTop: 8 }}>{tr('dash.goalNoData')}</Txt>;
  } else {
    const g = w.goal;
    const status = g?.status ?? 'unknown';
    const remaining = f.wToDisplay(goalWeight) - f.wToDisplay(w.current);
    body = (
      <>
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
          <View>
            <Txt v="small">{tr('dash.goalWeight')}</Txt>
            <Txt v="numLg">{f.bw(goalWeight)} <Txt v="muted">{f.wUnit}</Txt></Txt>
          </View>
          <View>
            <Txt v="small">{tr('dash.goalCurrent')}</Txt>
            <Txt v="numLg">{f.bw(w.current)} <Txt v="muted">{f.wUnit}</Txt></Txt>
          </View>
          <View>
            <Txt v="small">{tr('dash.goalRemaining')}</Txt>
            <Txt v="numLg">{f.signed(remaining, 1)} <Txt v="muted">{f.wUnit}</Txt></Txt>
          </View>
        </View>
        <Txt v="muted" style={{ marginTop: 10 }} color={status === 'wrong_direction' ? t.c.warn : status === 'reached' ? t.c.good : undefined}>
          {tr(`dash.goal.${status}`, { eta: g?.eta ? f.dateLong(g.eta) : '' })}
        </Txt>
      </>
    );
  }
  return (
    <Card>
      <Head title={tr('dash.goal')} />
      {body}
    </Card>
  );
}

// ---------- body ----------
export function BodyCard() {
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const rows = useQuery(() => {
    const now = Date.now();
    return listMetrics()
      .filter((m) => m.id !== 'weight')
      .map((m) => {
        const last = latestMeasurement(m.id);
        if (!last) return null;
        const all = listMeasurements(m.id);
        const ref = [...all].reverse().find((x) => x.ts <= now - 30 * DAY);
        const delta = ref && ref.id !== last.id ? last.value - ref.value : null;
        return { m, last, delta };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, []);
  return (
    <Card onPress={() => router.push('/log')}>
      <Head title={tr('dash.body')} right={`${tr('dash.log')} ›`} />
      {rows.length === 0 ? <Txt v="muted" style={{ marginTop: 8 }}>{tr('dash.bodyEmpty')}</Txt> : null}
      {rows.map(({ m, last, delta }, i) => (
        <View key={m.id}>
          {i > 0 ? <Divider /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1}>{f.metricName(m)}</Txt>
              <Txt v="small">
                {delta != null ? tr('dash.bodyDelta', { delta: `${f.signed(f.metricToDisplay(m, delta), m.decimals)} ${f.metricUnit(m)}`.trim() }) + ' · ' : ''}
                {f.ago(last.ts)}
              </Txt>
            </View>
            <Txt v="num">{f.metricValue(m, last.value)} {f.metricUnit(m)}</Txt>
          </View>
        </View>
      ))}
    </Card>
  );
}

// ---------- volume ----------
export function VolumeCard() {
  const tr = useT();
  const f = useFormat();
  const v = useQuery(() => volumeSummary(), []);
  const now = Date.now();
  const wk = startOfWeek(now);
  const sets = v.byMuscle.filter((x) => x.t0 === wk && x.sets > 0).sort((a, b) => b.sets - a.sets);
  const maxSets = Math.max(1, ...sets.map((x) => x.sets));
  const t = useTheme();
  return (
    <Card>
      <Head title={tr('dash.volume')} sub={tr('dash.volumeSub')} />
      {v.daily.length === 0 ? (
        <Txt v="muted" style={{ marginTop: 8 }}>{tr('dash.volumeEmpty')}</Txt>
      ) : (
        <View style={{ marginTop: 8 }}>
          <TrendChart
            series={[{ id: 'volume', raw: v.daily, trend: v.daily, agg: 'sum' }]}
            type="bars"
            height={130}
            compact
            from={now - 84 * DAY}
            to={now}
            toDisplay={f.wToDisplay}
            formatY={(x) => (x >= 1000 ? `${f.numSmart(x / 1000, 1)}k` : f.numSmart(x, 0))}
          />
        </View>
      )}
      <View style={{ marginTop: 12 }}><Txt v="label">{tr('dash.setsWeek')}</Txt></View>
      {sets.length === 0 ? <Txt v="muted" style={{ marginTop: 6 }}>{tr('dash.setsEmpty')}</Txt> : null}
      {sets.map((x) => (
        <View key={x.group} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
          <View style={{ width: 96 }}><Txt v="muted" numberOfLines={1}>{tr(`muscle.${x.group}`)}</Txt></View>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.c.surface2 }}>
            <View style={{ width: `${(x.sets / maxSets) * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.c.accent }} />
          </View>
          <View style={{ width: 24, alignItems: 'flex-end' }}><Txt v="num">{x.sets}</Txt></View>
        </View>
      ))}
    </Card>
  );
}

// ---------- consistency ----------
export function ConsistencyCard() {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const target = useSettings((s) => s.weeklyTarget);
  const c = useQuery(() => consistencySummary(), [target]);
  const max = Math.max(target, ...c.perWeek.map((w) => w.n), 1);
  const H = 70;
  const first = c.perWeek[0]?.t0;
  const lastW = c.perWeek[c.perWeek.length - 1]?.t0;
  return (
    <Card>
      <Head title={tr('dash.consistency')} sub={tr('dash.consistencySub')} />
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
        <View>
          <Txt v="small">{tr('dash.streak')}</Txt>
          <Txt v="numLg">{tr('dash.streakWeeks', { n: c.streakWeeks })}</Txt>
        </View>
        <View>
          <Txt v="small">{tr('dash.avgTarget')}</Txt>
          <Txt v="numLg">{tr('dash.avgTargetVal', { avg: f.num(c.avgPerWeek, 1), target })}</Txt>
        </View>
      </View>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: (target / max) * H, height: 1, backgroundColor: t.c.line }} />
        {c.perWeek.map((w) => (
          <View key={w.t0} style={{ flex: 1, height: Math.max(3, (w.n / max) * H), borderRadius: 3, backgroundColor: w.n >= target ? t.c.accent : t.c.surface2 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Txt v="small">{first != null ? f.date(first) : ''}</Txt>
        <Txt v="small">{lastW != null ? f.date(lastW) : ''}</Txt>
      </View>
    </Card>
  );
}
