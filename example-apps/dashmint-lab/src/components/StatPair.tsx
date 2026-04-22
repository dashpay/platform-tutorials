/**
 * ATK / DEF stat display with eyebrow labels, mono digits, and progress bars.
 * Replaces the old emoji-based (⚔️/🛡️) stat grid.
 */

interface StatPairProps {
  atk: number
  def: number
}

function StatColumn({
  label,
  value,
  barColor,
}: {
  label: string
  value: number
  barColor: string
}) {
  const pct = `${Math.min(100, (Math.min(10, value) / 10) * 100)}%`

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          {label}
        </span>
        <span className="font-mono text-[20px] font-semibold leading-none text-ink">
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-[3px] rounded-sm bg-line">
        <div
          className="h-full rounded-sm transition-[width] duration-200"
          style={{ width: pct, background: barColor }}
        />
      </div>
    </div>
  )
}

export function StatPair({ atk, def }: StatPairProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatColumn
        label="ATK"
        value={atk}
        barColor="var(--color-accent)"
      />
      <StatColumn
        label="DEF"
        value={def}
        barColor="var(--color-ink-2)"
      />
    </div>
  )
}
