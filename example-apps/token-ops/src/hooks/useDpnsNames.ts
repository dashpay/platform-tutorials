import { useEffect, useMemo, useState } from "react";

import { lookupDpnsName } from "../dash/resolveDpnsName";
import type { DashSdk } from "../dash/types";

type DpnsNames = Record<string, string | null>;

const cache: DpnsNames = {};

function normalizeIds(identityIds: Iterable<string | null | undefined>) {
  return [
    ...new Set([...identityIds].map((id) => id?.trim()).filter(Boolean)),
  ].sort() as string[];
}

export function useDpnsNames(
  sdk: DashSdk | null | undefined,
  identityIds: Iterable<string | null | undefined>,
): DpnsNames {
  const ids = normalizeIds(identityIds);
  const idsKey = ids.join("\n");
  const [dpnsNames, setDpnsNames] = useState<DpnsNames>({});

  useEffect(() => {
    const activeIds = idsKey ? idsKey.split("\n") : [];
    if (!sdk || activeIds.length === 0) return;
    const pending = activeIds.filter((id) => !(id in cache));
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      const resolved = await Promise.all(
        pending.map(async (id) => {
          try {
            return [id, await lookupDpnsName(sdk, id)] as const;
          } catch {
            // Transient lookup failures are left uncached so a later render can
            // retry instead of permanently falling back to truncated IDs.
            return null;
          }
        }),
      );
      if (cancelled) return;
      const entries = resolved.filter(
        (entry): entry is readonly [string, string | null] => entry !== null,
      );
      if (entries.length === 0) return;
      for (const [id, name] of entries) cache[id] = name;
      setDpnsNames((previous) => ({
        ...previous,
        ...Object.fromEntries(entries),
      }));
    })();

    return () => {
      cancelled = true;
    };
    // `idsKey` tracks the normalized identity set without making callers memoize
    // arrays created during render.
  }, [sdk, idsKey]);

  return useMemo(() => {
    const activeIds = idsKey ? idsKey.split("\n") : [];
    const next: DpnsNames = {};
    for (const id of activeIds) {
      if (id in cache) next[id] = cache[id];
      else if (id in dpnsNames) next[id] = dpnsNames[id];
    }
    return next;
  }, [dpnsNames, idsKey]);
}
