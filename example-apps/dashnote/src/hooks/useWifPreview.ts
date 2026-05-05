import { useEffect, useState } from "react";

import {
  KeyDisabledError,
  resolveIdentityFromWif,
  UnknownIdentityError,
  WrongKeyPurposeError,
} from "../dash/loginWithPrivateKey";
import { resolveDpnsName } from "../dash/resolveDpnsName";
import type { DashSdk } from "../dash/types";
import { looksLikeWif } from "../lib/detectSecretShape";

export type WifPreviewState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "resolved"; identityId: string; dpnsName: string | null }
  | {
      status: "wrong-purpose";
      identityId: string;
      dpnsName: string | null;
      purposeName: string;
      securityLevelName: string;
    }
  | { status: "key-disabled"; identityId: string; dpnsName: string | null };

const IDLE: WifPreviewState = { status: "idle" };
const CHECKING: WifPreviewState = { status: "checking" };
const DEBOUNCE_MS = 400;

interface Resolved {
  wif: string;
  state: WifPreviewState;
}

// Module-scoped cache: a WIF that resolved to a given identity (or to an
// actionable error) yields the same answer on every future paste, so survive
// modal close/reopen. Idle outcomes (UnknownIdentity / network blips) are
// not cached — see the resolver below.
const previewCache = new Map<string, WifPreviewState>();

/** Test-only: reset the module-scoped preview cache between tests. */
export function _resetWifPreviewCacheForTests(): void {
  previewCache.clear();
}

/**
 * Eagerly resolves a pasted WIF to its owning identity (and DPNS name) so
 * the user gets pre-submit confirmation and "wrong key type" feedback before
 * hitting Login. Network lookup is gated on a cheap structural check
 * (`looksLikeWif`) plus a debounce — partial input never triggers a request.
 *
 * Errors from resolution other than recognized "actionable" ones (wrong
 * purpose, disabled key) are silently downgraded to `idle`: the user hasn't
 * committed to login yet, so we don't surface UnknownIdentityError or network
 * failures as UI errors. The actual login path will surface them on submit.
 *
 * Results are cached per WIF for the lifetime of the hook so re-typing the
 * same key doesn't re-query.
 */
export function useWifPreview(
  sdk: DashSdk | null,
  secret: string,
  enabled: boolean,
): WifPreviewState {
  const trimmed = secret.trim();
  const gateOk = enabled && Boolean(sdk) && looksLikeWif(trimmed);
  const cached = gateOk ? previewCache.get(trimmed) : undefined;

  // The resolver tags its result with the WIF that produced it; the render
  // path ignores stale results from a previous WIF. This avoids any setState
  // in the effect body or cleanup.
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!gateOk || cached) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      let next: WifPreviewState;
      try {
        const result = await resolveIdentityFromWif(sdk!, trimmed);
        let dpns: string | null = null;
        try {
          dpns = await resolveDpnsName(sdk!, result.identityId);
        } catch {
          dpns = null;
        }
        next = {
          status: "resolved",
          identityId: result.identityId,
          dpnsName: dpns,
        };
      } catch (err) {
        if (
          err instanceof WrongKeyPurposeError ||
          err instanceof KeyDisabledError
        ) {
          // We have an identity ID — resolve its DPNS name so the warning
          // can show the user-friendly handle instead of a truncated ID.
          let dpns: string | null = null;
          try {
            dpns = await resolveDpnsName(sdk!, err.identityId);
          } catch {
            dpns = null;
          }
          if (err instanceof WrongKeyPurposeError) {
            next = {
              status: "wrong-purpose",
              identityId: err.identityId,
              dpnsName: dpns,
              purposeName: err.purposeName,
              securityLevelName: err.securityLevelName,
            };
          } else {
            next = {
              status: "key-disabled",
              identityId: err.identityId,
              dpnsName: dpns,
            };
          }
        } else if (err instanceof UnknownIdentityError) {
          next = IDLE;
        } else {
          next = IDLE;
        }
      }
      if (cancelled) return;
      // Only cache stable outcomes — silent "idle" results from transient
      // network errors should be retryable on the next keystroke.
      if (next.status !== "idle") {
        previewCache.set(trimmed, next);
      }
      setResolved({ wif: trimmed, state: next });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sdk, trimmed, gateOk, cached]);

  if (!gateOk) return IDLE;
  if (cached) return cached;
  if (resolved && resolved.wif === trimmed) return resolved.state;
  return CHECKING;
}
