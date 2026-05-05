export const FIELD_BYTE_LIMIT = 5120;

const encoder = new TextEncoder();

export function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function isOversize(value: string): boolean {
  return byteLength(value) > FIELD_BYTE_LIMIT;
}
