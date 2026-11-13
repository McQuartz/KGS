import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Vibration, View } from 'react-native';
import { detectPRs } from '../../analysis';
import { ExerciseCard } from '../../components/train/ExerciseCard';
import { ExercisePicker } from '../../components/train/ExercisePicker';
import { RestBar, type RestState } from '../../components/train/RestBar';
import { SetEditor } from '../../components/train/SetEditor';
import { setVolume, useExerciseMap } from '../../components/train/util';
import { WorkoutTypeSheet } from '../../components/train/WorkoutTypeSheet';
import { Button, Card, Icon, IconButton, ListRow, Screen, Sheet, Txt, Divider } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Exercise, Workout, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';

const MAX_REST_SEC = 30 * 60;

interface Summary { durationSec: number; exercises: number; sets: number; volume: number; prs: string[] }

export default function ActiveWorkout() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const restSec = useSettings((s) => s.restSec);
  const logMode = useSettings((s) => s.logMode);
  const exMap = useExerciseMap();
  const workout = useQuery(() => repo.getActiveWorkout(), []);
  const templates = useQuery(() => repo.listTemplates(), []);
  const tpl = useMemo(() => templates.find((x) => x.id === workout?.templateId) ?? null, [templates, workout?.templateId]);

  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<RestState | null>(null);
  const [restHidden, setRestHidden] = useState(true);
  const notified = useRef(false);
  const finishing = useRef(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  // tick every second (elapsed time + rest countdown)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  // rest finished: haptic + vibration, once
  useEffect(() => {
    if (!rest || restHidden) return;
    const rem = rest.dur - (now - rest.start) / 1000;
    if (rem <= 0 && !notified.current) {
      notified.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Vibration.vibrate([0, 300, 150, 300]);
    }
  }, [now, rest, restHidden]);

  const restElapsed = () => {
    if (!rest) return null;
    const s = Math.round((Date.now() - rest.start) / 1000);
    return s >= 0 && s <= MAX_REST_SEC ? s : null;
  };
  const onLogged = () => {
    notified.current = false;
    setRest({ start: Date.now(), dur: restSec });
    setRestHidden(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  if (!workout) {
    if (!summary) return <Screen><View /></Screen>;
    return <SummaryView summary={summary} onDone={() => router.replace('/(tabs)/train')} />;
  }

  const w: Workout = workout;
  const elapsed = f.mmss((now - w.startedAt) / 1000);
  const existingIds = w.exercises.map((e) => e.exerciseId);
  const allSets = w.exercises.flatMap((e) => e.sets);

  const addExercise = (e: Exercise) => { repo.addWorkoutExercise(w.id, e.id); };

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

  const showRest = rest && !restHidden && logMode === 'all';

  return (
    <>
      <Screen
        title={t('train.workout')}
        left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}
        right={<Button compact label={t('train.finish')} onPress={finish} />}
        footer={(
          <>
            {showRest && rest ? <RestBar rest={rest} now={now} onAdjust={(d) => setRest({ ...rest, dur: Math.max(15, rest.dur + d) })} onSkip={() => setRestHidden(true)} /> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button style={{ flex: 1 }} kind="secondary" label={t('train.loadTemplate')} onPress={() => setTplOpen(true)} />
              <Button style={{ flex: 1 }} icon="plus" label={t('train.addExercise')} onPress={() => setPickerOpen(true)} />
            </View>
          </>
        )}
      >
        <Pressable onPress={() => setTypeOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="title">{t(`wtype.${w.workoutType}`)}</Txt>
          <Icon name="down" size={16} color={th.c.muted} />
          <View style={{ flex: 1 }} />
          <Icon name="timer" size={16} color={th.c.muted} />
          <Txt v="num">{elapsed}</Txt>
        </Pressable>
        <Txt v="small">{tpl ? `${tpl.name} · ` : ''}{logMode === 'pr' ? t('train.modePr') : t('train.modeAll')}</Txt>

        {w.exercises.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 4 }}>
            <Txt v="title">{t('train.noExYet')}</Txt>
            <Txt v="muted" style={{ textAlign: 'center' }}>{t('train.noExHint')}</Txt>
          </Card>
        ) : w.exercises.map((we) => {
          const ex = exMap.get(we.exerciseId);
          if (!ex) return null;
          return (
            <ExerciseCard
              key={we.id} we={we} exercise={ex} workoutId={w.id}
              plan={tpl?.exercises.find((x) => x.exerciseId === we.exerciseId)}
              restElapsed={restElapsed} onLogged={onLogged} onEditSet={setEditing}
            />
          );
        })}
      </Screen>

      <WorkoutTypeSheet visible={typeOpen} onClose={() => setTypeOpen(false)} value={w.workoutType} onPick={(v) => repo.updateWorkout(w.id, { workoutType: v })} />
      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} workoutType={w.workoutType} excludeIds={existingIds} />
      <SetEditor set={editing} exercise={editing ? exMap.get(w.exercises.find((e) => e.id === editing.workoutExerciseId)?.exerciseId ?? '') : undefined} onClose={() => setEditing(null)} />
      <Sheet visible={tplOpen} onClose={() => setTplOpen(false)} title={t('train.loadTemplate')}>
        {templates.length ? templates.map((tp, i) => (
          <View key={tp.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={tp.name} subtitle={`${t(`wtype.${tp.workoutType}`)} · ${t('train.exCount', { n: tp.exercises.length })}`} onPress={() => loadTemplate(tp.id)} />
          </View>
        )) : <Txt v="muted">{t('train.noTemplates')}</Txt>}
      </Sheet>
    </>
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
