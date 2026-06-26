/**
 * Mobile-nav hamburger button.
 *
 * Used in the page header of every authenticated page. Dispatches a global
 * `openMobileNav` event that the persistent <Navigation /> component listens
 * for, so each page just renders the button and doesn't need to know how
 * the nav drawer is wired up.
 *
 * Accepts an optional `className` that is merged with the default Tailwind
 * styling for layout/visibility tweaks.
 */
export default function HamburgerBtn({ className = '' }) {
  const baseClass =
    'hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-white/[0.05] p-1 text-ink-primary md:flex';

  return (
    <button
      type="button"
      className={className ? `${baseClass} ${className}` : baseClass}
      onClick={() => window.dispatchEvent(new Event('openMobileNav'))}
      aria-label="Open navigation"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}
