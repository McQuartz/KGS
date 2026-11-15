import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Chip, IconButton, Screen, Txt } from '../components/ui';
import { NumberField } from '../components/input';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useFormat } from '../lib/format';
import { useQuery } from '../lib/useQuery';
import { metricTrend } from '../lib/insights';
import { addMeasurement, latestMeasurement, listMetrics } from '../db/repo';
import { useSettings } from '../store/settings';

export default function LogBody() {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const prefill = useSettings((s) => s.prefill);
  const params = useLocalSearchParams<{ metric?: string }>();
  const metrics = useQuery(() => listMetrics(), []);
  const [metricId, setMetricId] = useState<string>(params.metric ?? 'weight');
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

  if (!metric) return <Screen title={tr('body.title')}><Txt v="muted">{tr('common.noData')}</Txt></Screen>;

  const save = () => {
    if (value == null) return;
    addMeasurement(metric.id, f.metricFromDisplay(metric, value), Date.now(), note.trim() || null);
    router.back();
  };

  const lastTrend = trend.length ? trend[trend.length - 1].trend : null;

  return (
    <Screen
      bar
      title={tr('body.title')}
      left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={tr('common.back')} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {metrics.map((m) => (
          <Chip key={m.id} label={f.metricName(m)} on={m.id === metric.id} onPress={() => setMetricId(m.id)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="muted">{tr('common.today')}, {f.dateWeekday(Date.now())}</Txt>
        {last ? <Txt v="muted">{tr('body.last')}: {f.metricValue(metric, last.value)} {f.metricUnit(metric)} · {f.ago(last.ts)}</Txt> : null}
      </View>

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
        <View style={{ alignItems: 'center', marginTop: -6 }}>
          <Txt v="xs">{tr('body.trend')}: {f.metricValue(metric, lastTrend)} {f.metricUnit(metric)}</Txt>
        </View>
      ) : null}

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={tr('body.notePlaceholder')}
        placeholderTextColor={t.c.muted}
        style={{ height: 46, borderRadius: t.rSm, backgroundColor: t.c.surface, borderWidth: t.cardBorder, borderColor: t.c.line, paddingHorizontal: 14, fontFamily: t.font.regular, fontSize: 15, color: t.c.text }}
      />
      <Button label={tr('common.save')} onPress={save} disabled={value == null} large />
      <Txt v="xs">{tr('body.inputHint')}</Txt>
    </Screen>
  );
}
