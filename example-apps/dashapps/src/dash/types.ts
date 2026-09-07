export type Network = "testnet" | "mainnet";
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
