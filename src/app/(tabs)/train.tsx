import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { WorkoutTypeSheet } from '../../components/train/WorkoutTypeSheet';
import { useExerciseMap } from '../../components/train/util';
import { Button, Card, Screen, Txt } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Template } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';

export default function Train() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const warmups = useSettings((s) => s.warmups);
  const exMap = useExerciseMap();
  const active = useQuery(() => repo.getActiveWorkout(), []);
  const templates = useQuery(() => repo.listTemplates(), []);
  const finished = useQuery(() => repo.listWorkouts(), []);
  const [typeOpen, setTypeOpen] = useState(false);

  const lastDone = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of finished) if (w.templateId && !m.has(w.templateId)) m.set(w.templateId, w.startedAt);
    return m;
  }, [finished]);

  const startTemplate = (tp: Template) => {
    if (active) { router.push('/workout/active'); return; }
    const id = repo.startWorkout(tp.workoutType, tp.id);
    tp.exercises.forEach((e) => repo.addWorkoutExercise(id, e.exerciseId));
    router.push('/workout/active');
  };

  const start = () => {
    if (active) router.push('/workout/active');
    else setTypeOpen(true);
  };

  return (
    <>
      <Screen
        title={t('tab.train')}
        footer={(
          <>
            <Button kind="ghost" icon="plus" label={t('train.newTemplate')} onPress={() => router.push('/template/new')} />
            <Button large label={active ? `${t('train.resume')} · ${t(`wtype.${active.workoutType}`)}` : t('train.start')} onPress={start} />
          </>
        )}
      >
        <Txt v="label">{t('train.templates')}</Txt>
        {templates.length ? templates.map((tp) => (
          <Card key={tp.id} onPress={() => router.push(`/template/${tp.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <View style={{ flexShrink: 1 }}><Txt v="title" numberOfLines={1}>{tp.name}</Txt></View>
              {lastDone.has(tp.id) ? <Txt v="xs">{t('train.lastDone')}: {f.dateWeekday(lastDone.get(tp.id) as number)}</Txt> : null}
            </View>
            <Text style={{ fontFamily: th.font.regular, fontSize: 13, color: th.c.muted, lineHeight: 18 }}>
              {tp.exercises.map((e, i) => (
                <Text key={e.exerciseId}>
                  {i > 0 ? ' · ' : ''}{f.exerciseName(exMap.get(e.exerciseId))}{' '}
                  <Text style={{ fontFamily: th.num.semibold, color: th.c.text }}>{warmups && e.warmupSets > 0 ? `${e.warmupSets}W+` : ''}{e.sets}</Text>
                </Text>
              ))}
            </Text>
            <Button kind="ghost" compact label={t('train.startShort')} onPress={() => startTemplate(tp)} style={{ alignSelf: 'flex-start' }} />
          </Card>
        )) : <Card><Txt v="muted">{t('train.noTemplates')}</Txt></Card>}
      </Screen>
      {typeOpen ? (
        <WorkoutTypeSheet
          visible onClose={() => setTypeOpen(false)} title={t('train.pickType')}
          onPick={(w) => { repo.startWorkout(w); router.push('/workout/active'); }}
        />
      ) : null}
    </>
  );
}
