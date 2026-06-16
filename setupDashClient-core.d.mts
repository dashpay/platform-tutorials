import type {
  DataContract,
  EvoSDK,
  Identity,
  IdentityPublicKey,
  IdentitySigner,
  PlatformAddress,
  PlatformAddressInfo,
  PlatformAddressSigner,
} from "@dashevo/evo-sdk";

interface AddressEntry {
  address: PlatformAddress;
  bech32m: string;
  privateKeyWif: string;
  path: string;
}

interface ConnectedDocumentLike {
  revision?: bigint | number | string;
  toJSON?: () => Record<string, unknown>;
  [key: string]: unknown;
}

interface ConnectedDocumentTokenPaymentInfo {
  paymentTokenContractId?: string;
  tokenContractPosition: number;
  minimumTokenCost?: bigint;
  maximumTokenCost?: bigint;
  gasFeesPaidBy?:
    | "documentOwner"
    | "contractOwner"
    | "preferContractOwner"
    | 0
    | 1
    | 2;
}

export interface ConnectedDashClientLike {
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
      tokenPaymentInfo?: ConnectedDocumentTokenPaymentInfo;
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
    balance(identityId: string): Promise<bigint>;
  };
  tokens: {
    calculateId(contractId: string, tokenPosition: number): Promise<string>;
    identityBalances(
      identityId: string,
      tokenIds: string[],
    ): Promise<Map<string, bigint>>;
    totalSupply(
      tokenId: string,
    ): Promise<{ totalSupply: bigint; tokenId: string } | undefined>;
    statuses(tokenIds: string[]): Promise<Map<string, unknown>>;
    contractInfo(contractId: string): Promise<unknown>;
    mint(args: {
      dataContractId: string;
      tokenPosition: number;
      amount: bigint;
      identityId: string;
      recipientId?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    burn(args: {
      dataContractId: string;
      tokenPosition: number;
      amount: bigint;
      identityId: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
    transfer(args: {
      dataContractId: string;
      tokenPosition: number;
      amount: bigint;
      senderId: string;
      recipientId: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<unknown>;
  };
  dpns: {
    username(identityId: string): Promise<string | null | undefined>;
    resolveName(name: string): Promise<string | null | undefined>;
  };
}

// `sdk` is intentionally `unknown`, not `EvoSDK`: this core is transitional
// scaffolding meant to be removed once the SDK provides key management
// directly, so the seam is kept loose — example apps pass either the full
// EvoSDK or a narrowed local shape without a lockstep type change here. The
// implementation JSDoc documents the runtime expectation as EvoSDK.
export declare class IdentityKeyManager {
  static create(opts: {
    sdk: unknown;
    identityId?: string;
    mnemonic: string;
    network?: string;
    identityIndex?: number;
  }): Promise<IdentityKeyManager>;
  static createForNewIdentity(opts: {
    sdk: unknown;
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
  getTransfer(): Promise<{
    identity: Identity;
    identityKey: IdentityPublicKey | undefined;
    signer: IdentitySigner;
  }>;
}

export declare class AddressKeyManager {
  static create(opts: {
    sdk: unknown;
    mnemonic: string;
    network?: string;
    count?: number;
  }): Promise<AddressKeyManager>;
  readonly addresses: AddressEntry[];
  readonly primaryAddress: AddressEntry;
  getSigner(): PlatformAddressSigner;
  getFullSigner(): PlatformAddressSigner;
  getInfo(): Promise<PlatformAddressInfo | undefined>;
  getInfoAt(index: number): Promise<PlatformAddressInfo | undefined>;
}

export declare const KEY_SPECS: readonly unknown[];

export declare const PLATFORM_VERSION_OVERRIDE: number;

export declare function dip13KeyPath(
  network: string,
  identityIndex: number,
  keyIndex: number,
): Promise<string>;

export declare function createClient(
  network?: string,
): Promise<ConnectedDashClientLike & EvoSDK>;
