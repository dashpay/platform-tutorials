type SdkModule = typeof import("@dashevo/evo-sdk");

let promise: Promise<SdkModule> | null = null;

export function loadSdkModule(): Promise<SdkModule> {
  if (!promise) {
    promise = import("@dashevo/evo-sdk").catch((err) => {
      promise = null;
      throw err;
    });
  }
  return promise;
}
