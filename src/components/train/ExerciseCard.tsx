import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { strengthScore } from '../../analysis';
import * as repo from '../../db/repo';
import type { Exercise, TemplateExercise, WorkoutExercise, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';
import { NumberField } from '../input';
import { Button, Card, Chip, Divider, Icon, IconButton, Txt } from '../ui';
import { SetRow } from './SetRow';
import { TextSheet } from './TextSheet';
import { exerciseBaseline, isCardio, lastSummary, prSetIds, toDisplayWeight, workingSets } from './util';

interface Draft { w: number | null; r: number | null; dur: number | null; dist: number | null; warm: boolean }

function draftFrom(s: WorkoutSet | undefined, f: ReturnType<typeof useFormat>, warm = false): Draft {
  if (!s) return { w: null, r: null, dur: null, dist: null, warm };
  return {
    w: toDisplayWeight(f, s.weight), r: s.reps, warm,
    dur: s.durationSec != null ? Math.round((s.durationSec / 60) * 10) / 10 : null,
    dist: s.distanceM != null ? Math.round((s.distanceM / 1000) * 100) / 100 : null,
  };
}

/** One exercise of the active workout: header, logged sets, and the entry row for the next set. */
export function ExerciseCard({ we, exercise, workoutId, plan, restElapsed, onLogged, onEditSet, onRemoved }: {
  we: WorkoutExercise; exercise: Exercise; workoutId: string; plan?: TemplateExercise;
  /** seconds of rest taken so far (null if no rest running) */
  restElapsed: () => number | null;
  onLogged: () => void;
  onEditSet: (s: WorkoutSet) => void;
  onRemoved?: () => void;
}) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const prefill = useSettings((s) => s.prefill);
  const warmups = useSettings((s) => s.warmups);
  const logMode = useSettings((s) => s.logMode);
  const cardio = isCardio(exercise);
  const prMode = logMode === 'pr' && !cardio;
  const last = useQuery(() => repo.lastSetsFor(exercise.id, workoutId), [exercise.id, workoutId]);
  const base = useQuery(() => exerciseBaseline(exercise.id), [exercise.id]);
  const lastWork = workingSets(last);
  const sets = we.sets;
  const work = workingSets(sets);

  const [draft, setDraft] = useState<Draft>(() => {
    const inSession = [...sets].reverse().find((s) => !s.isWarmup) ?? sets[sets.length - 1];
    if (inSession) return draftFrom(inSession, f);
    if (prefill && lastWork.length) {
      const src = prMode ? lastWork.reduce((a, s) => (s.weight > a.weight ? s : a), lastWork[0]) : lastWork[0];
      return draftFrom(src, f);
    }
    return draftFrom(undefined, f);
  });
  const [noteOpen, setNoteOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const prIds = useMemo(() => prSetIds(sets, base), [sets, base]);
  const lastText = lastSummary(last, exercise, f, t);
  const ph = prefill && lastWork.length ? draftFrom(lastWork[Math.min(work.length, lastWork.length - 1)], f) : null;

  const valid = cardio ? (draft.dur ?? 0) > 0 : (draft.r ?? 0) > 0;

  const log = () => {
    setMsg(null);
    const weight = cardio ? 0 : f.wFromDisplay(draft.w ?? 0);
    const reps = cardio ? 0 : Math.round(draft.r ?? 0);
    if (prMode) {
      const cur = work[0];
      if (cur) {
        const better = weight > cur.weight || strengthScore(weight, reps) > strengthScore(cur.weight, cur.reps) * 1.0001;
        if (!better) { setMsg(t('train.notBetter')); return; }
        repo.updateSet(cur.id, { weight, reps });
      } else {
        repo.addSet(we.id, { weight, reps, restSec: null, isWarmup: false, note: null, durationSec: null, distanceM: null });
      }
      return;
    }
    const rest = restElapsed();
    repo.addSet(we.id, {
      weight, reps, restSec: rest, isWarmup: !cardio && draft.warm, note: null,
      durationSec: cardio ? Math.round((draft.dur ?? 0) * 60) : null,
      distanceM: cardio && draft.dist ? Math.round(draft.dist * 1000) : null,
    });
    // next set: prefill from last session's matching set when available
    if (prefill && !draft.warm && !cardio) {
      const nx = lastWork[work.length + 1];
      if (nx) setDraft((d) => ({ ...draftFrom(nx, f), warm: d.warm }));
    }
    onLogged();
  };

  const menu = () => {
    Alert.alert(f.exerciseName(exercise), undefined, [
      { text: t('train.exerciseNote'), onPress: () => setNoteOpen(true) },
      { text: t('train.removeExercise'), style: 'destructive', onPress: () => {
        Alert.alert(t('train.removeExercise'), t('train.removeExerciseConfirm', { name: f.exerciseName(exercise) }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: () => { repo.removeWorkoutExercise(we.id); onRemoved?.(); } },
        ]);
      } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const target = plan ? plan.sets : 0;
  const count = prMode ? `${work.length ? 1 : 0}/1` : target ? `${work.length}/${target}` : `${work.length}`;
  const label = prMode ? t('train.todaysBest') : draft.warm ? t('train.warmup') : t('train.setN', { n: work.length + 1 });
  const hasPR = prIds.size > 0;
  let idx = 0;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flexShrink: 1 }}><Txt v="title" numberOfLines={1}>{f.exerciseName(exercise)}</Txt></View>
            {hasPR ? <Icon name="star" size={16} color={th.c.accent} /> : null}
          </View>
          <Txt v="small">{t('train.last')}: {lastText ?? '–'}</Txt>
        </View>
        <Txt v="num" color={th.c.muted}>{count}</Txt>
        <IconButton name="more" size={20} onPress={menu} accessibilityLabel={t('common.edit')} />
      </View>
      {we.note ? <Txt v="muted" style={{ marginTop: 4 }}>{we.note}</Txt> : null}
      {plan && warmups && plan.warmupSets > 0 && !sets.some((s) => s.isWarmup) ? (
        <Txt v="small" style={{ marginTop: 4 }}>{t('train.planWarmups', { n: plan.warmupSets })}</Txt>
      ) : null}

      {sets.length ? (
        <View style={{ marginTop: 6 }}>
          {sets.map((s, i) => (
            <View key={s.id}>
              {i > 0 ? <Divider /> : null}
              <SetRow set={s} index={s.isWarmup ? null : ++idx} exercise={exercise} isPR={prIds.has(s.id)} onPress={() => onEditSet(s)} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 10, padding: 12, borderRadius: th.rSm, backgroundColor: th.c.surface2, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><Txt v="label">{label}</Txt></View>
          {warmups && !prMode && !cardio ? <Chip label={t('train.warmup')} on={draft.warm} onPress={() => setDraft({ ...draft, warm: !draft.warm })} /> : null}
        </View>
        {prMode ? <Txt v="small">{t('train.prHint')}</Txt> : null}
        {draft.warm ? <Txt v="small">{t('train.warmupNote')}</Txt> : null}
        {cardio ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><NumberField label={t('train.duration')} unit={t('train.min')} value={draft.dur} onChange={(v) => setDraft({ ...draft, dur: v })} decimals={1} min={0} placeholder={ph?.dur ?? null} /></View>
            <View style={{ flex: 1 }}><NumberField label={t('train.distance')} unit="km" value={draft.dist} onChange={(v) => setDraft({ ...draft, dist: v })} decimals={2} min={0} placeholder={ph?.dist ?? null} /></View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><NumberField label={t('train.weight')} unit={f.wUnit} value={draft.w} onChange={(v) => setDraft({ ...draft, w: v })} decimals={1} min={0} placeholder={ph?.w ?? null} /></View>
            <View style={{ flex: 1 }}><NumberField label={t('train.reps')} value={draft.r} onChange={(v) => setDraft({ ...draft, r: v })} decimals={0} min={0} placeholder={ph?.r ?? null} /></View>
          </View>
        )}
        {msg ? <Txt v="small" color={th.c.warn}>{msg}</Txt> : null}
        <Button
          label={prMode ? (work.length ? t('train.updateBest') : t('train.logBest')) : t('train.logSet')}
          icon="check" onPress={log} disabled={!valid}
        />
      </View>
      <TextSheet visible={noteOpen} onClose={() => setNoteOpen(false)} title={t('train.exerciseNote')} value={we.note} onSave={(v) => repo.updateWorkoutExerciseNote(we.id, v)} />
    </Card>
  );
}
