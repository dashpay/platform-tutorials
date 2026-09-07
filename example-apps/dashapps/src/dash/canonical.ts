import { assertBase58Id } from "./ids";
import type { Resolution } from "./types";
export interface Metadata {
  id: string;
  ownerId: string;
  name: string;
}
export type Lookup =
  | { status: "pending" }
  | { status: "error"; error: Error }
  | { status: "success"; document: Metadata | null };
export function pickCanonical(
  ownerId: string,
  docs: Metadata[],
): Metadata | null {
  assertBase58Id(ownerId);
  for (const doc of docs) {
    assertBase58Id(doc.ownerId);
    assertBase58Id(doc.id);
  }
  const matches = docs.filter((doc) => doc.ownerId === ownerId);
  if (matches.length > 1)
    throw new Error("More than one canonical document returned.");
  return matches[0] ?? null;
}
export function classifyApp({
  resolution,
  canonicalLookup,
  proposals,
  proposalsComplete,
}: {
  resolution: Resolution | { status: "pending" };
  canonicalLookup: Lookup;
  proposals: Metadata[];
  proposalsComplete: boolean;
}) {
  if (resolution.status === "pending" || resolution.status === "error")
    return { ...resolution, community: proposals };
  if (resolution.status === "missing")
    return { status: "contract-missing" as const, community: proposals };
  assertBase58Id(resolution.ownerId);
  if (canonicalLookup.status !== "success")
    return { ...canonicalLookup, community: proposals };
  const canonical = canonicalLookup.document;
  if (canonical) {
    assertBase58Id(canonical.ownerId);
    assertBase58Id(canonical.id);
  }
  if (canonical && canonical.ownerId !== resolution.ownerId)
    throw new Error("Canonical lookup returned a different owner.");
  return {
    status: canonical
      ? ("canonical" as const)
      : proposalsComplete && !proposals.length
        ? ("no-entries" as const)
        : ("no-owner-entry" as const),
    canonical,
    community: proposals.filter((doc) => doc.id !== canonical?.id),
  };
}
