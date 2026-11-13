import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import * as repo from '../../db/repo';
import type { Exercise, WorkoutSet } from '../../domain/types';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme';
import { NumberField } from '../input';
import { Button, Chip, Sheet, Txt } from '../ui';
import { isCardio, toDisplayWeight } from './util';

/** Sheet to edit / delete one logged set and add a note. */
export function SetEditor({ set, exercise, onClose }: { set: WorkoutSet | null; exercise: Exercise | undefined; onClose: () => void }) {
  const t = useT();
  const th = useTheme();
  const f = useFormat();
  const warmups = useSettings((s) => s.warmups);
  const cardio = isCardio(exercise);
  const [w, setW] = useState<number | null>(null);
  const [r, setR] = useState<number | null>(null);
  const [dur, setDur] = useState<number | null>(null);
  const [dist, setDist] = useState<number | null>(null);
  const [warm, setWarm] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!set) return;
    setW(toDisplayWeight(f, set.weight));
    setR(set.reps);
    setDur(set.durationSec != null ? Math.round((set.durationSec / 60) * 10) / 10 : null);
    setDist(set.distanceM != null ? Math.round((set.distanceM / 1000) * 100) / 100 : null);
    setWarm(set.isWarmup);
    setNote(set.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  if (!set) return <Sheet visible={false} onClose={onClose}><View /></Sheet>;

  const valid = cardio ? (dur ?? 0) > 0 : (r ?? 0) > 0;
  const save = () => {
    repo.updateSet(set.id, cardio
      ? { durationSec: Math.round((dur ?? 0) * 60), distanceM: dist ? Math.round(dist * 1000) : null, note: note.trim() || null }
      : { weight: f.wFromDisplay(w ?? 0), reps: r ?? 0, isWarmup: warm, note: note.trim() || null });
    onClose();
  };
  const del = () => { repo.deleteSet(set.id); onClose(); };

  return (
    <Sheet
      visible onClose={onClose} title={t('train.editSet')}
      footer={(
        <View style={{ gap: 8 }}>
          <Button label={t('common.save')} onPress={save} disabled={!valid} />
          <Button label={t('train.deleteSet')} kind="danger" onPress={del} />
        </View>
      )}
    >
      {cardio ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><NumberField label={t('train.duration')} unit={t('train.min')} value={dur} onChange={setDur} decimals={1} min={0} /></View>
          <View style={{ flex: 1 }}><NumberField label={t('train.distance')} unit="km" value={dist} onChange={setDist} decimals={2} min={0} /></View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><NumberField label={t('train.weight')} unit={f.wUnit} value={w} onChange={setW} decimals={1} min={0} /></View>
            <View style={{ flex: 1 }}><NumberField label={t('train.reps')} value={r} onChange={setR} decimals={0} min={0} /></View>
          </View>
          {warmups || set.isWarmup ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Chip label={t('train.warmup')} on={warm} onPress={() => setWarm(!warm)} />
              {warm ? <Txt v="small">{t('train.warmupNote')}</Txt> : null}
            </View>
          ) : null}
        </>
      )}
      <TextInput
        value={note} onChangeText={setNote} multiline placeholder={t('train.notePlaceholder')} placeholderTextColor={th.c.muted}
        style={{ minHeight: 70, borderRadius: th.rSm, backgroundColor: th.c.surface2, padding: 12, color: th.c.text, fontFamily: th.font.regular, fontSize: 15, textAlignVertical: 'top' }}
      />
    </Sheet>
  );
}
