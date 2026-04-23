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
      limit?: number;
    }): Promise<DashCardQueryResults>;
    get(
      contractId: string,
      documentTypeName: string,
      documentId: string,
    ): Promise<DashDocumentLike>;
    create(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    transfer(args: {
      document: DashDocumentLike | undefined;
      recipientId: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    setPrice(args: {
      document: DashDocumentLike | undefined;
      price: bigint;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    purchase(args: {
      document: DashDocumentLike | undefined;
      buyerId: Identity["id"];
      price: bigint;
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
  };
}

export interface DashCardQueryJson extends Record<string, unknown> {
  $id?: string;
  id?: string;
  $ownerId?: string;
  name?: string;
  description?: string;
  attack?: number;
  defense?: number;
  $price?: number | bigint;
}

export interface DashCardQueryDocument extends Record<string, unknown> {
  toJSON?: () => DashCardQueryJson;
}

export interface DashCardDocument extends DashDocumentLike {
  revision: bigint | number | string;
}

export type DashCardQueryResults =
  | DashCardQueryDocument[]
  | Map<string, DashCardQueryDocument>
  | Record<string, DashCardQueryDocument>;
