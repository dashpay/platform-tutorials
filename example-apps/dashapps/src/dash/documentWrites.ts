/** Write-path helpers shared by every registry document type. */
import type { DataContract, Document } from "@dashevo/evo-sdk";
import type { SessionSdk } from "../session/types";
import { requireId } from "./ids";
import { errorMessage } from "../lib/logger";
import { loadSdkModule } from "./sdkModule";

/**
 * Evict the target from the SDK cache, require a fresh successful read, and
 * return the target contract's owner.
 */
export async function freshTarget(
  sdk: SessionSdk,
  targetId: string,
): Promise<string> {
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
  return requireId(target.ownerId);
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

const CONSENSUS_ERRORS = {
  duplicate: { code: 40105, text: "duplicate unique properties" },
  referenceNotFound: { code: 40120, text: "not found for path" },
  immutable: { code: 40128, text: "is immutable and cannot be changed" },
  ownerRequirement: { code: 40135, text: "does not meet the reference's" },
} as const;

function isConsensusError(
  error: unknown,
  { code, text }: { code: number; text: string },
) {
  return (
    (error as { code?: unknown })?.code === code ||
    errorMessage(error).includes(text)
  );
}

/** Platform's unique-index violation (code 40105). */
export function isDuplicate(error: unknown) {
  return isConsensusError(error, CONSENSUS_ERRORS.duplicate);
}

export type WriteKind = "entry" | "endorsement" | "review";

/** Reword the reference and immutability refusals for the user. */
export function explainWriteError(error: unknown, kind: WriteKind): unknown {
  if (isConsensusError(error, CONSENSUS_ERRORS.referenceNotFound))
    return new Error(
      kind === "endorsement"
        ? "That publisher has no entry for this contract. They need to publish one first."
        : "The target contract does not exist on this network.",
      { cause: error },
    );
  if (
    kind !== "entry" &&
    isConsensusError(error, CONSENSUS_ERRORS.ownerRequirement)
  )
    return new Error(
      kind === "review"
        ? "You can't review a contract you own."
        : "Only the contract's owner can choose its official entry.",
      { cause: error },
    );
  if (isConsensusError(error, CONSENSUS_ERRORS.immutable))
    return new Error(
      "A registry document can't be moved to a different contract.",
      { cause: error },
    );
  return error;
}

/** Broadcast a document transition, translating consensus refusals. */
export async function submit<T>(
  kind: WriteKind,
  transition: () => Promise<T>,
): Promise<T> {
  try {
    return await transition();
  } catch (error) {
    throw explainWriteError(error, kind);
  }
}
