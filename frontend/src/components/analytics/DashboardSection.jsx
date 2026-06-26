/**
 * Section header + content slot used across the dashboard and analytics
 * pages. Eyebrow is the small uppercase tag above the title; action is
 * an optional right-aligned control (button, link, badge).
 *
 * Header content is `items-center` so the action baseline aligns with
 * the title, not the bottom of the title block.
 *
 * Top-spacing behavior
 * --------------------
 * Default top spacing is `mt-8` (32px) so every `DashboardSection` on
 * the page gets a consistent vertical break between sections, sitting
 * in the dashboard's "around 28–36px" major-section target.
 *
 * Pass `className` to override the default. **Important:** in Tailwind's
 * generated CSS, `mt-6` is emitted *after* `mt-0`–`mt-5` in source
 * order, so if we just appended the override the default would silently
 * win (same specificity, later rule). We therefore make `className`
 * *replace* the default entirely — if you pass `className="mt-0"` you
 * get no top margin, if you pass `className="mt-3"` you get 12px, and
 * so on. This is also why the wrapper around the dashboard's bottom
 * half (Fleet Trend + Fleet Status) uses `space-y-*` for its inner
 * gap instead of asking each child to override its `mt-6`.
 */
export default function DashboardSection({
  title,
  eyebrow,
  action,
  children,
  className,
}) {
  // `className` fully replaces the default `mt-6` when provided, so
  // callers can pin a section to any vertical position without the
  // default silently winning via CSS source order.
  const sectionClass = className ?? 'mt-8';
  return (
    <section className={sectionClass}>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
              {eyebrow}
            </div>
          )}
          <h2 className="text-[20px] font-extrabold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
