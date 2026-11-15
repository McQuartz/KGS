import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { MUSCLE_GROUPS } from '../../domain/catalog';
import type { Exercise, Metric, MuscleGroup } from '../../domain/types';
import * as repo from '../../db/repo';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { useTheme } from '../../theme';
import { Button, Chip, Icon, ListRow, Segmented, Sheet, Txt } from '../ui';
import { Field, Group, SwitchRow } from './parts';

function TextField({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.c.muted}
      style={{ height: 46, borderRadius: t.rSm, backgroundColor: t.c.surface2, paddingHorizontal: 12, color: t.c.text, fontFamily: t.font.regular, fontSize: 16 }}
    />
  );
}

export function MetricSheet({ metric, onClose }: { metric: Metric | 'new' | null; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const isNew = metric === 'new';
  const m = metric && metric !== 'new' ? metric : null;
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [dec, setDec] = useState('1');
  const [lower, setLower] = useState(false);
  const [arch, setArch] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const cur = m ? m.id : isNew ? 'new' : null;
  if (cur !== key) {
    setKey(cur);
    setName(m ? (m.builtin ? f.metricName(m) : m.name) : '');
    setUnit(m?.unit ?? '');
    setDec(String(m?.decimals ?? 1));
    setLower(m?.lowerIsBetter ?? false);
    setArch(m?.archived ?? false);
  }
  const custom = isNew || (m !== null && !m.builtin);
  const valid = !custom || name.trim().length > 0;
  const save = () => {
    if (!valid) return;
    if (isNew) repo.createCustomMetric(name.trim(), unit.trim(), Number(dec), lower);
    else if (m) {
      repo.updateMetric(m.id, m.builtin ? { archived: arch } : { name: name.trim(), unit: unit.trim(), decimals: Number(dec), lowerIsBetter: lower, archived: arch });
    }
    onClose();
  };
  const del = () => {
    if (!m) return;
    Alert.alert(t('set.metrics.deleteTitle', { name: m.name }), t('set.metrics.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { repo.deleteMetric(m.id); onClose(); } },
    ]);
  };
  return (
    <Sheet
      visible={metric !== null}
      onClose={onClose}
      title={isNew ? t('set.metrics.new') : m?.builtin ? f.metricName(m) : t('set.metrics.edit')}
      footer={<Button label={t('common.save')} onPress={save} disabled={!valid} />}
    >
      {custom ? (
        <>
          <Field title={t('set.metrics.name')}><TextField value={name} onChange={setName} /></Field>
          <Field title={t('set.metrics.unit')}><TextField value={unit} onChange={setUnit} /></Field>
          <Field title={t('set.metrics.decimals')}>
            <Segmented value={dec} onChange={setDec} options={[{ value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' }]} />
          </Field>
          <SwitchRow title={t('set.metrics.lower')} value={lower} onChange={setLower} />
        </>
      ) : (
        <Txt v="small">{t('set.metrics.builtinCap')}</Txt>
      )}
      {!isNew ? <SwitchRow title={t('set.metrics.archived')} value={arch} onChange={setArch} /> : null}
      {m && !m.builtin ? <Button kind="danger" label={t('common.delete')} icon="trash" onPress={del} /> : null}
    </Sheet>
  );
}

function ExerciseSheet({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('chest');
  const [arch, setArch] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  if ((exercise?.id ?? null) !== key) {
    setKey(exercise?.id ?? null);
    if (exercise) { setName(exercise.name); setGroup(exercise.muscleGroup); setArch(exercise.archived); }
  }
  const save = () => {
    if (!exercise || !name.trim()) return;
    repo.updateExercise(exercise.id, { name: name.trim(), muscleGroup: group, archived: arch });
    onClose();
  };
  return (
    <Sheet visible={exercise !== null} onClose={onClose} title={t('set.exercises.edit')} footer={<Button label={t('common.save')} onPress={save} disabled={!name.trim()} />}>
      <Field title={t('set.metrics.name')}><TextField value={name} onChange={setName} /></Field>
      <Field title={t('set.exercises.group')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MUSCLE_GROUPS.map((g) => <Chip key={g} label={t(`muscle.${g}`)} on={g === group} onPress={() => setGroup(g)} />)}
        </View>
      </Field>
      <SwitchRow title={t('set.exercises.archived')} value={arch} onChange={setArch} />
    </Sheet>
  );
}

export function ManageSection() {
  const t = useT();
  const f = useFormat();
  const c = useTheme().c;
  const metrics = useQuery(() => repo.listMetrics(true));
  const custom = useQuery(() => repo.listExercises(true).filter((e) => !e.builtin));
  const [metric, setMetric] = useState<Metric | 'new' | null>(null);
  const [ex, setEx] = useState<Exercise | null>(null);
  return (
    <>
      <Group label={t('set.body')}>
        {metrics.map((m) => (
          <ListRow
            key={m.id}
            title={f.metricName(m)}
            subtitle={[m.builtin ? null : f.metricUnit(m) || null, m.archived ? t('set.metrics.hiddenTag') : null].filter(Boolean).join(' · ') || undefined}
            onPress={() => setMetric(m)}
          />
        ))}
        <Pressable onPress={() => setMetric('new')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
          <Icon name="plus" size={16} color={c.accent} />
          <Txt color={c.accent} style={{ fontSize: 13, lineHeight: 19 }}>{t('set.metrics.add')}</Txt>
        </Pressable>
        <View style={{ paddingVertical: 12, gap: 6 }}>
          <Txt v="label">{t('set.exercises')}</Txt>
          {custom.length === 0 ? <Txt v="xs" style={{ lineHeight: 17 }}>{t('set.exercises.empty')}</Txt> : null}
        </View>
        {custom.map((e) => (
          <ListRow key={e.id} title={e.name} subtitle={[t(`muscle.${e.muscleGroup}`), e.archived ? t('set.metrics.hiddenTag') : null].filter(Boolean).join(' · ')} onPress={() => setEx(e)} />
        ))}
      </Group>
      <MetricSheet metric={metric} onClose={() => setMetric(null)} />
      <ExerciseSheet exercise={ex} onClose={() => setEx(null)} />
    </>
  );
}
