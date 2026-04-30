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

/**
 * Compact credit formatter for tight UI (card chips, badges).
 * Up to 9,999,999 renders with thousands separators; beyond that it
 * collapses to K / M / B / T / Q with one decimal of precision.
 *
 * Precondition: `price` is non-negative. Platform credit prices cannot be
 * negative, so this helper does not handle the sign — a large negative
 * value would skip the compact branch and render as a long string.
 */
export function formatCreditsCompact(
  price: number | bigint | undefined,
): string {
  if (price === undefined || price === null) return "";
  const n = typeof price === "bigint" ? price : BigInt(Math.trunc(price));
  if (n < 10_000_000n) return n.toLocaleString();

  const units: Array<[bigint, string]> = [
    [1_000_000_000_000_000n, "Q"],
    [1_000_000_000_000n, "T"],
    [1_000_000_000n, "B"],
    [1_000_000n, "M"],
    [1_000n, "K"],
  ];
  for (const [scale, suffix] of units) {
    if (n >= scale) {
      // One decimal of precision via integer math, then trim a trailing ".0".
      const tenths = (n * 10n) / scale;
      const whole = tenths / 10n;
      const frac = tenths % 10n;
      const body =
        frac === 0n
          ? whole.toLocaleString()
          : `${whole.toLocaleString()}.${frac}`;
      return `${body}${suffix}`;
    }
  }
  return n.toLocaleString();
}
