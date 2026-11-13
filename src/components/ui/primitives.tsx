import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';

// ---------- Text ----------
type TxtVariant = 'body' | 'muted' | 'small' | 'label' | 'title' | 'h1' | 'num' | 'numLg' | 'numXl';
export function Txt({ v = 'body', color, style, children, numberOfLines }: { v?: TxtVariant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  const t = useTheme();
  const base: TextStyle = (() => {
    switch (v) {
      case 'muted': return { fontFamily: t.font.regular, fontSize: 14, color: t.c.muted };
      case 'small': return { fontFamily: t.font.regular, fontSize: 12, color: t.c.muted };
      case 'label': return { fontFamily: t.font.semibold, fontSize: 12, color: t.c.muted, letterSpacing: 0.4, textTransform: 'uppercase' };
      case 'title': return { fontFamily: t.font.bold, fontSize: 17, color: t.c.text, letterSpacing: -0.2 };
      case 'h1': return { fontFamily: t.font.bold, fontSize: 26, color: t.c.text, letterSpacing: -0.5 };
      case 'num': return { fontFamily: t.num.medium, fontSize: 15, color: t.c.text, fontVariant: ['tabular-nums'] };
      case 'numLg': return { fontFamily: t.num.semibold, fontSize: 24, color: t.c.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] };
      case 'numXl': return { fontFamily: t.num.semibold, fontSize: 36, color: t.c.text, letterSpacing: -1, fontVariant: ['tabular-nums'] };
      default: return { fontFamily: t.font.regular, fontSize: 15, color: t.c.text };
    }
  })();
  return <Text numberOfLines={numberOfLines} style={[base, color ? { color } : null, style]}>{children}</Text>;
}

// ---------- Screen ----------
/** Standard scrolling screen with large title. `footer` is pinned at the bottom (thumb zone). */
export function Screen({ title, right, left, children, footer, scroll = true, padded = true }: {
  title?: string; right?: ReactNode; left?: ReactNode; children: ReactNode; footer?: ReactNode; scroll?: boolean; padded?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const header = (title || right || left) ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: insets.top + 10, paddingBottom: 8, gap: 8 }}>
      {left}
      <View style={{ flex: 1 }}>{title ? <Txt v="h1" numberOfLines={1}>{title}</Txt> : null}</View>
      {right}
    </View>
  ) : <View style={{ height: insets.top }} />;
  const content = <View style={{ paddingHorizontal: padded ? 16 : 0, paddingBottom: footer ? 16 : 28, gap: 12 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {header}
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 4 }}>{content}</ScrollView> : <View style={{ flex: 1 }}>{content}</View>}
      {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line, backgroundColor: t.c.bg, gap: 8 }}>{footer}</View> : null}
    </View>
  );
}

// ---------- Card ----------
export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const t = useTheme();
  const s: ViewStyle = {
    backgroundColor: t.c.surface,
    borderRadius: t.r,
    borderWidth: t.cardBorder,
    borderColor: t.c.line,
    padding: padded ? 16 : 0,
    ...(t.cardShadow ? { shadowColor: '#141414', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null),
  };
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>;
  return <View style={[s, style]}>{children}</View>;
}

// ---------- Button ----------
export function Button({ label, onPress, kind = 'primary', icon, disabled, style, compact }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.c.accent : kind === 'secondary' ? t.c.surface2 : 'transparent';
  const fg = kind === 'primary' ? t.c.accentInk : kind === 'danger' ? t.c.bad : kind === 'ghost' ? t.c.accent : t.c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        height: compact ? 38 : 50, borderRadius: t.rSm, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingHorizontal: compact ? 12 : 18, opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      }, style]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: t.font.semibold, fontSize: compact ? 14 : 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, size = 22, color, badge, accessibilityLabel }: { name: IconName; onPress: () => void; size?: number; color?: string; badge?: boolean; accessibilityLabel?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityLabel={accessibilityLabel} hitSlop={8} onPress={onPress} style={({ pressed }) => ({ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color={color ?? t.c.text} />
      {badge ? <View style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: t.c.accent }} /> : null}
    </Pressable>
  );
}

// ---------- Segmented control ----------
export function Segmented<T extends string>({ value, options, onChange, small }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; small?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.c.surface2, borderRadius: t.rSm, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={{ flex: 1, height: small ? 30 : 36, borderRadius: t.rSm - 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.surface : 'transparent' }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? t.font.semibold : t.font.medium, fontSize: small ? 13 : 14, color: on ? t.c.text : t.c.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Status pill (fixed width, per design feedback) ----------
export function StatusPill({ kind, label }: { kind: 'up' | 'hold' | 'down' | 'unknown'; label: string }) {
  const t = useTheme();
  const color = kind === 'up' ? t.c.good : kind === 'down' ? t.c.bad : t.c.muted;
  const icon = kind === 'up' ? 'up' : kind === 'down' ? 'down' : 'flat';
  return (
    <View style={{ width: 118, height: 26, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: t.c.surface2 }}>
      <Icon name={icon} size={13} color={color} strokeWidth={2.2} />
      <Text numberOfLines={1} style={{ fontFamily: t.font.semibold, fontSize: 12, color }}>{label}</Text>
    </View>
  );
}

// ---------- Rows / misc ----------
export function ListRow({ title, subtitle, right, onPress, chevron = !!onPress }: { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; chevron?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v="small" numberOfLines={1}>{subtitle}</Txt> : null}
      </View>
      {right}
      {chevron ? <Icon name="chev" size={18} color={t.c.muted} /> : null}
    </Pressable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.line }} />;
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: on ? t.c.accentSoft : t.c.surface2, borderWidth: on ? 1 : 0, borderColor: t.c.accent }}>
      <Text style={{ fontFamily: t.font.medium, fontSize: 13, color: on ? t.c.accent : t.c.text }}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: -4, paddingHorizontal: 4 }}>
      <View style={{ flex: 1 }}><Txt v="label">{children}</Txt></View>
      {right}
    </View>
  );
}
