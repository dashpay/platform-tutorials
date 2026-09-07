type SdkCore = typeof import("../../../../setupDashClient-core.mjs");

let sdkCorePromise: Promise<SdkCore> | null = null;

/**
 * Cached dynamic import of the repo-root browser-safe SDK core (createClient +
 * IdentityKeyManager). Distinct from sdkModule.ts — do not merge the two.
 */
export function loadSdkCore(): Promise<SdkCore> {
  if (!sdkCorePromise) {
    sdkCorePromise = import("../../../../setupDashClient-core.mjs").catch(
      (err) => {
        sdkCorePromise = null;
        throw err;
      },
    );
  }
  return sdkCorePromise;
}
