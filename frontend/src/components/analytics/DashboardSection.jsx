/**
 * Section header + content slot used across the dashboard and analytics
 * pages. Eyebrow is the small uppercase tag above the title; action is
 * an optional right-aligned control (button, link, badge).
 *
 * Default top spacing is `mt-8` (32px). `className` *replaces* the
 * default entirely — pass `className="mt-0"` to sit flush against the
 * previous section, `className="mt-10"` to override the rhythm, etc.
 * The replacement semantics are intentional (vs. appending) so an
 * override isn't silently defeated by Tailwind's CSS source order.
 */
export default function DashboardSection({
  title,
  eyebrow,
  action,
  children,
  className,
}) {
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
