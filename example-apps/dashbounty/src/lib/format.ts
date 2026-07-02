export function shortId(id: string | null | undefined, len = 6): string {
  if (!id) return "—";
  return id.length <= len * 2 + 1
    ? id
    : `${id.slice(0, len)}…${id.slice(-len)}`;
}

export function formatDate(
  value: bigint | number | string | undefined,
): string {
  if (value == null) return "—";
  const ms = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

export function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
