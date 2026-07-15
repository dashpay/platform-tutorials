export function shortId(id: string | null | undefined, len = 6): string {
  if (!id) return "—";
  return id.length <= len * 2 + 1
    ? id
    : `${id.slice(0, len)}…${id.slice(-len)}`;
}
