import type {
  DataContract,
  Identity,
  IdentityPublicKey,
  IdentitySigner,
} from "@dashevo/evo-sdk";

interface ConnectedDocumentLike {
  revision?: bigint | number | string;
  toJSON?: () => Record<string, unknown>;
  [key: string]: unknown;
}

interface ConnectedDashClientLike {
  contracts: {
    fetch(contractId: string): Promise<{
      toJSON?: () => Record<string, unknown>;
      [key: string]: unknown;
    } | null>;
    publish(args: {
      dataContract: DataContract;
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
    }): Promise<
      | ConnectedDocumentLike[]
      | Map<string, ConnectedDocumentLike>
      | Record<string, ConnectedDocumentLike>
    >;
    get(
      contractId: string,
      documentTypeName: string,
      documentId: string,
    ): Promise<ConnectedDocumentLike>;
    create(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    transfer(args: {
      document: ConnectedDocumentLike | undefined;
      recipientId: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    setPrice(args: {
      document: ConnectedDocumentLike | undefined;
      price: bigint;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    purchase(args: {
      document: ConnectedDocumentLike | undefined;
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

export declare class IdentityKeyManager {
  static create(opts: {
    sdk: ConnectedDashClientLike;
    identityId?: string;
    mnemonic: string;
    network?: string;
    identityIndex?: number;
  }): Promise<IdentityKeyManager>;
  readonly identityId: string | null | undefined;
  getAuth(): Promise<{
    identity: Identity;
    identityKey: IdentityPublicKey | undefined;
    signer: IdentitySigner;
  }>;
}

export declare function createClient(
  network?: string,
): Promise<ConnectedDashClientLike>;
