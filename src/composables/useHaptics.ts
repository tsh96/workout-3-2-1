import type { Ref } from 'vue'

export const HAPTIC_PATTERNS = {
  /** A set begins. */
  go: [60, 50, 60],
  /** A rest begins. */
  ease: [35],
  /** The whole session is done. */
  finish: [90, 60, 90, 60, 160],
  /** A control was pressed and something changed. */
  tick: 18,
} as const

export function useHaptics(enabled: Ref<boolean>) {
  const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator

  function vibrate(pattern: number | readonly number[]) {
    if (!enabled.value || !supported) return
    try {
      navigator.vibrate(pattern as number | number[])
    } catch {
      // Some browsers expose vibrate() but refuse without a user gesture.
    }
  }

  return { supported, vibrate }
}
