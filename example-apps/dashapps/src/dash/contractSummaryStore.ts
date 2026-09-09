import { isBase58Id } from "./ids";
import type { Network } from "./types";

export type ContractSummary = {
  contractId: string;
  ownerId: string;
  version: number;
  description: string | undefined;
  keywords: string[];
  documentTypes: string[];
  fetchedAt: number;
};

const MAX_ENTRIES = 1_000;

function validStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function readSummary(value: unknown): ContractSummary | undefined {
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  if (
    !isBase58Id(item.contractId) ||
    !isBase58Id(item.ownerId) ||
    !Number.isSafeInteger(item.version) ||
    typeof item.fetchedAt !== "number" ||
    !Number.isFinite(item.fetchedAt) ||
    (item.description !== undefined && typeof item.description !== "string") ||
    !validStrings(item.keywords) ||
    !validStrings(item.documentTypes)
  )
    return;
  return item as ContractSummary;
}

export class ContractSummaryStore {
  private readonly entries = new Map<string, ContractSummary>();
  private readonly key: string;

  constructor(network: Network) {
    this.key = `dashapps.contractSummaries.v1.${network}`;
    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem(this.key) ?? "null",
      );
      const stored =
        parsed && typeof parsed === "object"
          ? (parsed as { entries?: unknown }).entries
          : undefined;
      if (Array.isArray(stored))
        for (const value of stored) {
          const summary = readSummary(value);
          if (summary) this.entries.set(summary.contractId, summary);
        }
    } catch {
      // Storage is an optional performance layer.
    }
  }

  get(contractId: string) {
    return this.entries.get(contractId);
  }

  getMany(contractIds: string[]) {
    const found = new Map<string, ContractSummary>();
    for (const id of contractIds) {
      const summary = this.entries.get(id);
      if (summary) found.set(id, summary);
    }
    return found;
  }

  set(summary: ContractSummary) {
    this.setMany([summary]);
  }

  setMany(summaries: ContractSummary[]) {
    for (const summary of summaries) {
      this.entries.delete(summary.contractId);
      this.entries.set(summary.contractId, summary);
    }
    while (this.entries.size > MAX_ENTRIES)
      this.entries.delete(this.entries.keys().next().value!);
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({ entries: [...this.entries.values()] }),
      );
    } catch {
      // Quota and privacy-mode failures must not affect contract reads.
    }
  }
}
