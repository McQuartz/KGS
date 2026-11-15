import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Constants from 'expo-constants';
import { Button, Icon, Screen, Segmented, Txt } from '../../components/ui';
import { NumberField } from '../../components/input';
import { DataSection, Field, Group, ManageSection, MetricSheet, ReorderRows, Row, Stepper, SwitchRow, type ReorderItem } from '../../components/settings';
import * as repo from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useSettings, type ChartType, type ColorMode, type DashboardCardId, type InputMethod, type ThemeName } from '../../store/settings';
import { useTheme } from '../../theme';
import type { Metric } from '../../domain/types';

// Mockup STY swatches (light), only the two offered styles.
const STYLES: { id: ThemeName; sw: string[] }[] = [
  { id: 'stone', sw: ['#EFEEEA', '#3E6D61', '#15181A', '#86B8A8'] },
  { id: 'ash', sw: ['#F1F1EF', '#985C58', '#141414', '#D6A09A'] },
];

function StylePicker() {
  const t = useT();
  const th = useTheme();
  const theme = useSettings((s) => s.theme);
  const set = useSettings.getState().set;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {STYLES.map(({ id, sw }) => {
        const on = id === theme;
        return (
          <Pressable
            key={id}
            onPress={() => set({ theme: id })}
            style={{ flex: 1, borderWidth: 1.5, borderColor: on ? th.c.accent : th.c.line, borderRadius: th.rSm, padding: 10, gap: 8 }}
          >
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {sw.map((x, i) => <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: x, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }} />)}
            </View>
            <Txt style={{ fontSize: 13, lineHeight: 19, fontFamily: th.font.semibold }}>{t(`set.theme.${id}`)}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const START_CARDS: DashboardCardId[] = ['weight', 'strength', 'body', 'last' as DashboardCardId];

export default function SettingsScreen() {
  const t = useT();
  const f = useFormat();
  const th = useTheme();
  const s = useSettings();
  const set = useSettings.getState().set;
  const metrics = useQuery(() => repo.listMetrics(true));
  const [metricSheet, setMetricSheet] = useState<Metric | 'new' | null>(null);

  const chartOpts = (['line', 'dots', 'bars'] as ChartType[]).map((v) => ({ value: v, label: t(`set.chart.${v}`) }));

  const histItems: ReorderItem[] = useMemo(() => {
    const label = (id: string) => {
      if (id === 'weight') return t('metric.weight');
      if (id === 'strength' || id === 'volume') return t(`series.${id}`);
      const m = metrics.find((x) => x.id === id);
      return m ? f.metricName(m) : null;
    };
    const hint = (id: string) => {
      const m = metrics.find((x) => x.id === id);
      return m && !m.builtin ? f.metricUnit(m) || undefined : undefined;
    };
    const known = new Set(s.historySeries.map((x) => x.id));
    const merged = [...s.historySeries, ...metrics.filter((m) => !m.archived && !known.has(m.id)).map((m) => ({ id: m.id, visible: false }))];
    return merged.flatMap((x) => {
      const l = label(x.id);
      return l ? [{ id: x.id, label: l, visible: x.visible, hint: hint(x.id) }] : [];
    });
  }, [s.historySeries, metrics, f, t]);

  const cardVisible = (id: string) => s.dashboardCards.some((c) => c.id === id && c.visible);
  const toggleCard = (id: DashboardCardId, visible: boolean) => {
    const has = s.dashboardCards.some((c) => c.id === id);
    set({ dashboardCards: has ? s.dashboardCards.map((c) => (c.id === id ? { ...c, visible } : c)) : [...s.dashboardCards, { id, visible }] });
  };

  const steps = [0.5, 1, 2.5];
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const goalDisplay = s.goalWeight != null ? f.wToDisplay(s.goalWeight) : null;
  const capText = (k: string) => <Txt v="xs" style={{ lineHeight: 17 }}>{t(k)}</Txt>;

  return (
    <Screen title={t('set.title')}>
      <Group label={t('set.appearance')} loose>
        <StylePicker />
        {capText(`set.theme.${s.theme}Cap`)}
        <Segmented<ColorMode>
          value={s.mode}
          onChange={(mode) => set({ mode })}
          options={[{ value: 'light', label: t('set.mode.light') }, { value: 'dark', label: t('set.mode.dark') }, { value: 'system', label: t('set.mode.system') }]}
        />
      </Group>

      <Group label={t('set.startScreen')}>
        {START_CARDS.map((id) => <SwitchRow key={id} title={t(`set.card.${id}`)} value={cardVisible(id)} onChange={(v) => toggleCard(id, v)} />)}
      </Group>

      <Group label={t('set.history')}>
        <ReorderRows items={histItems} onChange={(next) => set({ historySeries: next })} />
        <Pressable onPress={() => setMetricSheet('new')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <Icon name="plus" size={16} color={th.c.accent} />
          <Txt color={th.c.accent} style={{ fontSize: 13, lineHeight: 19 }}>{t('set.metrics.add')}</Txt>
        </Pressable>
      </Group>

      <Group label={t('set.input')}>
        <Field caption={t('set.input.cap')}>
          <Segmented<InputMethod>
            value={s.input}
            onChange={(input) => set({ input })}
            options={[{ value: 'pad', label: t('set.input.pad') }, { value: 'wheel', label: t('set.input.wheel') }, { value: 'stepper', label: t('set.input.stepper') }]}
          />
        </Field>
        <Field title={t('set.stepperStep')}>
          <Segmented
            value={String(s.stepperStep)}
            onChange={(v) => set({ stepperStep: Number(v) })}
            options={steps.map((v) => ({ value: String(v), label: f.num(v, v % 1 ? 1 : 0) }))}
          />
        </Field>
        <SwitchRow title={t('set.prefill')} value={s.prefill} onChange={(prefill) => set({ prefill })} />
      </Group>

      <Group label={t('set.training')}>
        <Field caption={t('set.logMode.cap')}>
          <Segmented
            value={s.logMode}
            onChange={(logMode) => set({ logMode })}
            options={[{ value: 'all', label: t('set.logMode.all') }, { value: 'pr', label: t('set.logMode.pr') }]}
          />
        </Field>
        <SwitchRow title={t('set.warmups')} caption={t('set.warmups.cap')} value={s.warmups} onChange={(warmups) => set({ warmups })} />
        <Field title={t('set.rest')}>
          <Segmented
            value={String(s.restSec)}
            onChange={(v) => set({ restSec: Number(v) })}
            options={[60, 90, 120, 180].map((v) => ({ value: String(v), label: f.mmss(v) }))}
          />
        </Field>
      </Group>

      <Group label={t('set.analysis')}>
        <SwitchRow title={t('set.show1rm')} caption={t('set.show1rm.cap')} value={s.show1rm} onChange={(show1rm) => set({ show1rm })} />
        <SwitchRow title={t('set.hints')} value={s.hints} onChange={(hints) => set({ hints })} />
      </Group>

      <Group label={t('set.langUnits')} loose>
        <Segmented value={s.units} onChange={(units) => set({ units })} options={[{ value: 'metric', label: t('set.units.metric') }, { value: 'imperial', label: t('set.units.imperial') }]} />
        <Segmented value={s.lang} onChange={(lang) => set({ lang })} options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]} />
      </Group>

      <Group label={t('set.goals')}>
        <Field>
          <NumberField
            label={t('set.goalWeight')}
            value={goalDisplay}
            unit={f.wUnit}
            decimals={1}
            step={0.5}
            onChange={(v) => set({ goalWeight: f.wFromDisplay(v) })}
          />
          {s.goalWeight != null ? (
            <Button kind="ghost" compact label={t('set.goalWeight.clear')} onPress={() => set({ goalWeight: null })} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Txt v="xs" style={{ lineHeight: 17 }}>{t('set.goalWeight.none')}</Txt>
          )}
        </Field>
        <SwitchRow title={t('set.card.goal')} value={cardVisible('goal')} onChange={(v) => toggleCard('goal', v)} />
        <Row title={t('set.weeklyTarget')}>
          <Stepper value={s.weeklyTarget} onChange={(weeklyTarget) => set({ weeklyTarget })} step={1} min={1} max={14} format={(v) => t('set.perWeek', { n: v })} />
        </Row>
        <Field title={t('set.trendMethod')} caption={t('set.trend.cap')}>
          <Segmented
            value={s.trendMethod}
            onChange={(trendMethod) => set({ trendMethod })}
            options={[{ value: 'ema', label: t('set.trend.ema') }, { value: 'median', label: t('set.trend.median') }]}
          />
        </Field>
      </Group>

      <Group label={t('set.charts')}>
        <Field title={t('set.dashboard')}>
          <Segmented value={s.dashboardChart} onChange={(dashboardChart) => set({ dashboardChart })} options={chartOpts} />
        </Field>
        <Field title={t('set.history')}>
          <Segmented value={s.historyChart} onChange={(historyChart) => set({ historyChart })} options={chartOpts} />
        </Field>
      </Group>

      <ManageSection />
      <DataSection />

      <Group label={t('set.about')}>
        <Row title={t('set.version')}><Txt v="num">{version}</Txt></Row>
        <View style={{ paddingVertical: 12 }}><Txt v="xs" style={{ lineHeight: 17 }}>{t('set.about.note')}</Txt></View>
      </Group>
      <MetricSheet metric={metricSheet} onClose={() => setMetricSheet(null)} />
    </Screen>
  );
}
