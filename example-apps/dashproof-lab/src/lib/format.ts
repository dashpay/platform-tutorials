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
