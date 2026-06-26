import { getHiveId } from '../../utils/analyticsFormat';

/**
 * Hive dropdown used in the page header. The label + select are wrapped
 * in a real <label> for native form semantics, and the select gets a
 * visible focus ring for keyboard users. The dropdown options themselves
 * can't be styled cross-browser (native <select> limitation), so the
 * closed state is the only thing we control.
 */
export default function HiveSelector({
  hives,
  selectedHiveId,
  onChange,
  label = 'Hive',
  compact = false,
  allowAll = false,
  allLabel = 'All hives',
}) {
  return (
    <label
      className={
        'grid gap-2 ' + (compact ? 'min-w-[180px]' : 'min-w-[240px]')
      }
    >
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
      <select
        value={selectedHiveId || ''}
        onChange={event => onChange(event.target.value)}
        disabled={!hives.length}
        className="w-full rounded-md border border-line bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {allowAll && <option value="">{allLabel}</option>}
        {!hives.length && !allowAll && <option value="">No hives</option>}
        {hives.map(hive => {
          const id = getHiveId(hive);
          return (
            <option key={id} value={id}>
              {hive.name || `Hive ${id}`}
            </option>
          );
        })}
      </select>
    </label>
  );
}
