import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, Sheet } from '../ui';

/** Small sheet to edit a free-text note. */
export function TextSheet({ visible, onClose, title, value, onSave }: {
  visible: boolean; onClose: () => void; title: string; value: string | null; onSave: (v: string | null) => void;
}) {
  const t = useT();
  const th = useTheme();
  const [text, setText] = useState(value ?? '');
  useEffect(() => { if (visible) setText(value ?? ''); }, [visible, value]);
  return (
    <Sheet
      visible={visible} onClose={onClose} title={title}
      footer={<Button label={t('common.save')} onPress={() => { onSave(text.trim() || null); onClose(); }} />}
    >
      <TextInput
        value={text} onChangeText={setText} multiline autoFocus placeholder={t('train.notePlaceholder')} placeholderTextColor={th.c.muted}
        style={{ minHeight: 90, borderRadius: th.rSm, backgroundColor: th.c.surface2, padding: 12, color: th.c.text, fontFamily: th.font.regular, fontSize: 15, textAlignVertical: 'top' }}
      />
    </Sheet>
  );
}
