type SdkModule = typeof import("@dashevo/evo-sdk");

let promise: Promise<SdkModule> | null = null;

/**
 * Cached dynamic import of the ~8 MB evo-sdk browser bundle. Keep this SEPARATE
 * from sdkCore.ts — two distinct loaders, never merged.
 */
export function loadSdkModule(): Promise<SdkModule> {
  if (!promise) {
    promise = import("@dashevo/evo-sdk").catch((err) => {
      promise = null;
      throw err;
    });
  }
  return promise;
}
