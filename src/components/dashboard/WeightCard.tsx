import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Button, Card, Icon, Sheet, Txt } from '../ui';
import { TrendChart } from '../charts';
import { NumberField } from '../input';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { weightSummary } from '../../lib/insights';
import { addMeasurement, latestMeasurement } from '../../db/repo';
import { useSettings } from '../../store/settings';

const TH = 96;
const DAY = 86_400_000;

export function WeightCard() {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const chartType = useSettings((s) => s.dashboardChart);
  const prefill = useSettings((s) => s.prefill);
  const w = useQuery(() => weightSummary(), []);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState<number | null>(null);
  const tx = useSharedValue(0);

  const openSheet = () => {
    const last = latestMeasurement('weight');
    setVal(prefill && last ? Math.round(f.wToDisplay(last.value) * 10) / 10 : null);
    setOpen(true);
  };
  const triggerLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    openSheet();
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const dx = Math.max(0, e.translationX);
      tx.value = dx > TH ? TH + (dx - TH) * 0.3 : dx;
    })
    .onEnd((e) => {
      const done = e.translationX > TH;
      tx.value = withTiming(0, { duration: 220 });
      if (done) triggerLog();
    })
    .onFinalize(() => {
      tx.value = withTiming(0, { duration: 220 });
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const underStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, tx.value / TH) }));

  const now = Date.now();
  const from = now - 90 * DAY;
  const pts = w.trend.filter((p) => p.t >= from);
  const series = [{
    id: 'weight',
    raw: pts.map((p) => ({ t: p.t, v: p.raw, outlier: p.outlier })),
    trend: pts.map((p) => ({ t: p.t, v: p.trend })),
    agg: 'mean' as const,
  }];
  const hasData = w.current != null && w.lastRaw != null;
  const rate = w.rate ? f.signed(f.wToDisplay(w.rate.perWeek), 2) + ' ' + f.wUnit : null;

  return (
    <View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width: TH + 40, borderRadius: t.r, backgroundColor: t.c.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18 }, underStyle]}>
        <Icon name="plus" size={20} color={t.c.accent} />
        <Txt v="body" color={t.c.accent} style={{ fontFamily: t.font.semibold }}>{tr('dash.logWeight')}</Txt>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <Card onPress={() => router.push('/history')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="label">{tr('dash.weight')}</Txt>
              <Txt v="small">{tr('dash.last90')}</Txt>
            </View>
            {hasData ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <Txt v="numXl">{f.bw(w.current as number)}</Txt>
                  <Txt v="muted">{f.wUnit}</Txt>
                  {rate ? <Txt v="small" style={{ marginLeft: 8 }}>{tr('dash.perWeek', { v: rate })}</Txt> : null}
                </View>
                <View style={{ marginTop: 6 }}>
                  <TrendChart
                    series={series}
                    type={chartType}
                    height={150}
                    from={from}
                    to={now}
                    compact
                    toDisplay={f.wToDisplay}
                    formatY={(v) => f.numSmart(v, 1)}
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Txt v="small">{tr('dash.lastEntry')}: {f.bw((w.lastRaw as { raw: number }).raw)} {f.wUnit} · {f.ago((w.lastRaw as { t: number }).t)}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Txt v="small">{tr('dash.swipeHint')}</Txt>
                    <Icon name="chev" size={14} color={t.c.muted} />
                  </View>
                </View>
              </>
            ) : (
              <View style={{ paddingVertical: 18, gap: 8 }}>
                <Txt v="muted">{tr('dash.weightEmpty')}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Txt v="small">{tr('dash.swipeHint')}</Txt>
                  <Icon name="chev" size={14} color={t.c.muted} />
                </View>
              </View>
            )}
          </Card>
        </Animated.View>
      </GestureDetector>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={tr('dash.weightSheet')}
        footer={(
          <Button
            label={tr('common.save')}
            disabled={val == null || val <= 0}
            onPress={() => {
              if (val == null || val <= 0) return;
              addMeasurement('weight', f.wFromDisplay(val));
              setOpen(false);
            }}
          />
        )}
      >
        <NumberField value={val} onChange={setVal} unit={f.wUnit} decimals={1} size="lg" min={20} max={500} />
      </Sheet>
    </View>
  );
}
