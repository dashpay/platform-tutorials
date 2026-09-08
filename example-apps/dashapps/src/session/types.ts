import type { IdentityKeyManager } from "../../../../setupDashClient-core.mjs";
import type {
  DataContract,
  Document,
  IdentityPublicKey,
  IdentitySigner,
} from "@dashevo/evo-sdk";
import type { ReadSdk, Network } from "../dash/types";
import type { OwnerResolver } from "../dash/ownerResolver";
import type { NameResolver } from "../dash/resolveDpnsName";
export interface SessionSdk extends ReadSdk {
  identities: {
    balance(id: string): Promise<bigint>;
    nonce(id: string): Promise<bigint | number | undefined>;
  };
  contracts: ReadSdk["contracts"] & {
    publish(options: {
      dataContract: DataContract;
      identityKey: IdentityPublicKey;
      signer: IdentitySigner;
    }): Promise<DataContract>;
  };
  documents: ReadSdk["documents"] & {
    get(
      contractId: string,
      type: string,
      documentId: string,
    ): Promise<Document | undefined>;
    create(options: {
      document: Document;
      identityKey: IdentityPublicKey;
      signer: IdentitySigner;
    }): Promise<unknown>;
    replace(options: {
      document: Document;
      identityKey: IdentityPublicKey;
      signer: IdentitySigner;
    }): Promise<unknown>;
    delete(options: {
      document: Document;
      identityKey: IdentityPublicKey;
      signer: IdentitySigner;
    }): Promise<unknown>;
  };
  getWasmSdkConnected?(): Promise<{
    removeCachedContract?(id: unknown): unknown;
  }>;
}
export interface Connection {
  sdk: SessionSdk;
  resolver: OwnerResolver;
  names: NameResolver;
}
export interface SessionState {
  network: Network;
  status: "connecting" | "readonly" | "authenticated" | "error";
  connection: Connection | null;
  keyManager: IdentityKeyManager | null;
  identityId: string | null;
  identityName: string | null;
  balance: bigint | null;
  error: string | null;
}
export interface SessionValue extends SessionState {
  connectionGeneration: number;
  registryGeneration: number;
  registryId: string;
  setRegistryId(id: string): boolean;
  setNetwork(network: Network): void;
  reconnect(): void;
  login(mnemonic: string, identityIndex?: number): Promise<void>;
  logout(): void;
  refreshBalance(): Promise<void>;
}
