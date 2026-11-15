import { createContext, useContext, type ReactNode } from 'react';

/** True inside the tab pager: the tab bar already handles the bottom safe area. */
export const InTabsContext = createContext(false);
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';

// ---------- Text ----------
type TxtVariant = 'body' | 'muted' | 'small' | 'xs' | 'label' | 'eyebrow' | 'title' | 'h1' | 'num' | 'numLg' | 'numXl' | 'unit';
export function Txt({ v = 'body', color, style, children, numberOfLines }: { v?: TxtVariant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  const t = useTheme();
  const base: TextStyle = (() => {
    switch (v) {
      case 'muted': return { fontFamily: t.font.regular, fontSize: 14, color: t.c.muted };
      case 'small': return { fontFamily: t.font.regular, fontSize: 13, color: t.c.muted };
      case 'xs': return { fontFamily: t.font.regular, fontSize: 12, color: t.c.muted };
      // mockup .label: 13px muted medium, sentence case
      case 'label': return { fontFamily: t.font.medium, fontSize: 13, color: t.c.muted };
      case 'eyebrow': return { fontFamily: t.font.medium, fontSize: 12, color: t.c.muted, letterSpacing: 0.5, textTransform: 'uppercase' };
      case 'unit': return { fontFamily: t.font.regular, fontSize: 14, color: t.c.muted };
      case 'title': return { fontFamily: t.font.bold, fontSize: 17, color: t.c.text, letterSpacing: -0.3 };
      case 'h1': return { fontFamily: t.font.bold, fontSize: 26, lineHeight: 29, color: t.c.text, letterSpacing: -0.5 };
      case 'num': return { fontFamily: t.num.medium, fontSize: 15, color: t.c.text, fontVariant: ['tabular-nums'] };
      case 'numLg': return { fontFamily: t.num.semibold, fontSize: 24, color: t.c.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] };
      case 'numXl': return { fontFamily: t.num.medium, fontSize: 40, lineHeight: 44, color: t.c.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] };
      default: return { fontFamily: t.font.regular, fontSize: 15, color: t.c.text };
    }
  })();
  return <Text numberOfLines={numberOfLines} style={[base, color ? { color } : null, style]}>{children}</Text>;
}

// ---------- Screen ----------
/** Standard scrolling screen with large title. `footer` is pinned at the bottom (thumb zone). */
export function Screen({ title, eyebrow, bar, right, left, children, footer, scroll = true, padded = true }: {
  title?: string; /** small uppercase line above the title (mockup .eyebrow) */ eyebrow?: string; /** compact header (h2 title, centered row) for sub-screens */ bar?: boolean;
  right?: ReactNode; left?: ReactNode; children: ReactNode; footer?: ReactNode; scroll?: boolean; padded?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const inTabs = useContext(InTabsContext);
  const bottom = inTabs ? 0 : insets.bottom;
  const header = (title || right || left) ? (
    <View style={{ flexDirection: 'row', alignItems: bar ? 'center' : 'flex-end', paddingHorizontal: 18, paddingTop: insets.top + (bar ? 12 : 18), paddingBottom: 10, gap: 12 }}>
      {left}
      <View style={{ flex: 1 }}>
        {eyebrow ? <Txt v="eyebrow" style={{ marginBottom: 4 }} numberOfLines={1}>{eyebrow}</Txt> : null}
        {title ? <Txt v={bar ? 'title' : 'h1'} numberOfLines={1}>{title}</Txt> : null}
      </View>
      {right}
    </View>
  ) : <View style={{ height: insets.top }} />;
  const content = <View style={{ paddingHorizontal: padded ? 16 : 0, paddingBottom: footer ? 16 : 28 + bottom, gap: 14 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {header}
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 4 }}>{content}</ScrollView> : <View style={{ flex: 1 }}>{content}</View>}
      {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 + bottom, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line, backgroundColor: t.c.bg, gap: 8 }}>{footer}</View> : null}
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
    gap: 10,
    ...(t.cardShadow ? { shadowColor: '#141414', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null),
  };
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>;
  return <View style={[s, style]}>{children}</View>;
}

