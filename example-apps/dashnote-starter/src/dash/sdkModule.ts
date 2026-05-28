// Defer the @dashevo/evo-sdk value import so it doesn't anchor the SDK chunk
// to the entry graph via files statically imported by SessionContext /
// LoginModal / NotesWorkspace. Cached after first call; cleared on failure
// so a transient chunk fetch can retry.
export type SdkModule = typeof import("@dashevo/evo-sdk");

let sdkModulePromise: Promise<SdkModule> | null = null;

export function loadSdkModule(): Promise<SdkModule> {
  if (!sdkModulePromise) {
    sdkModulePromise = import("@dashevo/evo-sdk").catch((err) => {
      sdkModulePromise = null;
      throw err;
    });
  }
  return sdkModulePromise;
}
