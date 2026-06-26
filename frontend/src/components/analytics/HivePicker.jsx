import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  formatRelativeTime,
  formatTemperature,
  getHiveId,
  STALE_THRESHOLD_MS,
} from '../../utils/analyticsFormat';
import { TONES } from './tones';
import styles from './HivePicker.module.css';

// CSS fallback used on the very first paint (before the ResizeObserver
// has measured the right column) and on environments where DOM
// measurement is unavailable. Picks the smaller of:
//   - 640px (enough to show ~9 rows + header)
//   - 100vh - 280px (keeps the picker inside the viewport on shorter
//     screens so the user can still see context above and below)
const FALLBACK_MAX_HEIGHT_CSS = 'min(640px, calc(100vh - 280px))';

// Selector for the right column on the dashboard. The dashboard owns
// this element so the picker can stay self-contained and only depend
// on a stable aria-label rather than a parent ref.
const SELECTED_PANEL_SELECTOR = 'section[aria-label="Selected hive detail"]';

/**
 * One row in the hive picker. Compact (~64px), single tap target.
 *
 * Layout (see HivePicker.module.css): a 3-column × 2-row CSS grid where
 *   - column 1 = status dot (spans both rows, vertically centered)
 *   - column 2 = hive name on row 1, location on row 2
 *   - column 3 = latest temperature on row 1, "Xm ago" on row 2
 * The temp/age cells are direct grid children (not wrapped in a flex
 * column that gets vertically centered), so the name/temperature share
 * grid row 1 and the location/"Xm ago" share grid row 2 — they line up
 * to the pixel regardless of the relative heights of the two text rows.
 *
 * Selected state uses an amber left rail, soft amber background, and a
 * subtle inner amber border so the active hive reads at a glance from
 * anywhere on the dashboard.
 */
function HivePickerItem({ hive, selected, onSelect, quietOffline }) {
  const id = getHiveId(hive);
  const status = String(hive.healthStatus || 'offline').toLowerCase();
  const toneTokens = TONES[status] || TONES.muted;
  // When the global stale banner is already shown, mute the per-row
  // status dot to a single low-contrast mark so the picker doesn't
  // visually scream "OFFLINE × N".
  const showDot = status !== 'default' && !quietOffline;
  const dotClass = quietOffline
    ? 'bg-white/15'
    : `${toneTokens.dot}`;

  const itemClass = `${styles.item}${selected ? ` ${styles.selected}` : ''}`;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-pressed={selected}
        className={itemClass}
      >
        {showDot ? (
          <span
            aria-hidden="true"
            className={`${styles.dot} ${dotClass}`}
          />
        ) : (
          <span aria-hidden="true" className={styles.dotPlaceholder} />
        )}

        <div className={styles.name}>
          {hive.name || `Hive ${id}`}
        </div>
        <div className={styles.location}>
          {hive.locationName || 'No location'}
        </div>

        <div className={styles.temp}>
          {formatTemperature(hive.latestTemperature)}
        </div>
        <div className={styles.age}>
          {formatRelativeTime(hive.latestReadingAt)}
        </div>
      </button>
    </li>
  );
}

/**
 * Compact vertical hive picker. Replaces the old square hive status
 * cards so the dashboard body is a clean "pick on the left, inspect on
 * the right" two-column layout.
 *
 * Layout hardening:
 *   - The card is a flex column with the header + divider pinned at
 *     the top (flex-shrink-0) and the hive list taking the remaining
 *     height via flex-1.
 *   - On desktop a ResizeObserver measures the right-side selected
 *     panel and applies that height as the card's max-height, so the
 *     picker header lines up with the selected panel header and the
 *     hive list scrolls internally instead of pushing the page down.
 *   - A CSS-only fallback (`FALLBACK_MAX_HEIGHT_CSS`) covers the very
 *     first paint and any environment where DOM measurement is
 *     unavailable, so the picker never grows unbounded.
 *   - On mobile/tablet (single column) the observer still applies —
 *     the selected panel is below the picker in the source order so
 *     its measured height isn't a meaningful target. The CSS fallback
 *     caps the stacked layout at min(640px, 100vh - 280px).
 */
export default function HivePicker({
  hives,
  selectedHiveId,
  onSelect,
  globalStale = false,
}) {
  const listRef = useRef(null);
  const [maxHeightPx, setMaxHeightPx] = useState(null);

  const totalHives = hives?.length ?? 0;

  // Mirror the right-side selected panel's height so the picker card
  // ends at the same y as the chart card. Only meaningful when the
  // two columns sit side-by-side; on stacked layouts the picker's
  // CSS fallback still applies.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const target = document.querySelector(SELECTED_PANEL_SELECTOR);
    if (!target) return undefined;

    const measure = () => {
      const rect = target.getBoundingClientRect();
      // Selected panel can be 0 when it just mounted; wait for it to
      // grow. We also enforce a sane minimum so a 0-height reading
      // doesn't collapse the picker.
      if (rect.height > 0) setMaxHeightPx(rect.height);
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Keep the selected hive in view when the picker is scrolled and the
  // selection jumps (e.g. clicking an off-screen row, or initial mount
  // with a 20+ hive fleet). block: 'nearest' is a no-op when the row
  // is already visible, so this only scrolls when it has to.
  useEffect(() => {
    if (!selectedHiveId) return;
    const root = listRef.current;
    if (!root) return;
    const sel = root.querySelector('[aria-pressed="true"]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }, [selectedHiveId, hives, maxHeightPx]);

  return (
    <aside
      // CSS fallback (used on first paint / no-JS) + JS-driven inline
      // override once the right column has been measured. The fallback
      // is min(640px, 100vh - 280px) — large enough to show ~9 rows on
      // desktop and short enough to keep the picker inside the viewport
      // on mobile/tablet.
      style={
        maxHeightPx
          ? { maxHeight: `${maxHeightPx}px` }
          : { maxHeight: FALLBACK_MAX_HEIGHT_CSS }
      }
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-elevated shadow-card-sm"
      aria-label="Hive picker"
    >
      {/* Header dimensions are intentionally the same as the
          SelectedHiveSection header (px-3.5 py-2.5 + 16px title + 12px
          secondary) so the two columns line up cleanly on the dashboard.
          flex-shrink-0 keeps the header pinned to the top of the card
          even when the hive list scrolls below. */}
      <header className="flex shrink-0 items-baseline justify-between gap-3 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-extrabold leading-[1.15] text-white">
            Hives
          </h2>
          <div className="mt-0.5 text-[12px] tabular-nums text-ink-secondary">
            {totalHives} {totalHives === 1 ? 'hive' : 'hives'}
          </div>
        </div>
      </header>
      <div className="shrink-0 border-b border-line-soft" />

      {/* flex-1 + min-h-0 lets the list consume the remaining card
          height and scroll internally. The card's max-height comes
          from the ResizeObserver (or the CSS fallback on first paint). */}
      <ul
        ref={listRef}
        className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto"
      >
        {hives.map(hive => {
          const id = getHiveId(hive);
          return (
            <HivePickerItem
              key={id}
              hive={hive}
              selected={String(id) === String(selectedHiveId)}
              onSelect={onSelect}
              quietOffline={globalStale}
            />
          );
        })}
      </ul>
    </aside>
  );
}