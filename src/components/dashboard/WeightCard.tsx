import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Card, Icon, Txt } from '../ui';
import { TrendChart } from '../charts';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { weightSummary } from '../../lib/insights';
import { useSettings } from '../../store/settings';

const TH = 96;
const DAY = 86_400_000;

export function WeightCard() {
  const t = useTheme();
  const tr = useT();
  const f = useFormat();
  const router = useRouter();
  const chartType = useSettings((s) => s.dashboardChart);
  const goalWeight = useSettings((s) => s.goalWeight);
  const w = useQuery(() => weightSummary(), []);
  const [ready, setReady] = useState(false);
  const tx = useSharedValue(0);

  const triggerLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setTimeout(() => router.push({ pathname: '/log', params: { metric: 'weight' } }), 120);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(15)
    .failOffsetX(-15)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const dx = Math.max(0, e.translationX);
      tx.value = dx > TH ? TH + (dx - TH) * 0.3 : dx;
      setReady(dx > TH);
    })
    .onEnd((e) => {
      if (e.translationX > TH) triggerLog();
    })
    .onFinalize(() => {
      tx.value = withTiming(0, { duration: 220 });
      setReady(false);
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const underStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, tx.value / TH) }));

  const now = Date.now();
  const from = now - 30 * DAY;
  const pts = w.trend.filter((p) => p.t >= from);
  const series = [{
    id: 'weight',
    raw: pts.map((p) => ({ t: p.t, v: p.raw, outlier: p.outlier })),
    trend: pts.map((p) => ({ t: p.t, v: p.trend })),
    agg: 'mean' as const,
  }];
  const hasData = w.current != null && w.lastRaw != null;
  const ref = [...w.trend].reverse().find((p) => p.t <= now - 30 * DAY) ?? w.trend[0];
  const dlt = hasData && ref ? (w.current as number) - ref.trend : 0;
  const towardGoal = goalWeight != null && w.current != null ? Math.abs(goalWeight - (w.current as number)) < Math.abs(goalWeight - (w.current as number) + dlt) : dlt < 0;
  const deltaColor = dlt === 0 ? t.c.muted : towardGoal ? t.c.good : goalWeight != null ? t.c.bad : t.c.muted;
  const lastT = w.lastRaw?.t ?? 0;
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  const loggedToday = hasData && lastT >= startToday;

  return (
    <View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: t.r, backgroundColor: ready ? t.c.accent : t.c.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20 }, underStyle]}>
        <Icon name="plus" size={20} color={ready ? t.c.accentInk : t.c.accent} />
        <Txt v="body" color={ready ? t.c.accentInk : t.c.accent} style={{ fontFamily: t.font.semibold }}>{tr('dash.logWeight')}</Txt>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <Card onPress={() => router.push('/history')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="label">{tr('dash.weight')}</Txt>
              <Txt v="xs">{tr('dash.last30')}</Txt>
            </View>
            {hasData ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Txt v="numXl">{f.bw(w.current as number)}</Txt>
                  <Txt v="unit">{f.wUnit}</Txt>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Txt v="small" color={deltaColor}>{f.signed(f.wToDisplay(dlt), 1)} {f.wUnit}</Txt>
                  </View>
                </View>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt v="xs">{tr('dash.today')}: {loggedToday ? `${f.bw((w.lastRaw as { raw: number }).raw)} ${f.wUnit}` : tr('dash.notLogged')}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Txt v="xs">{tr('dash.swipeHint')}</Txt>
                    <Icon name="chev" size={14} color={t.c.muted} />
                  </View>
                </View>
              </>
            ) : (
              <View style={{ paddingVertical: 18, gap: 8 }}>
                <Txt v="muted">{tr('dash.weightEmpty')}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Txt v="xs">{tr('dash.swipeHint')}</Txt>
                  <Icon name="chev" size={14} color={t.c.muted} />
                </View>
              </View>
            )}
          </Card>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
