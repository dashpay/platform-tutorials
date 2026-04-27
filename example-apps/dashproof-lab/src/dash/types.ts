import type {
  Identity,
  IdentityPublicKey,
  IdentitySigner,
} from "@dashevo/evo-sdk";

export interface DashAuth {
  identity: Identity;
  identityKey: IdentityPublicKey | undefined;
  signer: IdentitySigner;
}

export interface DashKeyManager {
  readonly identityId: string | null | undefined;
  getAuth(): Promise<DashAuth>;
}

export interface DashSdk {
  contracts: {
    fetch(contractId: string): Promise<{
      toJSON?: () => Record<string, unknown>;
      [key: string]: unknown;
    } | null>;
    publish(args: {
      dataContract: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<{
      id?: string | { toString(): string };
      toJSON?: () => { id?: string };
    }>;
  };
  documents: {
    query(args: {
      dataContractId: string;
      documentTypeName: string;
      where?: unknown[][];
      orderBy?: [string, "asc" | "desc"][];
      limit?: number;
      startAfter?: string;
    }): Promise<DashAnchorQueryResults>;
    create(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
  };
  identities: {
    nonce(identityId: string): Promise<bigint | null | undefined>;
  };
  dpns: {
    username(identityId: string): Promise<string | null | undefined>;
    resolveName(name: string): Promise<string | null | undefined>;
  };
  getWasmSdkConnected?: () => Promise<{
    removeCachedContract(contractId: { free?: () => void }): boolean;
  }>;
}

export interface DashAnchorQueryJson extends Record<string, unknown> {
  $id?: string;
  id?: string;
  $ownerId?: string;
  $createdAt?: number | string | bigint;
  entryHash?: unknown;
  chainId?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  note?: string;
  previousId?: unknown;
}

export interface DashAnchorQueryDocument extends Record<string, unknown> {
  toJSON?: () => DashAnchorQueryJson;
}

export type DashAnchorQueryResults =
  | DashAnchorQueryDocument[]
  | Map<string, DashAnchorQueryDocument>
  | Record<string, DashAnchorQueryDocument>;
