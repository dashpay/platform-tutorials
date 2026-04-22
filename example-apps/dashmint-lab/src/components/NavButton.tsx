/**
 * Full-width navigation button for the left sidebar.
 * Active state shows a 2px amber left rail + surface-2 background.
 */
interface NavButtonProps {
  label: string
  glyph: string
  active: boolean
  onClick: () => void
}

export function NavButton({ label, glyph, active, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-[background,color] duration-[120ms] ${
        active
          ? 'bg-surface-2 text-ink'
          : 'bg-transparent text-ink-3 hover:text-ink-2'
      }`}
    >
      {active && (
        <span className="absolute top-2 bottom-2 left-1.5 w-0.5 rounded-sm bg-accent" />
      )}
      <span
        className={`w-3.5 text-center text-sm ${
          active ? 'text-accent' : 'text-ink-4'
        }`}
      >
        {glyph}
      </span>
      {label}
    </button>
  )
}
