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

export interface DashDocumentLike {
  revision?: bigint | number | string;
  toJSON?: () => Record<string, unknown>;
  [key: string]: unknown;
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
    }): Promise<DashNoteQueryResults>;
    get(
      contractId: string,
      documentTypeName: string,
      documentId: string,
    ): Promise<DashDocumentLike | undefined>;
    create(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    replace(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    delete(args: {
      document: {
        id: string;
        ownerId: Identity["id"] | string;
        dataContractId: string;
        documentTypeName: string;
      };
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

export interface DashNoteQueryJson extends Record<string, unknown> {
  $id?: string;
  id?: string;
  $ownerId?: string;
  $createdAt?: number | string | bigint;
  $updatedAt?: number | string | bigint;
  $revision?: number | string | bigint;
  title?: string | null;
  message?: string;
}

export interface DashNoteQueryDocument extends Record<string, unknown> {
  revision?: number | string | bigint;
  toJSON?: () => DashNoteQueryJson;
}

export type DashNoteQueryResults =
  | DashNoteQueryDocument[]
  | Map<string, DashNoteQueryDocument | undefined>
  | Record<string, DashNoteQueryDocument | undefined>;
