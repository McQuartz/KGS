import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Txt } from '../ui';

/** Bottom sheet like the mockup's .sheet-card: grip, h2 title, content, safe-area aware bottom padding. */
export function MockSheet({ visible, onClose, title, right, children, scroll = true }: {
  visible: boolean; onClose: () => void; title?: string; right?: ReactNode; children: ReactNode; scroll?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const body = <View style={{ gap: 14 }}>{children}</View>;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,12,14,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: t.c.bg, borderTopLeftRadius: t.r, borderTopRightRadius: t.r, maxHeight: '88%', paddingTop: 10, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 14 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.c.line, alignSelf: 'center' }} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Txt v="title">{title}</Txt>
              {right}
            </View>
          ) : null}
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{body}</ScrollView> : body}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
