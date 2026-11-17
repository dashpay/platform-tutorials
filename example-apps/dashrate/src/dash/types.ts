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
  toJSON?: (platformVersion?: number) => Record<string, unknown>;
  [key: string]: unknown;
}

export type DashReviewQueryResults =
  | DashReviewQueryDocument[]
  | Map<string, DashReviewQueryDocument | undefined>
  | Record<string, DashReviewQueryDocument | undefined>;

/** Which aggregate a `ranked` / `having` query groups by. */
export type DashAggregateSelect =
  | { type: "count" }
  | { type: "sum"; property: string }
  | { type: "avg"; property: string };

/**
 * One group of a `ranked` / `having` result. `value` is the raw aggregate:
 * a count/sum as-is, an average as FIXED-POINT (value / valueScale,
 * truncated). `valueAsNumber` is that already divided — use it for display.
 */
export interface DashGroupEntry {
  groupKeyHex: string;
  groupValue: unknown;
  value: bigint;
  valueAsNumber: number;
  /** 0-based absolute rank; `ranked` only. */
  rank?: bigint;
}

export interface DashGroupedResult {
  entries: DashGroupEntry[];
  aggregate: "count" | "sum" | "avg";
  groupBy: string;
  valueScale: bigint;
  /** `ranked` only. */
  startingRank?: bigint;
}

interface DashGroupedQueryBase {
  dataContractId: string;
  documentTypeName: string;
  groupBy: string;
  aggregate: DashAggregateSelect;
  /** Required; 1 ≤ limit ≤ 100 (a hard ceiling — larger is rejected). */
  limit: number;
  direction?: "asc" | "desc";
}

export interface DashSdk {
  /** Platform protocol version negotiated with the network. */
  version(): number;
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
    }): Promise<DashReviewQueryResults>;
    count(args: {
      dataContractId: string;
      documentTypeName: string;
      where?: unknown[][];
      orderBy?: [string, "asc" | "desc"][];
      groupBy?: string[];
    }): Promise<Map<string, bigint>>;
    sum(
      args: {
        dataContractId: string;
        documentTypeName: string;
        where?: unknown[][];
        orderBy?: [string, "asc" | "desc"][];
      },
      sumProperty: string,
    ): Promise<Map<string, bigint>>;
    average(
      args: {
        dataContractId: string;
        documentTypeName: string;
        where?: unknown[][];
        orderBy?: [string, "asc" | "desc"][];
      },
      averageProperty: string,
    ): Promise<Map<string, { count: bigint; sum: bigint }>>;
    ranked(
      args: DashGroupedQueryBase & { offset?: number },
    ): Promise<DashGroupedResult>;
    having(
      args: DashGroupedQueryBase & {
        having:
          | {
              operator: "==" | ">" | ">=" | "<" | "<=";
              value: number | bigint;
            }
          | {
              operator: "between";
              value: [number | bigint, number | bigint];
            };
      },
    ): Promise<DashGroupedResult>;
    get(
      contractId: string,
      documentTypeName: string,
      documentId: string,
    ): Promise<DashDocumentLike | undefined>;
    history(args: {
      dataContractId: string;
      documentTypeName: string;
      documentId: string;
      startAtMs?: number;
      limit?: number;
    }): Promise<Map<bigint, DashDocumentLike>>;
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
  };
  identities: {
    nonce(identityId: string): Promise<bigint | null | undefined>;
  };
  dpns: {
    username(identityId: string): Promise<string | null | undefined>;
  };
  getWasmSdkConnected?: () => Promise<{
    removeCachedContract(contractId: { free?: () => void }): boolean;
  }>;
}

export interface DashReviewQueryJson extends Record<string, unknown> {
  $id?: string;
  id?: string;
  $ownerId?: string;
  $createdAt?: number | string | bigint;
  $updatedAt?: number | string | bigint;
  $revision?: number | string | bigint;
  resourceId?: string;
  rating?: number | string | bigint;
  reviewText?: string | null;
}

export interface DashReviewQueryDocument extends Record<string, unknown> {
  revision?: number | string | bigint;
  toJSON?: () => DashReviewQueryJson;
}
