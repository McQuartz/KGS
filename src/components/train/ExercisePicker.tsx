import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import * as repo from '../../db/repo';
import { MUSCLE_GROUPS, WORKOUT_TYPE_GROUPS } from '../../domain/catalog';
import type { Exercise, ExerciseType, ID, MuscleGroup, WorkoutType } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useTheme } from '../../theme';
import { Button, Chip, Divider, Segmented, Sheet, Txt } from '../ui';

/** Reusable exercise picker sheet: search, muscle-group chips (workout type's groups first), custom exercise creation. */
export function ExercisePicker({ visible, onClose, onPick, workoutType, excludeIds }: {
  visible: boolean; onClose: () => void; onPick: (e: Exercise) => void; workoutType?: WorkoutType; excludeIds?: ID[];
}) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const all = useQuery(() => repo.listExercises(), []);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [mg, setMg] = useState<MuscleGroup>('chest');
  const [type, setType] = useState<ExerciseType>('strength');

  const prio = workoutType ? WORKOUT_TYPE_GROUPS[workoutType] : [];
  const groups = useMemo(() => [...prio, ...MUSCLE_GROUPS.filter((g) => !prio.includes(g))], [prio]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const rank = (g: MuscleGroup) => { const i = prio.indexOf(g); return i < 0 ? 99 : i; };
    return all
      .filter((e) => !(excludeIds ?? []).includes(e.id))
      .filter((e) => group === 'all' || e.muscleGroup === group)
      .filter((e) => !ql || f.exerciseName(e).toLowerCase().includes(ql))
      .map((e) => ({ e, n: f.exerciseName(e) }))
      .sort((a, b) => rank(a.e.muscleGroup) - rank(b.e.muscleGroup) || a.n.localeCompare(b.n))
      .map((x) => x.e);
  }, [all, q, group, prio, excludeIds, f]);

  const close = () => { setCreating(false); setQ(''); onClose(); };
  const pick = (e: Exercise) => { onPick(e); close(); };
  const create = () => {
    const n = name.trim();
    if (!n) return;
    const e = repo.createExercise(n, type === 'cardio' ? 'cardio' : mg, type);
    setName('');
    pick(e);
  };

  const input = {
    height: 44, borderRadius: th.rSm, backgroundColor: th.c.surface2, paddingHorizontal: 12, color: th.c.text, fontFamily: th.font.regular, fontSize: 15,
  } as const;

  return (
    <Sheet visible={visible} onClose={close} title={creating ? t('train.newExercise') : t('train.addExercise')}>
      {creating ? (
        <>
          <TextInput value={name} onChangeText={setName} placeholder={t('train.exerciseName')} placeholderTextColor={th.c.muted} style={input} autoFocus />
          <Segmented<ExerciseType>
            value={type} onChange={setType}
            options={[{ value: 'strength', label: t('train.typeStrength') }, { value: 'cardio', label: t('train.typeCardio') }]}
          />
          {type === 'strength' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MUSCLE_GROUPS.filter((g) => g !== 'cardio').map((g) => <Chip key={g} label={t(`muscle.${g}`)} on={g === mg} onPress={() => setMg(g)} />)}
            </View>
          ) : null}
          <Button label={t('train.createExercise')} onPress={create} disabled={!name.trim()} />
          <Button label={t('common.cancel')} kind="ghost" onPress={() => setCreating(false)} />
        </>
      ) : (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder={t('common.search')} placeholderTextColor={th.c.muted} style={input} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            <Chip label={t('train.all')} on={group === 'all'} onPress={() => setGroup('all')} />
            {groups.map((g) => <Chip key={g} label={t(`muscle.${g}`)} on={g === group} onPress={() => setGroup(g)} />)}
          </ScrollView>
          <View>
            {list.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable onPress={() => pick(e)} style={({ pressed }) => ({ paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
                  <Txt>{f.exerciseName(e)}</Txt>
                  <Txt v="small">{t(`muscle.${e.muscleGroup}`)}</Txt>
                </Pressable>
              </View>
            ))}
            {!list.length ? <Txt v="muted">{t('train.noExercises')}</Txt> : null}
          </View>
          <Button label={t('train.createCustom')} kind="secondary" icon="plus" onPress={() => { setName(q.trim()); setCreating(true); }} />
        </>
      )}
    </Sheet>
  );
}
