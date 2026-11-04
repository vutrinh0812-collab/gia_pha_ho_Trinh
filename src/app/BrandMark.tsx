/** The clan mark: an ancestor dot, a trunk and three descendants (original drawing). */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M16 9.5v6M8 21v-5.5h16V21M16 15.5V21"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="7" r="3" fill="currentColor" />
      <circle cx="8" cy="23.5" r="2.5" fill="currentColor" />
      <circle cx="16" cy="23.5" r="2.5" fill="currentColor" />
      <circle cx="24" cy="23.5" r="2.5" fill="currentColor" />
    </svg>
  );
}