// ---------- Button ----------
export function Button({ label, onPress, kind = 'primary', icon, disabled, style, compact, large }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
  /** mockup .btn.sm (34px) */ compact?: boolean; /** mockup .btn.lg (54px) */ large?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.c.accent : kind === 'secondary' ? t.c.surface2 : 'transparent';
  const fg = kind === 'primary' ? t.c.accentInk : kind === 'danger' ? t.c.bad : t.c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        height: compact ? 34 : large ? 54 : 44, borderRadius: t.rSm, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderWidth: kind === 'ghost' ? 1 : 0, borderColor: t.c.line,
        gap: 6, paddingHorizontal: compact ? 12 : 16, opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      }, style]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: t.font.semibold, fontSize: compact ? 14 : large ? 16 : 15, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, size = 22, color, badge, count, boxed, accessibilityLabel }: {
  name: IconName; onPress: () => void; size?: number; color?: string; badge?: boolean; /** number badge (mockup .dot) */ count?: number;
  /** round surface button with border/shadow (mockup .iconbtn); default is plain */ boxed?: boolean; accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <Pressable accessibilityLabel={accessibilityLabel} hitSlop={8} onPress={onPress} style={({ pressed }) => ({
      width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, opacity: pressed ? 0.6 : 1,
      ...(boxed ? { backgroundColor: t.c.surface, borderWidth: t.cardBorder, borderColor: t.c.line, ...(t.cardShadow ? { shadowColor: '#141414', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null) } : null),
    })}>
      <Icon name={name} size={size} color={color ?? t.c.text} />
      {count ? (
        <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: t.c.accent, borderWidth: 2, borderColor: t.c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.c.accentInk, fontSize: 9, fontFamily: t.font.bold }}>{count}</Text>
        </View>
      ) : badge ? <View style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: t.c.accent }} /> : null}
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
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={{ flex: 1, height: small ? 28 : 34, borderRadius: t.rSm - 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (t.dark ? t.c.line : t.c.surface) : 'transparent', ...(on && !t.dark ? { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null) }}>
            <Text numberOfLines={1} style={{ fontFamily: t.font.medium, fontSize: small ? 12 : 13, color: on ? t.c.text : t.c.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Status pill (fixed width 114, per design feedback; mockup .pill.fixed) ----------
export function StatusPill({ kind, label, pct, fixed = true }: { kind: 'up' | 'hold' | 'down' | 'unknown' | 'pr'; label: string; /** e.g. "+2.6 %" appended */ pct?: string; fixed?: boolean }) {
  const t = useTheme();
  const color = kind === 'up' ? t.c.good : kind === 'down' ? t.c.warn : kind === 'pr' ? t.c.accent : t.c.muted;
  const bg = kind === 'up' ? alpha(t.c.good, 0.14) : kind === 'down' ? alpha(t.c.warn, 0.16) : kind === 'pr' ? t.c.accentSoft : t.c.surface2;
  const icon = kind === 'up' ? 'up' : kind === 'down' ? 'down' : kind === 'pr' ? 'star' : 'flat';
  return (
    <View style={{ ...(fixed ? { width: 114 } : { paddingHorizontal: 9 }), height: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: bg }}>
      <Icon name={icon} size={13} color={color} strokeWidth={2} />
      <Text numberOfLines={1} style={{ fontFamily: t.font.semibold, fontSize: 12, color }}>{label}{pct ? ` ${pct}` : ''}</Text>
    </View>
  );
}

// ---------- Rows / misc ----------
export function ListRow({ title, subtitle, right, onPress, chevron = !!onPress }: { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; chevron?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12, opacity: pressed ? 0.7 : 1 })}>
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

/** mockup .chip: outlined, muted; selected = inverted (text color background) */
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: on ? t.c.text : t.c.line, backgroundColor: on ? t.c.text : 'transparent' }}>
      <Text style={{ fontFamily: t.font.medium, fontSize: 13, color: on ? t.c.bg : t.c.muted }}>{label}</Text>
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
