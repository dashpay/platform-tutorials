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
  id?: string | { toString(): string };
  ownerId?: string | { toString(): string };
  $ownerId?: string | { toString(): string };
  groups?:
    | Record<number, { members: Map<string, number>; requiredPower: number }>
    | Map<number, { members: Map<string, number>; requiredPower: number }>;
  tokens?:
    | Record<number, Record<string, unknown>>
    | Map<number, Record<string, unknown>>;
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
  groupActionStatus?: string;
  document?: unknown;
  newBalance?: bigint;
  pricingSchedule?: unknown;
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
  documents?: Record<string, unknown>;
  identities: {
    byPublicKeyHash(publicKeyHash: unknown): Promise<Identity | undefined>;
    byNonUniquePublicKeyHash?(
      publicKeyHash: unknown,
      startAfter?: unknown,
    ): Promise<Identity[]>;
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
    statuses(tokenIds: string[]): Promise<Map<string, { isPaused: boolean }>>;
    /**
     * Reverse of calculateId: given a token ID, returns the contract that
     * defines it and the token's position within that contract. Resolves to
     * `undefined` when the ID is not a token ID (e.g. a data contract ID).
     * `contractId` is an SDK identifier — stringify before use.
     */
    contractInfo(tokenId: string): Promise<
      | {
          contractId: string | { toString(): string };
          tokenContractPosition: number;
        }
      | undefined
    >;
    mint(args: {
      dataContractId: string;
      tokenPosition: number;
      amount: bigint;
      identityId: string;
      recipientId?: string;
      publicNote?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      groupInfo?: GroupStateTransitionInfoStatus;
    }): Promise<DashTokenGroupActionResult>;
    burn(args: {
      dataContractId: string;
      tokenPosition: number;
      amount: bigint;
      identityId: string;
      publicNote?: string;
      identityKey: IdentityPublicKey | undefined;
      signer: IdentitySigner;
      groupInfo?: GroupStateTransitionInfoStatus;
    }): Promise<unknown>;
    transfer(args: {
      dataContractId: string;
      tokenPosition: number;
      amount: bigint;
      senderId: string;
      recipientId: string;
      publicNote?: string;
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
    emergencyAction(args: {
      dataContractId: string;
      tokenPosition: number;
      authorityId: string;
      action: "pause" | "resume";
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
