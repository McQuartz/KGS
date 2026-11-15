import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Button } from '../ui';
import { MockSheet } from './MockSheet';

/** Note sheet (mockup "note"): optional quick tags, textarea, Save. */
export function TextSheet({ visible, onClose, title, value, onSave, tags }: {
  visible: boolean; onClose: () => void; title: string; value: string | null; onSave: (v: string | null) => void; tags?: boolean;
}) {
  const t = useT();
  const th = useTheme();
  const [text, setText] = useState(value ?? '');
  useEffect(() => { if (visible) setText(value ?? ''); }, [visible, value]);
  const tagList = [t('train.tagEasy'), t('train.tagHard'), t('train.tagGrinder'), t('train.tagSpotted'), t('train.tagPain')];
  if (!visible) return null;
  return (
    <MockSheet visible onClose={onClose} title={title} scroll={false}>
      {tags ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {tagList.map((x) => (
            <Pressable key={x} onPress={() => setText((s) => (s ? `${s}, ${x}` : x))} style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: th.c.line, justifyContent: 'center' }}>
              <Text style={{ fontFamily: th.font.regular, fontSize: 13, color: th.c.text }}>{x}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        value={text} onChangeText={setText} multiline autoFocus placeholder={tags ? t('train.notePh') : t('train.notePlaceholder')} placeholderTextColor={th.c.muted}
        style={{ minHeight: 70, borderRadius: th.rSm, backgroundColor: th.c.surface, borderWidth: 1, borderColor: th.c.line, paddingHorizontal: 12, paddingVertical: 10, color: th.c.text, fontFamily: th.font.regular, fontSize: 15, textAlignVertical: 'top' }}
      />
      <Button label={t('common.save')} onPress={() => { onSave(text.trim() || null); onClose(); }} />
    </MockSheet>
  );
}
