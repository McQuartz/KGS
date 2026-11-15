import { useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as repo from '../../db/repo';
import { useT } from '../../i18n';
import { importJSON, readJSONFile, shareCSV, shareJSONBackup, summarize, validateBackup, type BackupFile } from '../../lib/backup';
import { generateDemoData } from '../../lib/demo';
import { useSettings } from '../../store/settings';
import { Button, Sheet, Txt } from '../ui';
import { Field, Group, SwitchRow } from './parts';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function DataSection() {
  const t = useT();
  const demo = useSettings((s) => s.demoData);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(msg(e) === 'sharing' ? t('data.noSharing') : t('data.exportFailed', { err: msg(e) }));
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    if (busy) return;
    let data: unknown;
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      data = await readJSONFile(res.assets[0].uri);
    } catch (e) {
      Alert.alert(t('data.import.invalid', { err: msg(e) }));
      return;
    }
    try {
      setPending(validateBackup(data));
    } catch (e) {
      Alert.alert(t('data.import.invalid', { err: msg(e) }));
    }
  };

  const doImport = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const b = pending;
    const go = () => {
      try {
        importJSON(b, mode);
        setPending(null);
        Alert.alert(t('data.import.done'));
      } catch (e) {
        setPending(null);
        Alert.alert(t('data.import.failed', { err: msg(e) }));
      }
    };
    if (mode === 'merge') return go();
    Alert.alert(t('data.import.replaceConfirmTitle'), t('data.import.replaceConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('data.import.replace'), style: 'destructive', onPress: go },
    ]);
  };

  const toggleDemo = (on: boolean) => {
    useSettings.getState().set({ demoData: on });
    if (on) generateDemoData();
    else repo.wipeDemo();
  };

  const deleteAll = () =>
    Alert.alert(t('data.deleteAll.confirm1Title'), t('data.deleteAll.confirm1Msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('data.deleteAll.confirm2Title'), t('data.deleteAll.confirm2Msg'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('data.deleteAll.yes'),
              style: 'destructive',
              onPress: () => {
                repo.wipeAll();
                useSettings.getState().set({ demoData: false });
              },
            },
          ]),
      },
    ]);

  const sum = pending ? summarize(pending) : null;
  return (
    <>
      <Group label={t('data.title')}>
        <Field caption={t('data.exportJson.cap')}>
          <Button kind="secondary" icon="download" label={t('data.exportJson')} disabled={busy} onPress={() => run(shareJSONBackup)} />
        </Field>
        <Field caption={t('data.exportCsv.cap')}>
          <Button kind="secondary" icon="download" label={t('data.exportCsv')} disabled={busy} onPress={() => run(shareCSV)} />
        </Field>
        <Field caption={t('data.import.cap')}>
          <Button kind="secondary" icon="upload" label={t('data.import')} disabled={busy} onPress={pick} />
        </Field>
        <SwitchRow title={t('data.demo')} caption={t('data.demo.cap')} value={demo} onChange={toggleDemo} />
        <Button kind="danger" icon="trash" label={t('data.deleteAll')} onPress={deleteAll} />
      </Group>
      <Sheet visible={pending !== null} onClose={() => setPending(null)} title={t('data.import.title')}>
        {sum ? <Txt v="muted">{t('data.import.summary', { w: sum.workouts, m: sum.measurements, t: sum.templates, e: sum.exercises })}</Txt> : null}
        <Field caption={t('data.import.mergeCap')}><Button label={t('data.import.merge')} onPress={() => doImport('merge')} /></Field>
        <Field caption={t('data.import.replaceCap')}><Button kind="danger" label={t('data.import.replace')} onPress={() => doImport('replace')} /></Field>
      </Sheet>
    </>
  );
}
