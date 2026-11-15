import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { detectPRs } from '../../analysis';
import { ExerciseCard } from '../../components/train/ExerciseCard';
import { ExercisePicker } from '../../components/train/ExercisePicker';
import { RestBar, type RestState } from '../../components/train/RestBar';
import { SetEditor } from '../../components/train/SetEditor';
import { setVolume, useExerciseMap } from '../../components/train/util';
import { WorkoutTypeSheet } from '../../components/train/WorkoutTypeSheet';
import { MockSheet } from '../../components/train/MockSheet';
import { Button, Card, Icon, IconButton, Screen, Txt } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Exercise, Workout, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';

const MAX_REST_SEC = 30 * 60;

interface Summary { durationSec: number; exercises: number; sets: number; volume: number; prs: string[] }

/** Ticking elapsed time; isolated so only this text re-renders every second. */
function Elapsed({ start }: { start: number }) {
  const f = useFormat();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{f.mmss((now - start) / 1000)}</>;
}

export default function ActiveWorkout() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const restSec = useSettings((s) => s.restSec);
  const logMode = useSettings((s) => s.logMode);
  const exMap = useExerciseMap();
  const workout = useQuery(() => repo.getActiveWorkout(), []);
  const templates = useQuery(() => repo.listTemplates(), []);
  const tpl = useMemo(() => templates.find((x) => x.id === workout?.templateId) ?? null, [templates, workout?.templateId]);

  const [rest, setRest] = useState<RestState | null>(null);
  const [restHidden, setRestHidden] = useState(true);
  const finishing = useRef(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // on resume: derive the rest start from the latest logged set (bar stays hidden)
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !workout) return;
    resumed.current = true;
    const ts = Math.max(0, ...workout.exercises.flatMap((e) => e.sets.map((s) => s.ts)));
    if (ts && Date.now() - ts < MAX_REST_SEC * 1000) setRest({ start: ts, dur: restSec });
  }, [workout, restSec]);

  // nothing in progress (e.g. discarded) -> back to Train
  useEffect(() => {
    if (!workout && !summary && !finishing.current) router.replace('/(tabs)/train');
  }, [workout, summary, router]);

  const restElapsed = () => {
    if (!rest) return null;
    const s = Math.round((Date.now() - rest.start) / 1000);
    return s >= 0 && s <= MAX_REST_SEC ? s : null;
  };
  const onLogged = () => {
    setRest({ start: Date.now(), dur: restSec });
    setRestHidden(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  if (!workout) {
    if (!summary) return <Screen><View /></Screen>;
    return <SummaryView summary={summary} onDone={() => router.replace('/(tabs)/train')} />;
  }

  const w: Workout = workout;
  const existingIds = w.exercises.map((e) => e.exerciseId);
  const allSets = w.exercises.flatMap((e) => e.sets);
  const curId = w.exercises.some((e) => e.id === activeId) ? activeId : (w.exercises[0]?.id ?? null);

  const addExercise = (e: Exercise) => { setActiveId(repo.addWorkoutExercise(w.id, e.id)); };

  const loadTemplate = (id: string) => {
    const tp = templates.find((x) => x.id === id);
    if (!tp) return;
    const apply = (replace: boolean) => {
      if (replace) w.exercises.forEach((e) => repo.removeWorkoutExercise(e.id));
      const have = replace ? [] : existingIds;
      tp.exercises.forEach((e) => { if (!have.includes(e.exerciseId)) repo.addWorkoutExercise(w.id, e.exerciseId); });
      repo.updateWorkout(w.id, { templateId: tp.id, ...(w.exercises.length === 0 || replace ? { workoutType: tp.workoutType } : {}) });
    };
    setTplOpen(false);
    if (!w.exercises.length) { apply(false); return; }
    Alert.alert(t('train.loadTemplate'), t('train.swapQ', { name: tp.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('train.append'), onPress: () => apply(false) },
      { text: t('train.replace'), style: 'destructive', onPress: () => apply(true) },
    ]);
  };

  const doFinish = () => {
    finishing.current = true;
    const endAt = Date.now();
    const exIds = [...new Set(w.exercises.filter((e) => e.sets.length).map((e) => e.exerciseId))];
    const sets = allSets.length;
    const vol = w.exercises.reduce((a, e) => a + setVolume(e.sets), 0);
    const ok = repo.finishWorkout(w.id);
    if (!ok) { router.replace('/(tabs)/train'); return; }
    const prs: string[] = [];
    for (const id of exIds) {
      const hit = detectPRs(repo.exerciseSessions(id)).find((s) => s.workoutId === w.id);
      if (hit && hit.prs.length) prs.push(f.exerciseName(exMap.get(id)));
    }
    setSummary({ durationSec: (endAt - w.startedAt) / 1000, exercises: exIds.length, sets, volume: vol, prs });
  };

  const finish = () => {
    const empty = !allSets.length;
    Alert.alert(
      t('train.finishQ'),
      empty ? t('train.finishEmpty') : t('train.finishBody', { n: allSets.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: empty ? t('train.discard') : t('train.finish'), style: empty ? 'destructive' : 'default', onPress: doFinish },
      ],
    );
  };

  const showRest = !!rest && !restHidden && logMode === 'all';
  const empty = w.exercises.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: th.c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: insets.top + 12, paddingBottom: 10 }}>
        <IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />
        <View style={{ flex: 1 }}>
          <Txt v="eyebrow" numberOfLines={1} style={{ marginBottom: 4 }}>
            <Elapsed start={w.startedAt} /> · {tpl ? tpl.name : logMode === 'pr' ? t('train.modePr') : t('train.modeAll')}
          </Txt>
          <Pressable onPress={() => setTypeOpen(true)}><Txt v="title" numberOfLines={1}>{t(`wtype.${w.workoutType}`)}</Txt></Pressable>
        </View>
        <Button compact label={t('train.finish')} onPress={finish} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: insets.bottom + 28 + (showRest ? 72 : 0), gap: 14 }}>
        {empty ? (
          <Card style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 16 }}>
            <Txt v="title">{t('train.noExYet')}</Txt>
            <Txt v="small" style={{ textAlign: 'center' }}>{t('train.noExHint')}</Txt>
          </Card>
        ) : w.exercises.map((we, i) => {
          const ex = exMap.get(we.exerciseId);
          if (!ex) return null;
          return (
            <ExerciseCard
              key={we.id} we={we} exercise={ex} workoutId={w.id} active={we.id === curId}
              plan={tpl?.exercises.find((x) => x.exerciseId === we.exerciseId)}
              onActivate={() => setActiveId(we.id)}
              onComplete={() => { const nx = w.exercises[i + 1]; if (nx) setActiveId(nx.id); }}
              restElapsed={restElapsed} onLogged={onLogged} onEditSet={setEditing}
            />
          );
        })}
        <Button kind={empty ? 'primary' : 'ghost'} large={empty} icon="plus" label={t('train.addExercise')} onPress={() => setPickerOpen(true)} />
        <Pressable onPress={() => setTplOpen(true)} style={{ alignSelf: 'center', height: 34, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Txt style={{ fontFamily: th.font.semibold, fontSize: 14, color: th.c.muted }}>{t('train.loadTemplate')}</Txt>
        </Pressable>
      </ScrollView>

      {showRest && rest ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 8 }}>
          <RestBar rest={rest} onAdjust={(d) => setRest({ ...rest, dur: Math.max(15, rest.dur + d) })} onSkip={() => setRestHidden(true)} />
        </View>
      ) : null}

      {typeOpen ? <WorkoutTypeSheet visible onClose={() => setTypeOpen(false)} value={w.workoutType} onPick={(v) => repo.updateWorkout(w.id, { workoutType: v })} /> : null}
      {pickerOpen ? <ExercisePicker visible onClose={() => setPickerOpen(false)} onPick={addExercise} workoutType={w.workoutType} excludeIds={existingIds} /> : null}
      {editing ? <SetEditor set={editing} exercise={exMap.get(w.exercises.find((e) => e.id === editing.workoutExerciseId)?.exerciseId ?? '')} onClose={() => setEditing(null)} /> : null}
      {tplOpen ? (
        <MockSheet visible onClose={() => setTplOpen(false)} title={t('train.loadTemplate')}>
          <Txt v="xs">{t('train.loadTemplateHint')}</Txt>
          <View>
            {templates.length ? templates.map((tp, i) => (
              <Pressable
                key={tp.id} onPress={() => loadTemplate(tp.id)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.c.line, opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: th.font.medium }}>{tp.name}</Txt>
                  <Txt v="xs">{tp.exercises.map((e) => `${f.exerciseName(exMap.get(e.exerciseId))} ${e.sets}`).join(' · ')}</Txt>
                </View>
                <Icon name="plus" size={16} color={th.c.text} />
              </Pressable>
            )) : <Txt v="muted">{t('train.noTemplates')}</Txt>}
          </View>
        </MockSheet>
      ) : null}
    </View>
  );
}

function SummaryView({ summary, onDone }: { summary: Summary; onDone: () => void }) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  return (
    <Screen title={t('train.done')} footer={<Button label={t('common.done')} onPress={onDone} />}>
      <Card style={{ gap: 12 }}>
        <Stat label={t('train.duration')} value={`${Math.max(1, Math.round(summary.durationSec / 60))} ${t('train.min')}`} />
        <Stat label={t('train.exercises')} value={String(summary.exercises)} />
        <Stat label={t('train.sets')} value={String(summary.sets)} />
        {summary.volume > 0 ? <Stat label={t('train.volume')} value={`${f.num(f.wToDisplay(summary.volume), 0)} ${f.wUnit}`} /> : null}
      </Card>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="star" size={18} color={th.c.accent} />
          <Txt v="title">{t('train.prCount', { n: summary.prs.length })}</Txt>
        </View>
        {summary.prs.length ? <Txt v="muted">{summary.prs.join(' · ')}</Txt> : null}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}><Txt v="muted">{label}</Txt></View>
      <Txt v="num">{value}</Txt>
    </View>
  );
}
