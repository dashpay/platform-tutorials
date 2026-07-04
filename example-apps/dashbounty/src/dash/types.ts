import type {
  GroupAction,
  GroupStateTransitionInfoStatus,
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

export interface DashDocumentTokenPaymentInfo {
  paymentTokenContractId?: string;
  tokenContractPosition: number;
  minimumTokenCost?: bigint;
  maximumTokenCost?: bigint;
  gasFeesPaidBy?:
    "documentOwner" | "contractOwner" | "preferContractOwner" | 0 | 1 | 2;
}

export interface DashContractLike {
  version?: number;
  groups?: Record<
    number,
    { members: Map<string, number>; requiredPower: number }
  >;
  tokens?: Record<number, { mainControlGroup?: number }>;
  toJSON?: () => Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Result shape shared by tokens.freeze / .unfreeze / .destroyFrozen.
 *
 * `groupPower` is present while a group action is still accumulating
 * signatures (proposer's call, or a co-signer's call that didn't yet reach
 * `requiredPower`). `document` is present once the action has executed.
 * Branch UI logic on which field is present rather than re-querying.
 */
export interface DashTokenGroupActionResult {
  groupPower?: number;
  document?: unknown;
}

export interface DashSdk {
  contracts: {
    fetch(contractId: string): Promise<DashContractLike | undefined>;
    publish(args: {
      dataContract: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<{
      id?: string | { toString(): string };
      toJSON?: () => { id?: string };
    }>;
    update(args: {
      dataContract: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<void>;
  };
  documents: {
    query(args: {
      dataContractId: string;
      documentTypeName: string;
      where?: unknown[][];
      orderBy?: unknown[][];
      limit?: number;
    }): Promise<DashReportQueryResults>;
    get(
      contractId: string,
      documentTypeName: string,
      documentId: string,
    ): Promise<DashDocumentLike | undefined>;
    create(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      tokenPaymentInfo?: DashDocumentTokenPaymentInfo;
    }): Promise<unknown>;
    replace(args: {
      document: unknown;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
    }): Promise<void>;
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
    identityTokenInfos(
      identityId: string,
      tokenIds: string[],
    ): Promise<Map<string, { isFrozen: boolean }>>;
    totalSupply(
      tokenId: string,
    ): Promise<{ totalSupply: bigint; tokenId: string } | undefined>;
    mint(args: {
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
    freeze(args: {
      dataContractId: string;
      tokenPosition: number;
      authorityId: string;
      frozenIdentityId: string;
      publicNote?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      groupInfo?: GroupStateTransitionInfoStatus;
    }): Promise<DashTokenGroupActionResult>;
    unfreeze(args: {
      dataContractId: string;
      tokenPosition: number;
      authorityId: string;
      frozenIdentityId: string;
      publicNote?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      groupInfo?: GroupStateTransitionInfoStatus;
    }): Promise<DashTokenGroupActionResult>;
    destroyFrozen(args: {
      dataContractId: string;
      tokenPosition: number;
      authorityId: string;
      frozenIdentityId: string;
      publicNote?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      groupInfo?: GroupStateTransitionInfoStatus;
    }): Promise<DashTokenGroupActionResult>;
    configUpdate(args: {
      dataContractId: string;
      tokenPosition: number;
      identityId: string;
      /** Built via TokenConfigurationChangeItem static methods. */
      configurationChangeItem: unknown;
      publicNote?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      groupInfo?: GroupStateTransitionInfoStatus;
    }): Promise<DashTokenGroupActionResult>;
  };
  group: {
    info(
      contractId: string,
      groupContractPosition: number,
    ): Promise<
      { members: Map<string, number>; requiredPower: number } | undefined
    >;
    members(args: {
      dataContractId: string;
      groupContractPosition: number;
    }): Promise<Map<string, bigint>>;
    actions(args: {
      dataContractId: string;
      groupContractPosition: number;
      status: "ACTIVE" | "CLOSED";
      startAt?: unknown;
      limit?: number;
    }): Promise<Map<string, GroupAction | undefined>>;
    actionSigners(args: {
      dataContractId: string;
      groupContractPosition: number;
      status: "ACTIVE" | "CLOSED";
      actionId: string;
    }): Promise<Map<string, bigint>>;
  };
  dpns: {
    username(identityId: string): Promise<string | null | undefined>;
  };
}

export interface DashReportQueryJson extends Record<string, unknown> {
  $id?: string;
  id?: string;
  $ownerId?: string;
  $revision?: bigint | number | string;
  $createdAt?: bigint | number | string;
  title?: string;
  severity?: string;
  component?: string;
  description?: string;
  pocHash?: string;
}

export interface DashReportQueryDocument extends Record<string, unknown> {
  toJSON?: () => DashReportQueryJson;
}

export type DashReportQueryResults =
  | DashReportQueryDocument[]
  | Map<string, DashReportQueryDocument>
  | Record<string, DashReportQueryDocument>;
