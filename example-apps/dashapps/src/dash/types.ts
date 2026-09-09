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
  | [string, "between", [number, number]];
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
  };
}
export type Resolution =
  | { status: "found"; ownerId: string; contract: ContractHandle }
  | { status: "missing" }
  | { status: "error"; error: Error };
