type SdkCore = typeof import("../../../../setupDashClient-core.mjs");

let sdkCorePromise: Promise<SdkCore> | null = null;

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
