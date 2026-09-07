import { requireId } from "./ids";
import type { ContractHandle } from "./types";
export function contractFacts(
  contract: ContractHandle,
  protocolVersion: number,
) {
  const raw = contract.toObject(protocolVersion);
  if (!raw || typeof raw !== "object")
    throw new Error("Malformed contract facts.");
  const obj = raw as Record<string, unknown>;
  if (obj.description != null && typeof obj.description !== "string")
    throw new Error("Malformed contract description.");
  if (
    obj.keywords != null &&
    (!Array.isArray(obj.keywords) ||
      !obj.keywords.every((x) => typeof x === "string"))
  )
    throw new Error("Malformed contract keywords.");
  if (!Number.isSafeInteger(contract.version))
    throw new Error("Malformed contract version.");
  return {
    ownerId: requireId(contract.ownerId),
    version: contract.version,
    description: obj.description as string | undefined,
    keywords: (obj.keywords ?? []) as string[],
    documentTypes: Object.keys(contract.schemas),
  };
}
