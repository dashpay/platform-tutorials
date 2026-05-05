export function truncateId(
  id: string | null | undefined,
  head = 10,
  tail = 8,
): string {
  if (!id) return "—";
  if (id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return "Pending";
  return new Date(timestamp).toLocaleString();
}

export function formatCompactTimestamp(
  timestamp: number | null | undefined,
): string {
  if (!timestamp) return "Pending";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const RELATIVE_DIVISIONS: Array<{
  amount: number;
  name: Intl.RelativeTimeFormatUnit;
}> = [
  { amount: 60, name: "second" },
  { amount: 60, name: "minute" },
  { amount: 24, name: "hour" },
  { amount: 7, name: "day" },
  { amount: 4.34524, name: "week" },
  { amount: 12, name: "month" },
  { amount: Number.POSITIVE_INFINITY, name: "year" },
];

export function formatRelativeTime(
  timestamp: number | null | undefined,
  fromNow: number = Date.now(),
): string {
  if (!timestamp) return "Pending";
  let value = (timestamp - fromNow) / 1000;
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(value) < division.amount) {
      return relativeTimeFormatter.format(Math.round(value), division.name);
    }
    value /= division.amount;
  }
  return "";
}

export function noteDisplayTitle({
  title,
  message,
}: {
  title?: string | null;
  message?: string | null;
}): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle;
  const firstBodyLine =
    message
      ?.split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  return firstBodyLine || "Untitled";
}

export function notePreview(message: string | null | undefined): string {
  const trimmed = message?.trim();
  if (!trimmed) return "Empty note";
  return trimmed.replace(/\s+/g, " ").slice(0, 140);
}
