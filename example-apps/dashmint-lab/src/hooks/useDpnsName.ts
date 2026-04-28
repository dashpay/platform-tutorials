/**
 * Resolves DPNS usernames for identity IDs without blocking card rendering.
 *
 * Uses a module-level cache so repeated renders (or multiple cards with the
 * same owner) only trigger one network call per identity.
 */
import { useEffect, useState } from "react";
import type { DashSdk } from "../dash/types";

// Module-level cache shared across all hook instances.
// Values: resolved username string, null (no name), or a pending Promise.
const cache = new Map<string, string | null | Promise<string | null>>();

async function resolve(
  sdk: DashSdk,
  identityId: string,
): Promise<string | null> {
  try {
    const result = await sdk.dpns.username(identityId);
    if (typeof result !== "string") return null;
    // Strip the ".dash" TLD suffix for display.
    return result.endsWith(".dash") ? result.slice(0, -5) : result;
  } catch {
    return null;
  }
}

/**
 * Returns the DPNS username for an identity, or null while loading / if none.
 * Does not delay initial render — the name appears once the async lookup completes.
 */
export function useDpnsName(
  sdk: DashSdk | null | undefined,
  identityId: string | undefined | null,
): string | null {
  const [, forceRender] = useState(0);
  const cached = identityId ? cache.get(identityId) : undefined;

  useEffect(() => {
    if (!sdk || !identityId) return;

    // Read inside the effect so concurrent hook instances mounting in the
    // same render see each other's in-flight promise instead of all
    // starting fresh lookups.
    const current = cache.get(identityId);

    if (current !== undefined && !(current instanceof Promise)) {
      return;
    }

    // Already in-flight — wait on the existing promise
    if (current instanceof Promise) {
      let cancelled = false;
      current.then((val) => {
        if (!cancelled) {
          cache.set(identityId, val);
          forceRender((n) => n + 1);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    // Start a new lookup
    const promise = resolve(sdk, identityId);
    cache.set(identityId, promise);

    let cancelled = false;
    promise.then((val) => {
      cache.set(identityId, val);
      if (!cancelled) forceRender((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [sdk, identityId]);

  return cached instanceof Promise ? null : (cached ?? null);
}
