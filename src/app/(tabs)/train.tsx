import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { WorkoutTypeSheet } from '../../components/train/WorkoutTypeSheet';
import { setVolume } from '../../components/train/util';
import { Button, Card, Divider, Icon, IconButton, Screen, SectionLabel, Txt } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Template, Workout } from '../../domain/types';
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
  const restSec = useSettings((s) => s.restSec);
  const active = useQuery(() => repo.getActiveWorkout(), []);
  const templates = useQuery(() => repo.listTemplates(), []);
  const recent = useQuery(() => repo.listWorkouts().slice(0, 10), []);
  const [typeOpen, setTypeOpen] = useState(false);

  const estMin = (tp: Template) => {
    const sec = tp.exercises.reduce((a, e) => a + (e.sets + e.warmupSets) * (40 + restSec), 0);
    return Math.max(5, Math.round(sec / 60 / 5) * 5);
  };

  const delTemplate = (tp: Template) =>
    Alert.alert(t('train.deleteTemplate'), t('train.deleteTemplateConfirm', { name: tp.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => repo.deleteTemplate(tp.id) },
    ]);
  const tplMenu = (tp: Template) =>
    Alert.alert(tp.name, undefined, [
      { text: t('common.edit'), onPress: () => router.push(`/template/${tp.id}`) },
      { text: t('common.delete'), style: 'destructive', onPress: () => delTemplate(tp) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const start = () => {
    if (active) router.push('/workout/active');
    else setTypeOpen(true);
  };

  const duration = (w: Workout) => (w.endedAt ? Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000)) : 0);

  return (
    <>
      <Screen
        title={t('tab.train')}
        footer={(
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} kind="secondary" icon="plus" label={t('train.newTemplate')} onPress={() => router.push('/template/new')} />
            <Button style={{ flex: 1.3 }} label={active ? t('train.resume') : t('train.start')} onPress={start} />
          </View>
        )}
      >
        {active ? (
          <Card onPress={() => router.push('/workout/active')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.c.accentSoft }}>
            <View style={{ flex: 1 }}>
              <Txt v="title" color={th.c.accent}>{t('train.resume')}</Txt>
              <Txt v="muted">
                {t(`wtype.${active.workoutType}`)} · {f.ago(active.startedAt)} {f.time(active.startedAt)} · {t('train.setCount', { n: active.exercises.reduce((a, e) => a + e.sets.length, 0) })}
              </Txt>
            </View>
            <Icon name="chev" size={18} color={th.c.accent} />
          </Card>
        ) : null}

        <SectionLabel>{t('train.templates')}</SectionLabel>
        {templates.length ? (
          <Card padded={false}>
            {templates.map((tp, i) => (
              <View key={tp.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => router.push(`/template/${tp.id}`)} onLongPress={() => delTemplate(tp)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{tp.name}</Txt>
                    <Txt v="small" numberOfLines={1}>
                      {t(`wtype.${tp.workoutType}`)} · {t('train.exCount', { n: tp.exercises.length })} · {t('train.estMin', { n: estMin(tp) })}
                    </Txt>
                  </View>
                  <IconButton name="more" size={20} onPress={() => tplMenu(tp)} accessibilityLabel={t('common.edit')} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Txt v="muted">{t('train.noTemplates')}</Txt></Card>
        )}

        <SectionLabel>{t('train.recent')}</SectionLabel>
        {recent.length ? (
          <Card padded={false}>
            {recent.map((w, i) => (
              <View key={w.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable onPress={() => router.push(`/workout/${w.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{t(`wtype.${w.workoutType}`)}</Txt>
                    <Txt v="small" numberOfLines={1}>
                      {f.dateWeekday(w.startedAt)} · {t('train.exCount', { n: w.exercises.length })} · {duration(w)} {t('train.min')}
                      {setVolume(w.exercises.flatMap((e) => e.sets)) > 0 ? ` · ${f.num(f.wToDisplay(setVolume(w.exercises.flatMap((e) => e.sets))), 0)} ${f.wUnit}` : ''}
                    </Txt>
                  </View>
                  <Icon name="chev" size={18} color={th.c.muted} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Txt v="muted">{t('train.noRecent')}</Txt></Card>
        )}
      </Screen>
      <WorkoutTypeSheet
        visible={typeOpen} onClose={() => setTypeOpen(false)} title={t('train.pickType')}
        onPick={(w) => { repo.startWorkout(w); router.push('/workout/active'); }}
      />
    </>
  );
}
