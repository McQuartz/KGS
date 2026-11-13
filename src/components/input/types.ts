export interface NumberFieldProps {
  value: number | null;
  onChange: (v: number) => void;
  /** caption shown above / inside the field, e.g. "Weight" */
  label?: string;
  /** unit suffix shown after the value, e.g. "kg" */
  unit?: string;
  decimals?: number;
  /** small step for +/- stepper and wheel granularity (big step = 10×). default from settings.stepperStep */
  step?: number;
  min?: number;
  max?: number;
  /** muted placeholder (e.g. prefilled value from last time) when value is null */
  placeholder?: number | null;
  /** visual size */
  size?: 'md' | 'lg';
  /** override the global input method */
  method?: 'pad' | 'wheel' | 'stepper';
}
