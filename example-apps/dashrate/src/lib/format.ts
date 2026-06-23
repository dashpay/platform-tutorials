export function formatAverage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

export function formatDate(value: number | null): string {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function shortId(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 7)}...${value.slice(-6)}`;
}
