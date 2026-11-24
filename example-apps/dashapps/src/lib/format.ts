export function formatAverage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  return value.toFixed(1);
}

export function pluralize(count: bigint | number, noun: string): string {
  const n = typeof count === "bigint" ? count : BigInt(Math.trunc(count));
  return `${n.toString()} ${noun}${n === 1n ? "" : "s"}`;
}

const UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60_000, "minute"],
  [3_600_000, "hour"],
  [86_400_000, "day"],
  [604_800_000, "week"],
  [2_629_800_000, "month"],
  [31_557_600_000, "year"],
];

/** "3 days ago" style label for a millisecond timestamp. */
export function timeAgo(
  value: bigint | number | undefined,
  now = Date.now(),
): string {
  if (value === undefined) return "Date not provided";
  const at = Number(value);
  if (!Number.isFinite(at)) return "Date not provided";
  const elapsed = now - at;
  if (elapsed < 0) return new Date(at).toLocaleDateString();
  if (elapsed < UNITS[0][0]) return "just now";
  let chosen = UNITS[0];
  for (const unit of UNITS) if (elapsed >= unit[0]) chosen = unit;
  return new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(
    -Math.floor(elapsed / chosen[0]),
    chosen[1],
  );
}
