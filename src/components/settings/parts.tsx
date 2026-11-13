import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Icon, SectionLabel, Txt } from '../ui';
import { useTheme } from '../../theme';

/** Section label + card with rows. */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionLabel>{label}</SectionLabel>
      <Card style={{ gap: 14 }}>{children}</Card>
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={6}
      style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? t.c.accent : t.c.surface2, justifyContent: 'center' }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? t.c.accentInk : t.c.muted, alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}

/** Row with title (+ optional caption) on the left and a control on the right. */
export function SwitchRow({ title, caption, value, onChange }: { title: string; caption?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt>{title}</Txt>
        {caption ? <Txt v="small">{caption}</Txt> : null}
      </View>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

/** Title above, control below (for Segmented etc.). */
export function Field({ title, caption, children }: { title?: string; caption?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? <Txt>{title}</Txt> : null}
      {children}
      {caption ? <Txt v="small">{caption}</Txt> : null}
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
      style={{ width: 36, height: 36, borderRadius: t.rSm, backgroundColor: t.c.surface2, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
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

export function RowDivider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.c.line, opacity: 0.6 }} />;
}
