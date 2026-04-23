/** Truncate a long identifier for display. */
export function truncateId(id: string | null | undefined, n = 8): string {
  if (!id) return "—";
  if (id.length <= n * 2) return id;
  return `${id.slice(0, n)}…${id.slice(-6)}`;
}

/** Truncate a DPNS username for display (middle-ellipsis). */
export function truncateName(name: string, max = 16): string {
  if (name.length <= max) return name;
  const tail = 4;
  const head = max - tail - 1; // 1 for the ellipsis
  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}

/** Format a credit amount with thousands separators. */
export function formatCredits(price: number | bigint | undefined): string {
  if (price === undefined || price === null) return "";
  const n = typeof price === "bigint" ? price : BigInt(Math.trunc(price));
  return n.toLocaleString();
}
