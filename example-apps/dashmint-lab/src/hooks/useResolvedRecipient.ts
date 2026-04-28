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
// Values: resolved identity ID, null (confirmed not-found), or a pending
// Promise. Transient errors are NOT cached so a future render retries.
const cache = new Map<string, string | null | Promise<string | null>>();

export function useResolvedRecipient(
  sdk: DashSdk | null | undefined,
  input: string | null | undefined,
): ResolvedRecipient {
  const [, forceRender] = useState(0);

  const trimmed = input?.trim() ?? "";
  const mode = trimmed ? classifyRecipientInput(trimmed) : "invalid";
  const shouldResolve =
    !!sdk && !!trimmed && (mode === "name" || mode === "ambiguous");
  const key = shouldResolve ? normalizeDpnsName(trimmed) : null;
  const cached = key ? cache.get(key) : undefined;

  useEffect(() => {
    if (!sdk || !key) return;

    // Read inside the effect so concurrent hook instances mounting in the
    // same render see each other's in-flight promise instead of all
    // starting fresh lookups.
    const current = cache.get(key);

    if (current !== undefined && !(current instanceof Promise)) {
      return;
    }

    if (current instanceof Promise) {
      let cancelled = false;
      current.then(
        (val) => {
          if (!cancelled) {
            cache.set(key, val);
            forceRender((n) => n + 1);
          }
        },
        () => {
          // Sibling hook will have evicted the entry; just re-render so we
          // pick up the cleared state and retry on the next effect run.
          if (!cancelled) forceRender((n) => n + 1);
        },
      );
      return () => {
        cancelled = true;
      };
    }

    const promise = resolveDpnsName(sdk, key);
    cache.set(key, promise);

    let cancelled = false;
    promise.then(
      (val) => {
        cache.set(key, val);
        if (!cancelled) forceRender((n) => n + 1);
      },
      () => {
        // Don't cache transient failures — drop the in-flight entry so the
        // next render retries instead of seeing a stuck Promise.
        if (cache.get(key) === promise) cache.delete(key);
        if (!cancelled) forceRender((n) => n + 1);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [sdk, key]);

  if (!shouldResolve) return { status: "idle" };
  if (cached === undefined || cached instanceof Promise) {
    return { status: "resolving" };
  }
  if (cached === null) return { status: "not-found" };
  return { status: "resolved", identityId: cached };
}
