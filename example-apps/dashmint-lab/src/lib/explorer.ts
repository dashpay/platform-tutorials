const EXPLORER_BASE = "https://testnet.platform-explorer.com";

export function identityUrl(identityId: string): string {
  return `${EXPLORER_BASE}/identity/${identityId}`;
}

export function documentUrl(documentId: string): string {
  return `${EXPLORER_BASE}/document/${documentId}`;
}
