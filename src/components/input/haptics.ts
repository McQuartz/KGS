import * as Haptics from 'expo-haptics';

/** Light tap on key press; fails silently. */
export function hapticLight(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/** Selection tick for wheels; fails silently. */
export function hapticTick(): void {
  try {
    void Haptics.selectionAsync().catch(() => undefined);
  } catch {
    /* ignore */
  }
}
