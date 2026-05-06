import { useEffect, useState } from "react";

import { resolveDpnsName } from "../dash/resolveDpnsName";
import type { DashSdk } from "../dash/types";
import { looksLikeWif } from "../lib/detectSecretShape";

// loginWithPrivateKey transitively imports @dashevo/evo-sdk (~8MB WASM).
// Pulling it in statically here would defeat SessionContext's lazy-load and
// drag the SDK chunk into the app shell. Defer to the post-debounce callback,
// where we've already committed to a network call.
type LoginModule = typeof import("../dash/loginWithPrivateKey");
let loginModulePromise: Promise<LoginModule> | null = null;
function loadLoginModule(): Promise<LoginModule> {
  if (!loginModulePromise) {
    loginModulePromise = import("../dash/loginWithPrivateKey").catch((err) => {
      // Clear the cache on failure so a subsequent attempt can retry the
      // chunk fetch instead of awaiting a permanently-rejected promise.
      loginModulePromise = null;
      throw err;
    });
  }
  return loginModulePromise;
}

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
 * Resolution state is component-local: changing the WIF cancels any in-flight
 * resolver and clears the prior result. We do NOT cache resolved outcomes
 * across renders — keeping a Map of pasted secrets keyed by raw WIF would
 * extend secret retention beyond the form lifecycle for no real UX win
 * (re-pasting the exact same WIF is rare).
 */
export function useWifPreview(
  sdk: DashSdk | null,
  secret: string,
  enabled: boolean,
): WifPreviewState {
  const trimmed = secret.trim();
  const gateOk = enabled && Boolean(sdk) && looksLikeWif(trimmed);

  // The resolver tags its result with the WIF that produced it; if `trimmed`
  // changes between scheduling and rendering, we ignore the stale result at
  // the bottom of this hook. This avoids any setState in the effect body.
  // Note: `wif` here is component-local state — it lives only as long as the
  // input does, matching the lifetime of `secret` in the parent component.
  const [resolved, setResolved] = useState<{
    wif: string;
    state: WifPreviewState;
  } | null>(null);

  useEffect(() => {
    if (!gateOk) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      let next: WifPreviewState = IDLE;
      let mod: LoginModule | null = null;
      try {
        mod = await loadLoginModule();
        if (cancelled) return;
        const result = await mod.resolveIdentityFromWif(sdk!, trimmed);
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
        // mod is null only if loadLoginModule itself rejected (chunk fetch
        // failure / offline). Treat that as an idle outcome — same silent
        // policy we apply to UnknownIdentity and network blips.
        if (
          mod &&
          (err instanceof mod.WrongKeyPurposeError ||
            err instanceof mod.KeyDisabledError)
        ) {
          // We have an identity ID — resolve its DPNS name so the warning
          // can show the user-friendly handle instead of a truncated ID.
          let dpns: string | null = null;
          try {
            dpns = await resolveDpnsName(sdk!, err.identityId);
          } catch {
            dpns = null;
          }
          if (err instanceof mod.WrongKeyPurposeError) {
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
        } else {
          // UnknownIdentityError, network failure, import failure, or any
          // other unexpected error — stay silent until the user submits.
          next = IDLE;
        }
      }
      if (cancelled) return;
      setResolved({ wif: trimmed, state: next });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sdk, trimmed, gateOk]);

  if (!gateOk) return IDLE;
  if (resolved && resolved.wif === trimmed) return resolved.state;
  return CHECKING;
}
