import { titleCase } from '../../utils/analyticsFormat';

/**
 * Status badge colors. Each entry is a complete Tailwind class string for
 * one of the three layers (text, background, border) so the JSX below can
 * stay declarative. Dot color is reused from the text layer via
 * `currentColor` so a single token drives both.
 *
 *   - `text`   — text + dot color
 *   - `bg`     — tinted background
 *   - `border` — pill border
 *
 * Keys are the four values the backend `healthStatus` field can return.
 */
const STATUS_STYLES = {
  healthy:   'text-success  bg-success/10  border-success/30',
  warning:   'text-warning  bg-warning/10  border-warning/30',
  critical:  'text-error    bg-error/10    border-error/30',
  offline:   'text-ink-muted bg-white/5   border-white/10',
};

const DEFAULT_STYLE = 'text-ink-muted bg-white/5 border-white/10';

/**
 * Compact pill that displays a hive/device status with a small color dot.
 * Renders the status key in title-case by default; pass `label` to override.
 */
export default function StatusBadge({ status, label }) {
  const key = String(status || 'offline').toLowerCase();
  const styleClass = STATUS_STYLES[key] || DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] ${styleClass}`}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full bg-current"
      />
      {label || titleCase(key)}
    </span>
  );
}
