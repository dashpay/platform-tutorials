const EXPLORER_BASE = "https://testnet.platform-explorer.com";

export type ExplorerKind = "identity" | "dataContract" | "token" | "document";

export function explorerUrl(kind: ExplorerKind, id: string): string {
  return `${EXPLORER_BASE}/${kind}/${id}`;
}

export function identityUrl(identityId: string): string {
  return explorerUrl("identity", identityId);
}

export function contractUrl(contractId: string): string {
  return explorerUrl("dataContract", contractId);
}

export function tokenUrl(tokenId: string): string {
  return explorerUrl("token", tokenId);
}
