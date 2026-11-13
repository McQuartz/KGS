import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, Icon, IconButton, Screen, SectionLabel, Txt } from '../components/ui';
import { NumberField } from '../components/input';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useFormat } from '../lib/format';
import { useQuery } from '../lib/useQuery';
import { metricTrend } from '../lib/insights';
import { addMeasurement, deleteMeasurement, latestMeasurement, listMeasurements, listMetrics } from '../db/repo';
import { useSettings } from '../store/settings';

const DAY = 86_400_000;

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function LogBody() {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const prefill = useSettings((s) => s.prefill);
  const params = useLocalSearchParams<{ metric?: string }>();
  const metrics = useQuery(() => listMetrics(), []);
  const [metricId, setMetricId] = useState<string>(params.metric ?? 'weight');
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, negative = earlier
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const mid = metric?.id;
  const last = useQuery(() => (mid ? latestMeasurement(mid) : null), [mid]);
  const trend = useQuery(() => (mid ? metricTrend(mid) : []), [mid]);

  // (re)prefill when the metric changes
  useEffect(() => {
    if (!metric) return;
    const l = latestMeasurement(metric.id);
    const p = 10 ** metric.decimals;
    setValue(prefill && l ? Math.round(f.metricToDisplay(metric, l.value) * p) / p : null);
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  const today0 = startOfDay(Date.now());
  const dayTs = today0 + dayOffset * DAY;
  const dayLabel = dayOffset === 0 ? tr('common.today') : dayOffset === -1 ? tr('common.yesterday') : f.dateWeekday(dayTs);

  const recent = useMemo(() => {
    const out = new Map(trend.map((p) => [p.t, p.outlier]));
    return trend.length ? [...trend].reverse().slice(0, 30).map((p) => ({ t: p.t, v: p.raw, outlier: out.get(p.t) === true })) : [];
  }, [trend]);
  const entries = useQuery(() => (mid ? listMeasurements(mid) : []), [mid]);
  const rows = useMemo(() => {
    const byTs = new Map(recent.map((r) => [r.t, r.outlier]));
    return [...entries].reverse().slice(0, 30).map((e) => ({ ...e, outlier: byTs.get(e.ts) === true }));
  }, [entries, recent]);

  if (!metric) return <Screen title={tr('body.title')}><Txt v="muted">{tr('common.noData')}</Txt></Screen>;

  const save = () => {
    if (value == null) return;
    const now = Date.now();
    const ts = dayOffset === 0 ? now : dayTs + 12 * 3_600_000;
    addMeasurement(metric.id, f.metricFromDisplay(metric, value), ts, note.trim() || null);
    router.back();
  };

  const confirmDelete = (id: string, ts: number, v: number) => {
    Alert.alert(tr('body.deleteTitle'), tr('body.deleteMsg', { value: `${f.metricValue(metric, v)} ${f.metricUnit(metric)}`.trim(), date: f.date(ts) }), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('common.delete'), style: 'destructive', onPress: () => deleteMeasurement(id) },
    ]);
  };

  const lastTrend = trend.length ? trend[trend.length - 1].trend : null;

  return (
    <Screen
      title={tr('body.title')}
      right={<IconButton name="close" onPress={() => router.back()} accessibilityLabel={tr('common.close')} />}
      footer={<Button label={tr('common.save')} onPress={save} disabled={value == null} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {metrics.map((m) => (
          <Chip key={m.id} label={f.metricName(m)} on={m.id === metric.id} onPress={() => setMetricId(m.id)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton name="back" size={18} onPress={() => setDayOffset((d) => d - 1)} accessibilityLabel={tr('body.prevDay')} />
          <Txt style={{ minWidth: 96, textAlign: 'center' }}>{dayLabel}</Txt>
          <View style={{ opacity: dayOffset >= 0 ? 0.3 : 1 }} pointerEvents={dayOffset >= 0 ? 'none' : 'auto'}>
            <IconButton name="chev" size={18} onPress={() => setDayOffset((d) => Math.min(0, d + 1))} accessibilityLabel={tr('body.nextDay')} />
          </View>
        </View>
        {last ? <Txt v="small">{tr('body.last')}: {f.metricValue(metric, last.value)} {f.metricUnit(metric)} · {f.ago(last.ts)}</Txt> : null}
      </View>

      <Card>
        <NumberField
          value={value}
          onChange={setValue}
          unit={f.metricUnit(metric)}
          decimals={metric.decimals}
          size="lg"
          min={0}
          placeholder={last ? f.metricToDisplay(metric, last.value) : null}
        />
        {lastTrend != null ? (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Txt v="small">{tr('body.trend')}: {f.metricValue(metric, lastTrend)} {f.metricUnit(metric)}</Txt>
          </View>
        ) : null}
      </Card>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={tr('body.notePlaceholder')}
        placeholderTextColor={t.c.muted}
        style={{ height: 46, borderRadius: t.rSm, backgroundColor: t.c.surface, paddingHorizontal: 14, fontFamily: t.font.regular, fontSize: 15, color: t.c.text }}
      />

      <SectionLabel>{tr('body.recent')}</SectionLabel>
      <Card>
        {rows.length === 0 ? <Txt v="muted">{tr('body.noEntries')}</Txt> : null}
        {rows.map((r, i) => (
          <View key={r.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onLongPress={() => confirmDelete(r.id, r.ts, r.value)}
              delayLongPress={350}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ flex: 1 }}>
                <Txt v="num">{f.metricValue(metric, r.value)} {f.metricUnit(metric)}</Txt>
                {r.note ? <Txt v="small" numberOfLines={1}>{r.note}</Txt> : null}
              </View>
              {r.outlier ? <Txt v="small" color={t.c.warn}>{tr('body.outlier')}</Txt> : null}
              <Txt v="small">{f.date(r.ts)}</Txt>
              <Pressable hitSlop={8} onPress={() => confirmDelete(r.id, r.ts, r.value)}>
                <Icon name="trash" size={16} color={t.c.muted} />
              </Pressable>
            </Pressable>
          </View>
        ))}
      </Card>
      {rows.length ? <Txt v="small">{tr('body.hold')}</Txt> : null}
    </Screen>
  );
}
