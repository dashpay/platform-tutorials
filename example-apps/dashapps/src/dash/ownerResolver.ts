import { errorMessage } from "../lib/logger";
import { contractFacts } from "./contractFacts";
import {
  ContractSummaryStore,
  type ContractSummary,
} from "./contractSummaryStore";
import { requireId } from "./ids";
import type { Network, ReadSdk, Resolution } from "./types";
export class StaleRequestError extends Error {}
export class OwnerResolver {
  private generation = 0;
  private cache = new Map<string, { result: Resolution; expires: number }>();
  private summaries: ContractSummaryStore;
  constructor(
    private sdk: ReadSdk,
    private network: Network,
    private now = Date.now,
  ) {
    this.summaries = new ContractSummaryStore(network);
  }
  summary(id: string) {
    return this.summaries.get(requireId(id));
  }
  summaryMany(ids: string[]) {
    return this.summaries.getMany([...new Set(ids.map(requireId))]);
  }
  clear() {
    this.generation++;
    this.cache.clear();
  }
  async resolve(
    ids: string[],
    force = false,
  ): Promise<Map<string, Resolution>> {
    const generation = this.generation;
    const result = new Map<string, Resolution>();
    const pending: string[] = [];
    for (const id of new Set(ids.map(requireId))) {
      const cached = this.cache.get(`${this.network}:${id}`);
      if (!force && cached && cached.expires > this.now())
        result.set(id, cached.result);
      else pending.push(id);
    }
    for (let offset = 0; offset < pending.length; offset += 100) {
      const chunk = pending.slice(offset, offset + 100);
      try {
        const fetched = await this.sdk.contracts.getMany(chunk);
        if (generation !== this.generation) throw new StaleRequestError();
        if (!(fetched instanceof Map))
          throw new Error("Malformed contract batch response.");
        const summaries: ContractSummary[] = [];
        for (const id of chunk) {
          const contract = fetched.get(id);
          let resolution: Resolution;
          try {
            resolution =
              contract === undefined
                ? { status: "missing" }
                : {
                    status: "found",
                    ownerId: requireId(contract.ownerId),
                    contract,
                  };
          } catch (error) {
            resolution = {
              status: "error",
              error:
                error instanceof Error ? error : new Error(errorMessage(error)),
            };
          }
          result.set(id, resolution);
          if (resolution.status === "found") {
            const facts = contractFacts(
              resolution.contract,
              this.sdk.version(),
            );
            summaries.push({
              contractId: id,
              ...facts,
              fetchedAt: this.now(),
            });
          }
          if (resolution.status !== "error")
            this.cache.set(`${this.network}:${id}`, {
              result: resolution,
              expires:
                this.now() + (resolution.status === "found" ? 60_000 : 5_000),
            });
        }
        if (summaries.length) this.summaries.setMany(summaries);
      } catch (error) {
        if (generation !== this.generation) throw new StaleRequestError();
        for (const id of chunk)
          result.set(id, {
            status: "error",
            error:
              error instanceof Error ? error : new Error(errorMessage(error)),
          });
      }
    }
    return result;
  }
}
