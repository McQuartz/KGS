import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { strengthScore } from '../../analysis';
import * as repo from '../../db/repo';
import type { Exercise, TemplateExercise, WorkoutExercise, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';
import { Button, Card, Chip, Icon, Txt } from '../ui';
import { SetEntrySheet, type EntryField } from './SetEntrySheet';
import { SetRow } from './SetRow';
import { StepRow } from './Stepper';
import { TextSheet } from './TextSheet';
import { exerciseBaseline, isCardio, lastTop, prSetIds, shortSetText, toDisplayWeight, workingSets } from './util';

interface Draft { w: number | null; r: number | null; dur: number | null; dist: number | null; warm: boolean; note: string | null }
interface Row { warm: boolean; w: number; r: number }

const EMPTY: Draft = { w: null, r: null, dur: null, dist: null, warm: false, note: null };

function draftFrom(s: WorkoutSet | undefined, f: ReturnType<typeof useFormat>, warm = false): Draft {
  if (!s) return { ...EMPTY, warm };
  return {
    w: toDisplayWeight(f, s.weight), r: s.reps, warm, note: null,
    dur: s.durationSec != null ? Math.round((s.durationSec / 60) * 10) / 10 : null,
    dist: s.distanceM != null ? Math.round((s.distanceM / 1000) * 100) / 100 : null,
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Value box of the mockup's set panel (.valbox): muted label above a large number; tap to edit. */
function ValBox({ label, text, unit, dim, onPress }: { label: string; text: string; unit?: string; dim?: boolean; onPress: () => void }) {
  const th = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4, borderRadius: th.rSm, backgroundColor: pressed ? th.c.accentSoft : th.c.surface, borderWidth: 1, borderColor: th.c.line })}>
      <Txt v="label">{label}</Txt>
      <Text numberOfLines={1}>
        <Text style={{ fontFamily: th.num.semibold, fontSize: 30, lineHeight: 36, color: dim ? th.c.muted : th.c.text, letterSpacing: -0.6 }}>{text}</Text>
        {unit ? <Text style={{ fontFamily: th.font.regular, fontSize: 14, color: th.c.muted }}> {unit}</Text> : null}
      </Text>
    </Pressable>
  );
}

