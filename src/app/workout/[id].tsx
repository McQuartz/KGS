import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { detectPRs } from '../../analysis';
import { SetRow } from '../../components/train/SetRow';
import { SetEditor } from '../../components/train/SetEditor';
import { setVolume, useExerciseMap } from '../../components/train/util';
import { Button, Card, Divider, Icon, IconButton, Screen, Txt } from '../../components/ui';
import * as repo from '../../db/repo';
import type { WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useTheme } from '../../theme';

export default function WorkoutDetail() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wid = String(id);
  const w = useQuery(() => repo.getWorkout(wid), [wid]);
  const exMap = useExerciseMap();
  const [editing, setEditing] = useState<WorkoutSet | null>(null);

  // exercises with records in this workout
  const prEx = useQuery(() => {
    const out = new Set<string>();
    if (!w) return out;
    for (const e of w.exercises) {
      const hit = detectPRs(repo.exerciseSessions(e.exerciseId)).find((s) => s.workoutId === wid);
      if (hit && hit.prs.length) out.add(e.exerciseId);
    }
    return out;
  }, [wid, w]);

  const allSets = useMemo(() => (w ? w.exercises.flatMap((e) => e.sets) : []), [w]);

  const del = () =>
    Alert.alert(t('train.deleteWorkout'), t('train.deleteWorkoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { repo.deleteWorkout(wid); router.back(); } },
    ]);

  if (!w) {
    return (
      <Screen title={t('train.workout')} left={<IconButton name="back" onPress={() => router.back()} />}>
        <Txt v="muted">{t('common.noData')}</Txt>
      </Screen>
    );
  }
  const mins = w.endedAt ? Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000)) : null;
  const vol = setVolume(allSets);
  const editEx = editing ? exMap.get(w.exercises.find((e) => e.id === editing.workoutExerciseId)?.exerciseId ?? '') : undefined;

  return (
    <>
      <Screen
        bar title={t(`wtype.${w.workoutType}`)}
        left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}
        footer={<Button kind="secondary" icon="trash" label={t('train.deleteWorkout')} onPress={del} />}
      >
        <Txt v="muted">
          {f.dateLong(w.startedAt)}{mins ? ` · ${mins} ${t('train.min')}` : ''}{vol > 0 ? ` · ${t('train.volume')} ${f.num(f.wToDisplay(vol), 0)} ${f.wUnit}` : ''}
        </Txt>
        {w.note ? <Txt v="muted">{w.note}</Txt> : null}
        {w.exercises.map((we) => {
          const ex = exMap.get(we.exerciseId);
          let n = 0;
          return (
            <Card key={we.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ flexShrink: 1 }}><Txt v="title" numberOfLines={1}>{f.exerciseName(ex)}</Txt></View>
                {prEx.has(we.exerciseId) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="star" size={15} color={th.c.accent} />
                    <Txt v="small" color={th.c.accent} style={{ fontFamily: th.font.semibold }}>PR</Txt>
                  </View>
                ) : null}
              </View>
              {we.note ? <Txt v="muted">{we.note}</Txt> : null}
              <View style={{ marginTop: 6 }}>
                {we.sets.map((s, i) => (
                  <View key={s.id}>
                    {i > 0 ? <Divider /> : null}
                    <SetRow set={s} index={s.isWarmup ? null : ++n} exercise={ex} onPress={() => setEditing(s)} />
                  </View>
                ))}
              </View>
            </Card>
          );
        })}
      </Screen>
      <SetEditor set={editing} exercise={editEx} onClose={() => setEditing(null)} />
    </>
  );
}
