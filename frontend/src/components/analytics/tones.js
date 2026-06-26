/**
 * Tonal color tokens for {@link StatCard} and {@link OperationsSummaryStrip}.
 * Stored as full Tailwind class strings so consumers can spread them onto
 * an element with no extra logic. Each entry exposes:
 *   - `dot`         — the small status dot (just the bg color)
 *   - `text`        — text color for the value (or label, if you want it tinted)
 *   - `ring`        — keyboard focus-ring color (only applied to clickable cards)
 *
 * Classes are written as full literal strings (not template-interpolated)
 * so Tailwind's JIT scanner picks them up at build time.
 */
export const TONES = {
  default: { dot: 'bg-amber', text: 'text-amber', ring: 'focus-visible:ring-amber/60' },
  healthy: { dot: 'bg-success', text: 'text-success', ring: 'focus-visible:ring-success/60' },
  warning: { dot: 'bg-warning', text: 'text-warning', ring: 'focus-visible:ring-warning/60' },
  critical: { dot: 'bg-error', text: 'text-error', ring: 'focus-visible:ring-error/60' },
  muted: { dot: 'bg-ink-muted', text: 'text-ink-muted', ring: 'focus-visible:ring-white/40' },
};

export function getTone(tone) {
  return TONES[tone] || TONES.default;
}
