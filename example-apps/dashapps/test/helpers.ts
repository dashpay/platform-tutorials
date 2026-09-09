import { vi } from "vitest";
import { bytesToBase58 } from "../src/dash/ids";
import type { ContractHandle, ReadSdk } from "../src/dash/types";
export function id(n: number) {
  const bytes = new Uint8Array(32);
  new DataView(bytes.buffer).setUint32(28, n);
  return bytesToBase58(bytes);
}
export function contract(ownerId: unknown = id(1)): ContractHandle {
  return {
    ownerId,
    version: 1,
    schemas: { note: {} },
    toObject: () => ({
      description: "Example contract",
      keywords: ["notes"],
      tokens: { supply: 18446744073709551615n },
    }),
  };
}
export function sdk(): ReadSdk {
  return {
    version: () => 13,
    contracts: { getMany: vi.fn(async () => new Map()) },
    documents: {
      query: vi.fn(async () => []),
      count: vi.fn(async () => new Map<string, bigint>()),
    },
    dpns: { username: vi.fn(async () => undefined) },
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
