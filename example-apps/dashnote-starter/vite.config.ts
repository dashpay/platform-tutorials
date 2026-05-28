import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

// The shared setupDashClient core lives at the repo root and imports
// "@dashevo/evo-sdk" as a bare specifier. Bind that specifier to this app's
// locally installed browser bundle so the shared core resolves the SDK from
// here.
const evoSdkModulePath = fileURLToPath(
  new URL(
    "./node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js",
    import.meta.url,
  ),
);

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  resolve: {
    alias: {
      "@dashevo/evo-sdk": evoSdkModulePath,
    },
  },
  plugins: [react()],
  build: {
    // Strip <link rel="modulepreload"> for the ~8MB Evo SDK + WASM chunk.
    // Without this, the browser races to fetch the SDK in parallel with the
    // entry chunk, blocking FCP even though every SDK import in this app is
    // syntactically dynamic. See dashpay/platform-tutorials#77.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((d) => !d.includes("evo-sdk")),
    },
  },
});
