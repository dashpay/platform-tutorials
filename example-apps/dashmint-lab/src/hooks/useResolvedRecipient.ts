/**
 * Resolves a DPNS name to an identity ID without blocking render.
 *
 * Mirrors useDpnsName (the inverse direction). Uses a module-level cache so
 * the same name is only looked up once across the app lifetime.
 */
import { useEffect, useState } from "react";
import { normalizeDpnsName, resolveDpnsName } from "../dash/resolveRecipient";
import { classifyRecipientInput } from "../dash/classifyRecipientInput";
import type { DashSdk } from "../dash/types";

export type ResolvedRecipient =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "resolved"; identityId: string }
  | { status: "not-found" };

// Module-level cache keyed by normalized full name.
// Values: resolved identity ID, null (not found), or a pending Promise.
const cache = new Map<string, string | null | Promise<string | null>>();

async function lookup(sdk: DashSdk, fullName: string): Promise<string | null> {
  try {
    return await resolveDpnsName(sdk, fullName);
  } catch {
    return null;
  }
}

export function useResolvedRecipient(
  sdk: DashSdk | null | undefined,
  input: string | null | undefined,
): ResolvedRecipient {
  const [, forceRender] = useState(0);

  const mode = input ? classifyRecipientInput(input) : "invalid";
  const shouldResolve =
    !!sdk && !!input && (mode === "name" || mode === "ambiguous");
  const key = shouldResolve ? normalizeDpnsName(input!) : null;
  const cached = key ? cache.get(key) : undefined;

  useEffect(() => {
    if (!sdk || !key) return;

    if (cached !== undefined && !(cached instanceof Promise)) {
      return;
    }

    if (cached instanceof Promise) {
      let cancelled = false;
      cached.then((val) => {
        if (!cancelled) {
          cache.set(key, val);
          forceRender((n) => n + 1);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const promise = lookup(sdk, key);
    cache.set(key, promise);

    let cancelled = false;
    promise.then((val) => {
      cache.set(key, val);
      if (!cancelled) forceRender((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [sdk, key, cached]);

  if (!shouldResolve) return { status: "idle" };
  if (cached === undefined || cached instanceof Promise) {
    return { status: "resolving" };
  }
  if (cached === null) return { status: "not-found" };
  return { status: "resolved", identityId: cached };
}
