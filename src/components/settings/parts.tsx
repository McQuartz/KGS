import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Txt } from '../ui';
import { useTheme } from '../../theme';

/** Mockup .set-group: label + card. By default rows (.srow) separated by hairlines; `loose` = card with gap 10 and no row separators. */
export function Group({ label, children, loose }: { label: string; children: ReactNode; loose?: boolean }) {
  const t = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ paddingHorizontal: 2 }}><Txt v="label" style={{ lineHeight: 22 }}>{label}</Txt></View>
      <Card style={{ gap: loose ? 10 : 0 }}>
        {loose
          ? rows
          : rows.map((c, i) => (
              <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line } : null}>{c}</View>
            ))}
      </Card>
    </View>
  );
}

/** Mockup .toggle: 46x28, line-coloured track, white thumb. */
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={6}
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? t.c.accent : t.c.line }}
    >
      <View style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 }} />
    </Pressable>
  );
}

/** Mockup .srow with title (+ optional caption) on the left and a toggle on the right. */
export function SwitchRow({ title, caption, value, onChange }: { title: string; caption?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontSize: 13, lineHeight: 19 }}>{title}</Txt>
        {caption ? <Txt v="xs" style={{ lineHeight: 17 }}>{caption}</Txt> : null}
      </View>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

/** Mockup .srow.col: optional title, control, optional caption. */
export function Field({ title, caption, children }: { title?: string; caption?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8, paddingVertical: 12 }}>
      {title ? <Txt style={{ fontSize: 13, lineHeight: 19 }}>{title}</Txt> : null}
      {children}
      {caption ? <Txt v="xs" style={{ lineHeight: 17 }}>{caption}</Txt> : null}
    </View>
  );
}

/** Plain row (label left, control right). */
export function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}><Txt style={{ fontSize: 13, lineHeight: 19 }}>{title}</Txt></View>
      {children}
    </View>
  );
}

/** − value + stepper. */
export function Stepper({ value, onChange, step, min, max, format }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; format?: (v: number) => string }) {
  const t = useTheme();
  const btn = (name: 'minus' | 'plus', delta: number, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      disabled={disabled}
      hitSlop={6}
      style={{ width: 34, height: 34, borderRadius: t.rSm, backgroundColor: t.c.surface2, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Icon name={name} size={18} color={t.c.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn('minus', -step, value <= min)}
      <View style={{ minWidth: 64, alignItems: 'center' }}><Txt v="num">{format ? format(value) : String(value)}</Txt></View>
      {btn('plus', step, value >= max)}
    </View>
  );
}
