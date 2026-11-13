import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Constants from 'expo-constants';
import { Button, Screen, Segmented, Txt } from '../../components/ui';
import { NumberField } from '../../components/input';
import { DataSection, Field, Group, ManageSection, ReorderList, RowDivider, Stepper, SwitchRow, type ReorderItem } from '../../components/settings';
import * as repo from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useSettings, type ChartType, type ColorMode, type DashboardCardId, type InputMethod, type ThemeName } from '../../store/settings';
import { makeTheme, useTheme } from '../../theme';

const THEMES: ThemeName[] = ['ash', 'stone'];

function ThemePicker() {
  const t = useT();
  const th = useTheme();
  const theme = useSettings((s) => s.theme);
  const set = useSettings.getState().set;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {THEMES.map((n) => {
          const c = makeTheme(n, th.dark).c;
          const on = n === theme;
          return (
            <Pressable
              key={n}
              onPress={() => set({ theme: n })}
              style={{ flex: 1, padding: 12, gap: 8, borderRadius: th.rSm, borderWidth: on ? 2 : 1, borderColor: on ? th.c.accent : th.c.line, backgroundColor: th.c.surface2 }}
            >
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[c.bg, c.surface, c.accent, c.text].map((x, i) => (
                  <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: x, borderWidth: 1, borderColor: th.c.line }} />
                ))}
              </View>
              <Txt style={{ fontFamily: th.font.semibold }}>{t(`set.theme.${n}`)}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt v="small">{t(`set.theme.${theme}Cap`)}</Txt>
    </View>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const f = useFormat();
  const s = useSettings();
  const set = useSettings.getState().set;
  const metrics = useQuery(() => repo.listMetrics(true));

  const chartOpts = (['line', 'dots', 'bars'] as ChartType[]).map((v) => ({ value: v, label: t(`set.chart.${v}`) }));

  const histItems: ReorderItem[] = useMemo(() => {
    const label = (id: string) => {
      if (id === 'weight' || id === 'strength' || id === 'volume') return id === 'weight' ? t('metric.weight') : t(`series.${id}`);
      const m = metrics.find((x) => x.id === id);
      return m ? f.metricName(m) : null;
    };
    const known = new Set(s.historySeries.map((x) => x.id));
    const merged = [...s.historySeries, ...metrics.filter((m) => !m.archived && !known.has(m.id)).map((m) => ({ id: m.id, visible: false }))];
    return merged.flatMap((x) => {
      const l = label(x.id);
      return l ? [{ id: x.id, label: l, visible: x.visible }] : [];
    });
  }, [s.historySeries, metrics, f, t]);

  const dashItems: ReorderItem[] = s.dashboardCards.map((c) => ({ id: c.id, label: t(`set.card.${c.id}`), visible: c.visible }));

  const steps = [0.5, 1, 2.5];
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const goalDisplay = s.goalWeight != null ? f.wToDisplay(s.goalWeight) : null;

  return (
    <Screen title={t('set.title')}>
      <Group label={t('set.appearance')}>
        <ThemePicker />
        <Segmented<ColorMode>
          value={s.mode}
          onChange={(mode) => set({ mode })}
          options={[{ value: 'system', label: t('set.mode.system') }, { value: 'light', label: t('set.mode.light') }, { value: 'dark', label: t('set.mode.dark') }]}
        />
      </Group>

      <Group label={t('set.langUnits')}>
        <Segmented value={s.lang} onChange={(lang) => set({ lang })} options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]} />
        <Segmented value={s.units} onChange={(units) => set({ units })} options={[{ value: 'metric', label: t('set.units.metric') }, { value: 'imperial', label: t('set.units.imperial') }]} />
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
        <SwitchRow title={t('set.warmups')} caption={t('set.warmups.cap')} value={s.warmups} onChange={(warmups) => set({ warmups })} />
        <RowDivider />
        <Field title={t('set.logMode')} caption={t('set.logMode.cap')}>
          <Segmented
            value={s.logMode}
            onChange={(logMode) => set({ logMode })}
            options={[{ value: 'all', label: t('set.logMode.all') }, { value: 'pr', label: t('set.logMode.pr') }]}
          />
        </Field>
        <RowDivider />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Txt>{t('set.rest')}</Txt></View>
          <Stepper value={s.restSec} onChange={(restSec) => set({ restSec })} step={30} min={30} max={600} format={f.mmss} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Txt>{t('set.weeklyTarget')}</Txt></View>
          <Stepper value={s.weeklyTarget} onChange={(weeklyTarget) => set({ weeklyTarget })} step={1} min={1} max={14} format={(v) => t('set.perWeek', { n: v })} />
        </View>
        <RowDivider />
        <SwitchRow title={t('set.show1rm')} caption={t('set.show1rm.cap')} value={s.show1rm} onChange={(show1rm) => set({ show1rm })} />
      </Group>

      <Group label={t('set.goals')}>
        <View style={{ gap: 8 }}>
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
            <Txt v="small">{t('set.goalWeight.none')}</Txt>
          )}
        </View>
        <RowDivider />
        <Field title={t('set.trendMethod')} caption={t('set.trend.cap')}>
          <Segmented
            value={s.trendMethod}
            onChange={(trendMethod) => set({ trendMethod })}
            options={[{ value: 'ema', label: t('set.trend.ema') }, { value: 'median', label: t('set.trend.median') }]}
          />
        </Field>
        <SwitchRow title={t('set.hints')} caption={t('set.hints.cap')} value={s.hints} onChange={(hints) => set({ hints })} />
      </Group>

      <Group label={t('set.dashboard')}>
        <Txt v="small">{t('set.dashboard.cap')}</Txt>
        <ReorderList items={dashItems} onChange={(next) => set({ dashboardCards: next.map((x) => ({ id: x.id as DashboardCardId, visible: x.visible })) })} />
        <RowDivider />
        <Field title={t('set.chartType')}>
          <Segmented value={s.dashboardChart} onChange={(dashboardChart) => set({ dashboardChart })} options={chartOpts} />
        </Field>
      </Group>

      <Group label={t('set.history')}>
        <Txt v="small">{t('set.history.cap')}</Txt>
        <ReorderList items={histItems} onChange={(next) => set({ historySeries: next })} />
        <RowDivider />
        <Field title={t('set.chartType')}>
          <Segmented value={s.historyChart} onChange={(historyChart) => set({ historyChart })} options={chartOpts} />
        </Field>
      </Group>

      <ManageSection />
      <DataSection />

      <Group label={t('set.about')}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}><Txt>{t('set.version')}</Txt></View>
          <Txt v="num">{version}</Txt>
        </View>
        <Txt v="small">{t('set.about.note')}</Txt>
      </Group>
    </Screen>
  );
}