/** One exercise of the active workout (mockup exCard): collapsed row, or expanded with set panel, set list and "Add set". */
export function ExerciseCard({ we, exercise, workoutId, plan, active, onActivate, restElapsed, onLogged, onEditSet, onRemoved, onComplete }: {
  we: WorkoutExercise; exercise: Exercise; workoutId: string; plan?: TemplateExercise;
  active: boolean; onActivate: () => void;
  /** seconds of rest taken so far (null if no rest running) */
  restElapsed: () => number | null;
  onLogged: () => void;
  onEditSet: (s: WorkoutSet) => void;
  onRemoved?: () => void;
  /** all planned sets of this exercise are logged */
  onComplete?: () => void;
}) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const prefill = useSettings((s) => s.prefill);
  const warmups = useSettings((s) => s.warmups);
  const logMode = useSettings((s) => s.logMode);
  const input = useSettings((s) => s.input);
  const stepperStep = useSettings((s) => s.stepperStep);
  const cardio = isCardio(exercise);
  const prMode = logMode === 'pr' && !cardio;

  // computed once per exercise (not re-queried on every set): last session and historical best
  const last = useMemo(() => repo.lastSetsFor(exercise.id, workoutId), [exercise.id, workoutId]);
  const base = useMemo(() => (active ? exerciseBaseline(exercise.id) : { has: false, maxWeight: 0, maxScore: 0 }), [active, exercise.id]);
  const lastWork = useMemo(() => workingSets(last), [last]);
  const sets = we.sets;
  const work = workingSets(sets);
  const warmLogged = sets.length - work.length;

  const [extra, setExtra] = useState(0);
  const target = !prMode && !cardio ? (plan ? plan.sets : 0) + extra : 0;

  const warmRow = (i: number): Row => {
    const top = lastWork.length ? Math.max(...lastWork.map((s) => s.weight)) : 40;
    const frac = i === 0 ? 0.5 : 0.75;
    return { warm: true, w: toDisplayWeight(f, Math.round((top * frac) / 2.5) * 2.5), r: i === 0 ? 10 : 5 };
  };
  const workRow = (i: number): Row => {
    const src = lastWork[i] ?? lastWork[lastWork.length - 1];
    return src ? { warm: false, w: toDisplayWeight(f, src.weight), r: src.reps } : { warm: false, w: toDisplayWeight(f, 20), r: 10 };
  };
  const warmTarget = plan && warmups && !cardio && !prMode ? plan.warmupSets : 0;
  const pendingRows = (wl: number, kl: number): Row[] => {
    const out: Row[] = [];
    for (let i = wl; i < warmTarget; i++) out.push(warmRow(i));
    for (let i = kl; i < target; i++) out.push(workRow(i));
    return out;
  };
  const pending = pendingRows(warmLogged, work.length);

  const [draft, setDraft] = useState<Draft>(() => {
    const nx = pending[0];
    if (nx) return prefill ? { ...EMPTY, w: nx.w, r: nx.r, warm: nx.warm } : { ...EMPTY, warm: nx.warm };
    const inSession = [...sets].reverse().find((s) => !s.isWarmup) ?? sets[sets.length - 1];
    if (inSession) return draftFrom(inSession, f);
    if (prefill && lastWork.length) {
      const src = prMode ? lastWork.reduce((a, s) => (s.weight > a.weight ? s : a), lastWork[0]) : lastWork[0];
      return draftFrom(src, f);
    }
    return EMPTY;
  });
  const [noteOpen, setNoteOpen] = useState(false);
  const [exNoteOpen, setExNoteOpen] = useState(false);
  const [edit, setEdit] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const prIds = useMemo(() => prSetIds(sets, base), [sets, base]);
  const lastText = lastTop(last, exercise, f, t);
  const valid = cardio ? (draft.dur ?? 0) > 0 : (draft.r ?? 0) > 0;
  const hasPR = prIds.size > 0;

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
        repo.addSet(we.id, { weight, reps, restSec: null, isWarmup: false, note: draft.note, durationSec: null, distanceM: null });
      }
      setDraft((d) => ({ ...d, note: null }));
      return;
    }
    const warmNow = !cardio && draft.warm;
    repo.addSet(we.id, {
      weight, reps, restSec: restElapsed(), isWarmup: warmNow, note: draft.note,
      durationSec: cardio ? Math.round((draft.dur ?? 0) * 60) : null,
      distanceM: cardio && draft.dist ? Math.round(draft.dist * 1000) : null,
    });
    // next draft: planned row, else the matching set of last session, else keep values
    const wl = warmLogged + (warmNow ? 1 : 0);
    const kl = work.length + (warmNow ? 0 : 1);
    const nx = pendingRows(wl, kl)[0];
    setDraft((d) => {
      if (nx) return prefill ? { ...EMPTY, w: nx.w, r: nx.r, warm: nx.warm } : { ...d, warm: nx.warm, note: null };
      if (prefill && !cardio && lastWork[kl]) return { ...draftFrom(lastWork[kl], f), warm: plan ? false : d.warm };
      return { ...d, warm: plan ? false : d.warm, note: null };
    });
    onLogged();
    if (target > 0 && kl >= target && wl >= warmTarget) onComplete?.();
  };

  const menu = () => {
    Alert.alert(f.exerciseName(exercise), undefined, [
      { text: t('train.exerciseNote'), onPress: () => setExNoteOpen(true) },
      { text: t('train.removeExercise'), style: 'destructive', onPress: () => {
        Alert.alert(t('train.removeExercise'), t('train.removeExerciseConfirm', { name: f.exerciseName(exercise) }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: () => { repo.removeWorkoutExercise(we.id); onRemoved?.(); } },
        ]);
      } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const count = prMode ? `${work.length ? 1 : 0}/1` : target > 0 ? `${work.length}/${target}` : t('train.setCount', { n: work.length });
  const header = (right: React.ReactNode) => (
    <Pressable onLongPress={menu} onPress={active ? undefined : onActivate} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flexShrink: 1 }}><Txt style={{ fontFamily: th.font.semibold, fontSize: 16 }} numberOfLines={1}>{f.exerciseName(exercise)}</Txt></View>
          {hasPR ? <Icon name="star" size={15} color={th.c.accent} /> : null}
        </View>
        <Txt v="xs" numberOfLines={1}>{t('train.last')}: {lastText ?? '–'}</Txt>
      </View>
      <Txt v="num" color={th.c.muted} style={{ fontSize: 13 }}>{count}</Txt>
      {right}
    </Pressable>
  );

  if (!active) {
    return <Card>{header(<Icon name="chev" size={18} color={th.c.text} />)}</Card>;
  }

  // ----- set panel -----
  const nextRow = pending[0];
  const label = prMode ? t('train.todaysBest')
    : draft.warm ? t('train.warmup')
      : target > 0 && work.length < target ? t('train.setOf', { n: work.length + 1, m: target })
        : t('train.setN', { n: work.length + 1 });
  const lt = !nextRow && !draft.warm && !prMode && lastWork[work.length] ? lastWork[work.length] : null;
  const ph = prefill && lastWork.length ? draftFrom(lastWork[Math.min(work.length, lastWork.length - 1)], f) : null;
  const imp = f.imperial;
  const wField: EntryField = { key: 'w', label: t('train.weight'), value: draft.w ?? ph?.w ?? 0, unit: f.wUnit, decimals: imp ? 0 : 1, step: imp ? undefined : 0.5, min: 0, max: imp ? 700 : 320 };
  const rField: EntryField = { key: 'r', label: t('train.reps'), value: draft.r ?? ph?.r ?? 0, decimals: 0, min: 0, max: 99 };
  const dField: EntryField = { key: 'dur', label: t('train.duration'), value: draft.dur ?? ph?.dur ?? 0, unit: t('train.min'), decimals: 1, step: 0.5, min: 0, max: 600 };
  const kField: EntryField = { key: 'dist', label: t('train.distance'), value: draft.dist ?? ph?.dist ?? 0, unit: 'km', decimals: 2, step: 0.05, min: 0, max: 500 };
  const fields = cardio ? [dField, kField] : [wField, rField];
  const txt = (v: number | null, p: number | null | undefined, d: number) => (v != null ? f.num(v, d) : p != null ? f.num(p, d) : '–');
  const sm = stepperStep;
  const nudgeW = (d: number) => setDraft((x) => ({ ...x, w: Math.max(0, round2((x.w ?? ph?.w ?? 0) + d)) }));
  const nudgeR = (d: number) => setDraft((x) => ({ ...x, r: Math.max(0, Math.min(99, (x.r ?? ph?.r ?? 0) + d)) }));
  const smLabel = (n: number) => f.numSmart(n, 1);

  const entry = (() => {
    if (cardio) {
      return (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ValBox label={t('train.duration')} text={txt(draft.dur, ph?.dur, 1)} unit={t('train.min')} dim={draft.dur == null} onPress={() => setEdit(0)} />
          <ValBox label={t('train.distance')} text={txt(draft.dist, ph?.dist, 2)} unit="km" dim={draft.dist == null} onPress={() => setEdit(1)} />
        </View>
      );
    }
    if (input === 'stepper') {
      const valText = (big: string, unit: string, dim: boolean, onPress: () => void) => (
        <Pressable onPress={onPress} style={{ height: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          <Text style={{ fontFamily: th.num.semibold, fontSize: 28, color: dim ? th.c.muted : th.c.text, letterSpacing: -0.5 }}>{big}</Text>
          <Text style={{ fontFamily: th.font.regular, fontSize: 12, color: th.c.muted }}> {unit}</Text>
        </Pressable>
      );
      return (
        <View style={{ gap: 8 }}>
          <StepRow
            steps={[{ label: '−10', onStep: () => nudgeW(-10) }, { label: `−${smLabel(sm)}`, onStep: () => nudgeW(-sm) }, { label: `+${smLabel(sm)}`, onStep: () => nudgeW(sm) }, { label: '+10', onStep: () => nudgeW(10) }]}
            center={valText(txt(draft.w, ph?.w, imp ? 0 : 1), f.wUnit, draft.w == null, () => setEdit(0))}
          />
          <StepRow
            steps={[{ label: '−1', onStep: () => nudgeR(-1) }, { label: '+1', onStep: () => nudgeR(1) }]}
            center={valText(txt(draft.r, ph?.r, 0), t('train.reps').toLowerCase(), draft.r == null, () => setEdit(1))}
          />
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ValBox label={t('train.weight')} text={txt(draft.w, ph?.w, imp ? 0 : 1)} unit={f.wUnit} dim={draft.w == null} onPress={() => setEdit(0)} />
        <Text style={{ color: th.c.muted, fontSize: 18 }}>×</Text>
        <ValBox label={t('train.reps').toLowerCase()} text={txt(draft.r, ph?.r, 0)} dim={draft.r == null} onPress={() => setEdit(1)} />
      </View>
    );
  })();

  const applyEdit = (v: number[]) => {
    setDraft((d) => (cardio ? { ...d, dur: v[0], dist: v[1] > 0 ? v[1] : null } : { ...d, w: v[0], r: v[1] }));
    setEdit(null);
  };

  let idx = 0;
  return (
    <Card>
      {header(
        <Pressable hitSlop={8} onPress={() => router.push(`/exercise/${exercise.id}`)} accessibilityLabel={t('train.details')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="info" size={18} color={th.c.text} />
        </Pressable>,
      )}
      {we.note ? <Txt v="muted">{we.note}</Txt> : null}

      <View style={{ backgroundColor: th.c.surface2, borderRadius: th.rSm, padding: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Txt v="label">{label}</Txt>
          {warmups && !prMode && !cardio ? <View style={{ transform: [{ scale: 0.92 }] }}><Chip label={t('train.warmup')} on={draft.warm} onPress={() => setDraft((d) => ({ ...d, warm: !d.warm }))} /></View> : null}
          {lt && !draft.warm ? <Txt v="xs">{t('train.lastTime')} {shortSetText(lt, exercise, f, t)}</Txt> : null}
        </View>
        {draft.warm && warmups && !prMode ? <Txt v="xs" style={{ marginTop: -6 }}>{t('train.warmupNote')}</Txt> : null}
        {entry}
        {msg ? <Txt v="small" color={th.c.warn}>{msg}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => setNoteOpen(true)} accessibilityLabel={t('train.note')} style={({ pressed }) => ({ height: 44, paddingHorizontal: 16, borderRadius: th.rSm, borderWidth: 1, borderColor: th.c.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: pressed ? th.c.surface : 'transparent' })}>
            <Icon name="note" size={18} color={th.c.text} />
            {draft.note ? <Txt style={{ fontFamily: th.font.semibold }}>•</Txt> : null}
          </Pressable>
          <Button
            style={{ flex: 1 }} icon="check" onPress={log} disabled={!valid}
            label={prMode ? (work.length ? t('train.updateBest') : t('train.logBest')) : t('train.logSet')}
          />
        </View>
      </View>

      {prMode ? (
        work.length ? <SetRow index="★" set={work[0]} exercise={exercise} cur onPress={() => onEditSet(work[0])} /> : null
      ) : (
        <View style={{ gap: 2 }}>
          {sets.map((s) => (
            <SetRow key={s.id} set={s} index={s.isWarmup ? 'W' : ++idx} exercise={exercise} isPR={prIds.has(s.id)} onPress={() => onEditSet(s)} />
          ))}
          {pending.map((r, i) => (
            <SetRow
              key={`p${i}`} index={r.warm ? 'W' : work.length + 1 + (i - Math.max(0, warmTarget - warmLogged))} pending cur={i === 0}
              text={shortSetText({ weight: f.wFromDisplay(r.w), reps: r.r, durationSec: null, distanceM: null }, exercise, f, t)}
            />
          ))}
        </View>
      )}

      {!prMode && !cardio ? (
        <Button kind="ghost" compact icon="plus" label={t('train.addSet')} onPress={() => setExtra((n) => n + 1)} />
      ) : null}

      {edit !== null ? (
        <SetEntrySheet
          title={f.exerciseName(exercise)} fields={fields} startIndex={edit} mode={input === 'wheel' ? 'wheel' : 'pad'}
          onCancel={() => setEdit(null)} onDone={applyEdit}
        />
      ) : null}
      <TextSheet visible={noteOpen} onClose={() => setNoteOpen(false)} title={t('train.note')} value={draft.note} tags onSave={(v) => setDraft((d) => ({ ...d, note: v }))} />
      <TextSheet visible={exNoteOpen} onClose={() => setExNoteOpen(false)} title={t('train.exerciseNote')} value={we.note} onSave={(v) => repo.updateWorkoutExerciseNote(we.id, v)} />
    </Card>
  );
}
