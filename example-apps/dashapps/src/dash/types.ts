export type Network = "testnet" | "mainnet";
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
  identities: {
    fetch(identityId: string): Promise<Identity | null | undefined>;
    byPublicKeyHash(
      publicKeyHash: Uint8Array,
    ): Promise<Identity | null | undefined>;
    byNonUniquePublicKeyHash?(
      publicKeyHash: Uint8Array,
      startAfter?: string,
    ): Promise<Identity[]>;
  };
}
export interface ContractHandle {
  ownerId: unknown;
  version: number;
  readonly schemas: Record<string, object>;
  toObject(protocolVersion: number): unknown;
}
export type WhereClause =
  | [string, "==" | "startsWith" | ">=" | "<=", string | number]
  | [string, "between", [number, number]]
  | [string, "in", string[]];
export type AggregateSelect =
  { type: "count" } | { type: "avg"; property: string };
/** One group of a `ranked` / `having` result; `groupValue` is base58 for identifiers. */
export interface GroupEntry {
  groupKeyHex: string;
  groupValue: unknown;
  value: bigint;
  valueAsNumber: number;
  rank?: bigint;
}
export interface GroupedResult {
  entries: GroupEntry[];
  valueScale: bigint;
  startingRank?: bigint;
}
interface GroupedQuery {
  dataContractId: string;
  documentTypeName: string;
  groupBy: string;
  aggregate: AggregateSelect;
  limit: number;
  direction?: "asc" | "desc";
}
export interface ReadSdk {
  version(): number;
  dpns: { username(id: string): Promise<string | undefined> };
  contracts: {
    getMany(ids: string[]): Promise<Map<string, ContractHandle | undefined>>;
  };
  documents: {
    query(args: {
      dataContractId: string;
      documentTypeName: string;
      where: WhereClause[];
      orderBy?: [string, "asc" | "desc"][];
      limit: number;
      startAfter?: string;
    }): Promise<unknown>;
    /**
     * Provable document count. Ungrouped results are a one-entry map keyed
     * `""`; grouped results are keyed by the hex of the grouped property's
     * order-preserving index-key bytes, not by its value.
     */
    count(args: {
      dataContractId: string;
      documentTypeName: string;
      where: WhereClause[];
      orderBy?: [string, "asc" | "desc"][];
      groupBy?: string[];
    }): Promise<Map<string, bigint>>;
    /** Proven count and sum per group, keyed like `count`. */
    average(
      args: {
        dataContractId: string;
        documentTypeName: string;
        where: WhereClause[];
        orderBy?: [string, "asc" | "desc"][];
        groupBy?: string[];
      },
      averageProperty: string,
    ): Promise<Map<string, { count: bigint; sum: bigint }>>;
    ranked(args: GroupedQuery & { offset?: number }): Promise<GroupedResult>;
    having(
      args: GroupedQuery & {
        having: { operator: ">=" | ">" | "<=" | "<" | "=="; value: number };
      },
    ): Promise<GroupedResult>;
  };
}
export type Resolution =
  | { status: "found"; ownerId: string; contract: ContractHandle }
  | { status: "missing" }
  | { status: "error"; error: Error };
