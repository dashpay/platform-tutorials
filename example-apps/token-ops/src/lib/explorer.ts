const EXPLORER_BASE = "https://testnet.platform-explorer.com";

export type ExplorerKind = "identity" | "dataContract" | "token" | "document";

export function explorerUrl(kind: ExplorerKind, id: string): string {
  return `${EXPLORER_BASE}/${kind}/${id}`;
}
