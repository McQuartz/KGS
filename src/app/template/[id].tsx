import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { ExercisePicker } from '../../components/train/ExercisePicker';
import { useExerciseMap } from '../../components/train/util';
import { NumberField } from '../../components/input';
import { Button, Card, Chip, IconButton, Screen, SectionLabel, Txt } from '../../components/ui';
import * as repo from '../../db/repo';
import { WORKOUT_TYPES } from '../../domain/catalog';
import type { Exercise, TemplateExercise, WorkoutType } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';

export default function TemplateEditor() {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const warmups = useSettings((s) => s.warmups);
  const exMap = useExerciseMap();
  const [init] = useState(() => (isNew ? null : repo.getTemplate(String(id))));
  const [name, setName] = useState(init?.name ?? '');
  const [type, setType] = useState<WorkoutType>(init?.workoutType ?? 'other');
  const [items, setItems] = useState<TemplateExercise[]>(init?.exercises ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const patch = (i: number, p: Partial<TemplateExercise>) => setItems((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setItems((a) => {
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    const b = [...a];
    [b[i], b[j]] = [b[j], b[i]];
    return b;
  });
  const add = (e: Exercise) => setItems((a) => (a.some((x) => x.exerciseId === e.id) ? a : [...a, { exerciseId: e.id, sets: 3, warmupSets: 0 }]));

  const save = () => {
    repo.saveTemplate({
      id: init?.id, name: name.trim() || t(`wtype.${type}`), workoutType: type,
      exercises: items,
    });
    router.back();
  };
  const del = () => {
    if (!init) return;
    Alert.alert(t('train.deleteTemplate'), t('train.deleteTemplateConfirm', { name: init.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { repo.deleteTemplate(init.id); router.back(); } },
    ]);
  };

  return (
    <>
      <Screen
        bar title={isNew ? t('train.newTemplate') : t('train.editTemplate')}
        left={<IconButton name="back" onPress={() => router.back()} accessibilityLabel={t('common.back')} />}
        footer={(
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {init ? <Button kind="secondary" icon="trash" label={t('common.delete')} onPress={del} /> : null}
            <Button style={{ flex: 1 }} label={t('common.save')} onPress={save} disabled={!items.length} />
          </View>
        )}
      >
        <TextInput
          value={name} onChangeText={setName} placeholder={t('train.templateName')} placeholderTextColor={th.c.muted}
          style={{ height: 48, borderRadius: th.rSm, backgroundColor: th.c.surface, borderWidth: 1, borderColor: th.c.line, paddingHorizontal: 14, color: th.c.text, fontFamily: th.font.medium, fontSize: 16 }}
        />
        <SectionLabel>{t('train.workoutType')}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WORKOUT_TYPES.map((w) => <Chip key={w} label={t(`wtype.${w}`)} on={w === type} onPress={() => setType(w)} />)}
        </View>
        <SectionLabel>{t('train.exercises')}</SectionLabel>
        {items.map((x, i) => (
          <Card key={x.exerciseId} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Txt v="title" numberOfLines={1}>{f.exerciseName(exMap.get(x.exerciseId))}</Txt></View>
              <IconButton name="up" size={20} onPress={() => move(i, -1)} accessibilityLabel={t('train.moveUp')} />
              <IconButton name="down" size={20} onPress={() => move(i, 1)} accessibilityLabel={t('train.moveDown')} />
              <IconButton name="trash" size={20} onPress={() => setItems((a) => a.filter((_, j) => j !== i))} accessibilityLabel={t('common.delete')} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><NumberField label={t('train.setsCount')} value={x.sets} onChange={(v) => patch(i, { sets: Math.max(1, Math.round(v)) })} decimals={0} min={1} max={20} step={1} /></View>
              {warmups ? <View style={{ flex: 1 }}><NumberField label={t('train.warmupCount')} value={x.warmupSets} onChange={(v) => patch(i, { warmupSets: Math.max(0, Math.round(v)) })} decimals={0} min={0} max={10} step={1} /></View> : null}
            </View>
          </Card>
        ))}
        <Button kind="secondary" icon="plus" label={t('train.addExercise')} onPress={() => setPickerOpen(true)} />
      </Screen>
      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={add} workoutType={type} excludeIds={items.map((x) => x.exerciseId)} />
    </>
  );
}
