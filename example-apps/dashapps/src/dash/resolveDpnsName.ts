import { requireId } from "./ids";
import { StaleRequestError } from "./ownerResolver";
import type { Network, ReadSdk } from "./types";
/** Optional attribution labels: errors are never cached as missing names. */
export class NameResolver {
  private generation = 0;
  private cache = new Map<string, { name: string | null; expires: number }>();
  constructor(
    private sdk: Pick<ReadSdk, "dpns">,
    private network: Network,
    private now = Date.now,
  ) {}
  clear() {
    this.generation++;
    this.cache.clear();
  }
  async resolve(identityId: string): Promise<string | null> {
    const id = requireId(identityId);
    const key = `${this.network}:${id}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return cached.name;
    const generation = this.generation;
    try {
      const value = await this.sdk.dpns.username(id);
      if (generation !== this.generation) throw new StaleRequestError();
      if (value != null && typeof value !== "string") return null;
      const name = value ? value.replace(/\.dash$/, "") : null;
      this.cache.set(key, {
        name,
        expires: this.now() + (name ? 60_000 : 5_000),
      });
      return name;
    } catch (error) {
      if (generation !== this.generation) throw new StaleRequestError();
      if (error instanceof StaleRequestError) throw error;
      return null;
    }
  }
}
