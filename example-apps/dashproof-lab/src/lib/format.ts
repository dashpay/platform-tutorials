export function truncateId(id: string | null | undefined, head = 10): string {
  if (!id) return "—";
  if (id.length <= head * 2) return id;
  return `${id.slice(0, head)}…${id.slice(-8)}`;
}

export function formatBytes(size: number | null | undefined): string {
  if (size === null || size === undefined || Number.isNaN(size)) return "—";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
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
  const diffSec = (timestamp - fromNow) / 1000;
  let value = diffSec;
  for (const div of RELATIVE_DIVISIONS) {
    if (Math.abs(value) < div.amount) {
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
      return rtf.format(Math.round(value), div.name);
    }
    value /= div.amount;
  }
  return "";
}

export function formatTimespan(ms: number): string {
  const days = ms / (24 * 60 * 60 * 1000);
  if (days < 1) {
    const hours = ms / (60 * 60 * 1000);
    return `${hours.toFixed(0)}h`;
  }
  if (days < 60) return `${days.toFixed(0)}d`;
  const months = days / 30.44;
  return `${months.toFixed(0)}mo`;
}

export function shortMimeLabel(mime: string | null | undefined): string {
  if (!mime) return "FILE";
  const map: Record<string, string> = {
    "text/plain": "TXT",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/pdf": "PDF",
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  };
  if (map[mime]) return map[mime];
  const tail = mime.split("/").pop() ?? mime;
  return tail.toUpperCase().slice(0, 6);
}

export function formatHashBlocks(
  value: string | null | undefined,
  blockSize = 8,
  blocksPerLine = 4,
): string {
  if (!value) return "—";

  const blocks: string[] = [];
  for (let index = 0; index < value.length; index += blockSize) {
    blocks.push(value.slice(index, index + blockSize));
  }

  const lines: string[] = [];
  for (let index = 0; index < blocks.length; index += blocksPerLine) {
    lines.push(blocks.slice(index, index + blocksPerLine).join(" "));
  }

  return lines.join("\n");
}
