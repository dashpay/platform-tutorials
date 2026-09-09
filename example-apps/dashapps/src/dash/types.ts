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
      where: [string, "==" | "startsWith" | ">=" | "<=", string | number][];
      orderBy?: [string, "asc" | "desc"][];
      limit: number;
      startAfter?: string;
    }): Promise<unknown>;
  };
}
export type Resolution =
  | { status: "found"; ownerId: string; contract: ContractHandle }
  | { status: "missing" }
  | { status: "error"; error: Error };
