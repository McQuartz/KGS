import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { hapticLight } from '../input/haptics';

function StepBtn({ label, onStep, width }: { label: string; onStep: () => void; width: number }) {
  const th = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  const ref = useRef(onStep);
  ref.current = onStep;
  const loop = (n: number) => { timer.current = setTimeout(() => { ref.current(); loop(n + 1); }, n > 8 ? 55 : 110); };
  return (
    <Pressable
      onPressIn={() => { hapticLight(); ref.current(); stop(); timer.current = setTimeout(() => { ref.current(); loop(1); }, 420); }}
      onPressOut={stop}
      style={({ pressed }) => ({ width, height: 48, borderRadius: th.rSm, backgroundColor: pressed ? th.c.accentSoft : th.c.surface, borderWidth: 1, borderColor: th.c.line, alignItems: 'center', justifyContent: 'center' })}
    >
      <Text style={{ fontFamily: th.num.semibold, fontSize: 15, color: th.c.text }}>{label}</Text>
    </Pressable>
  );
}

/** Mockup .stepper row: [-big][-small] value [+small][+big], hold to repeat. */
export function StepRow({ steps, center }: { steps: { label: string; onStep: () => void }[]; center: ReactNode }) {
  const half = steps.length / 2;
  const w = steps.length > 2 ? 44 : 56;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {steps.slice(0, half).map((s) => <StepBtn key={s.label} label={s.label} onStep={s.onStep} width={w} />)}
      <View style={{ flex: 1 }}>{center}</View>
      {steps.slice(half).map((s) => <StepBtn key={s.label} label={s.label} onStep={s.onStep} width={w} />)}
    </View>
  );
}
