import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useFormat } from '../../lib/format';
import { useT } from '../../i18n';
import { useSettings } from '../../store/settings';
import { Button, Sheet } from '../ui';
import { NumberPad } from './NumberPad';
import { NumberWheel } from './NumberWheel';
import { hapticLight } from './haptics';
import { clampNum, roundTo } from './util';
import type { NumberFieldProps } from './types';

type EditorProps = Pick<NumberFieldProps, 'value' | 'onChange' | 'label' | 'unit' | 'decimals' | 'step' | 'min' | 'max' | 'placeholder'> & {
  visible: boolean;
  onClose: () => void;
};

/** Bottom sheet with the custom numeric keypad. */
export function NumberPadSheet({ visible, onClose, label, unit, value, onChange, decimals, min, max, placeholder }: EditorProps) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={label} scroll={false} footer={<Button label={t('common.done')} onPress={onClose} />}>
      <NumberPad value={value} onChange={onChange} decimals={decimals} min={min} max={max} placeholder={placeholder} unit={unit} showDisplay />
    </Sheet>
  );
}

/** Bottom sheet with drum wheel(s). */
export function NumberWheelSheet({ visible, onClose, label, unit, value, onChange, decimals, step, min, max, placeholder }: EditorProps) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={label} scroll={false} footer={<Button label={t('common.done')} onPress={onClose} />}>
      {visible ? <NumberWheel value={value} onChange={onChange} decimals={decimals} step={step} min={min} max={max} placeholder={placeholder} unit={unit} /> : null}
    </Sheet>
  );
}

function StepButton({ label, onStep }: { label: string; onStep: () => void }) {
  const t = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const loop = (delay: number) => {
    timer.current = setTimeout(() => {
      stepRef.current();
      loop(100);
    }, delay);
  };
  return (
    <Pressable
      onPressIn={() => { hapticLight(); stepRef.current(); stop(); loop(450); }}
      onPressOut={stop}
      style={({ pressed }) => ({ minWidth: 48, height: 44, paddingHorizontal: 8, borderRadius: t.rSm, backgroundColor: pressed ? t.c.line : t.c.surface2, alignItems: 'center', justifyContent: 'center' })}
    >
      <Text style={{ fontFamily: t.num.medium, fontSize: 15, color: t.c.text }}>{label}</Text>
    </Pressable>
  );
}

/** Numeric input that follows the global input method (number pad / drum wheel / +/- stepper). */
export function NumberField(props: NumberFieldProps) {
  const { value, onChange, label, unit, decimals = 0, min, max, placeholder, size = 'md' } = props;
  const t = useTheme();
  const f = useFormat();
  const globalMethod = useSettings((s) => s.input);
  const stepperStep = useSettings((s) => s.stepperStep);
  const method = props.method ?? globalMethod;
  const step = props.step ?? (method === 'stepper' ? stepperStep : decimals > 0 ? 10 ** -decimals : 1);
  const [open, setOpen] = useState(false);

  const valueRef = useRef(value);
  valueRef.current = value;

  const nudge = (delta: number) => {
    const base = valueRef.current ?? placeholder ?? min ?? 0;
    const next = clampNum(roundTo(base + delta, Math.max(decimals, 3)), min, max);
    const out = roundTo(next, decimals);
    valueRef.current = out;
    onChange(out);
  };

  const isNull = value === null;
  const shownVal = value ?? placeholder ?? null;
  const text = shownVal === null ? '–' : f.num(shownVal, decimals);
  const big = size === 'lg';

  const valueBox = (
    <Pressable
      onPress={() => setOpen(true)}
      style={({ pressed }) => ({ flex: method === 'stepper' ? 1 : undefined, flexDirection: 'row', alignItems: 'baseline', justifyContent: method === 'stepper' ? 'center' : 'flex-start', gap: 4, paddingVertical: big ? 10 : 8, paddingHorizontal: 12, minHeight: big ? 56 : 44, borderRadius: t.rSm, backgroundColor: pressed ? t.c.line : t.c.surface2 })}
    >
      <Text style={{ fontFamily: big ? t.num.semibold : t.num.medium, fontSize: big ? 30 : 18, color: isNull ? t.c.muted : t.c.text, letterSpacing: big ? -0.8 : 0, alignSelf: 'center' }}>{text}</Text>
      {unit ? <Text style={{ fontFamily: t.font.regular, fontSize: big ? 15 : 13, color: t.c.muted, alignSelf: 'center' }}>{unit}</Text> : null}
    </Pressable>
  );

  const sheetProps = { value, onChange, label, unit, decimals, step: props.step, min, max, placeholder, visible: open, onClose: () => setOpen(false) };

  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={{ fontFamily: t.font.medium, fontSize: 13, color: t.c.muted }}>{label}</Text> : null}
      {method === 'stepper' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StepButton label={`−${f.numSmart(step * 10, 2)}`} onStep={() => nudge(-step * 10)} />
          <StepButton label={`−${f.numSmart(step, 2)}`} onStep={() => nudge(-step)} />
          {valueBox}
          <StepButton label={`+${f.numSmart(step, 2)}`} onStep={() => nudge(step)} />
          <StepButton label={`+${f.numSmart(step * 10, 2)}`} onStep={() => nudge(step * 10)} />
        </View>
      ) : (
        valueBox
      )}
      {method === 'wheel' ? <NumberWheelSheet {...sheetProps} /> : <NumberPadSheet {...sheetProps} />}
    </View>
  );
}
