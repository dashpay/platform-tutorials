/** Write-path helpers shared by metadata and rating documents. */
import type { DataContract, Document } from "@dashevo/evo-sdk";
import type { SessionSdk } from "../session/types";
import { requireId } from "./ids";
import { loadSdkModule } from "./sdkModule";

/** Evict the target from the SDK cache and require a fresh successful read. */
export async function freshTarget(sdk: SessionSdk, targetId: string) {
  const id = requireId(targetId);
  const { Identifier } = await loadSdkModule();
  if (sdk.getWasmSdkConnected) {
    const wasm = await sdk.getWasmSdkConnected();
    if (wasm.removeCachedContract) {
      const identifier = new Identifier(id);
      try {
        wasm.removeCachedContract(identifier);
      } finally {
        identifier.free?.();
      }
    }
  }
  const target = (await sdk.contracts.getMany([id])).get(id);
  if (!target)
    throw new Error("The target contract no longer exists on this network.");
}

/**
 * Identifier-media properties must be canonical base58 at the Document boundary;
 * a contract-aware toBytes/fromBytes round trip produces the typed identifier
 * before facade validation. Timestamps are seeded because serialization happens
 * before the facade would populate them; entropy is restored because it belongs
 * to the wrapper, not the serialized document.
 */
export async function prepare(
  sdk: SessionSdk,
  registryId: string,
  documentTypeName: string,
  document: Document,
) {
  const contract = (await sdk.contracts.getMany([requireId(registryId)])).get(
    registryId,
  );
  if (!contract) throw new Error("The registry contract could not be loaded.");
  const { Document, PlatformVersion } = await loadSdkModule();
  const now = BigInt(Date.now());
  if (document.createdAt == null) document.createdAt = now;
  if (document.updatedAt == null) document.updatedAt = now;
  const version = new PlatformVersion(sdk.version());
  const prepared = Document.fromBytes(
    document.toBytes(contract as DataContract, version),
    contract as DataContract,
    documentTypeName,
    version,
  );
  if (document.entropy) prepared.entropy = document.entropy;
  return prepared;
}

/** Platform's unique-index violation (code 40105). */
export function isDuplicate(error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  return (
    value?.code === 40105 ||
    String(value?.message ?? error).includes("duplicate unique properties")
  );
}
