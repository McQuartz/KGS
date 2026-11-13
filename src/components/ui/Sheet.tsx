import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Txt, IconButton } from './primitives';

/** Bottom sheet modal (used for editors, pickers, number pads). */
export function Sheet({ visible, onClose, title, children, footer, scroll = true }: {
  visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; scroll?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
        <View style={{ backgroundColor: t.c.bg, borderTopLeftRadius: t.r + 6, borderTopRightRadius: t.r + 6, maxHeight: '88%', paddingBottom: insets.bottom + 8 }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.c.line }} /></View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6 }}>
              <View style={{ flex: 1 }}><Txt v="title">{title}</Txt></View>
              <IconButton name="close" onPress={onClose} />
            </View>
          ) : null}
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>{children}</ScrollView>
          ) : <View style={{ padding: 16, gap: 12 }}>{children}</View>}
          {footer ? <View style={{ paddingHorizontal: 16, gap: 8 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
