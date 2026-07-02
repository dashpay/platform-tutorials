/**
 * Client-side SHA-256 hashing for the optional PoC-file evidence field.
 *
 * Only `pocHash` needs this — it's an optional base64 string property, not
 * a byteArray, and it's never indexed/queried by exact match, so none of
 * dashproof-lab's byteArray-index workarounds apply here.
 */
export async function hashFile(file: File): Promise<Uint8Array> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error(
      "SHA-256 hashing requires a secure context. Open this app over HTTPS or via http://localhost — the browser disables crypto.subtle on plain http:// origins.",
    );
  }
  const buffer =
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
