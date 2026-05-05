import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
      // The shared setupDashClient core lives at the repo root, so bind
      // "@dashevo/evo-sdk" to this app's installed browser bundle.
      "@dashevo/evo-sdk": evoSdkModulePath,
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    // Vite auto-injects <link rel="modulepreload"> for every dynamic-import
    // chunk it discovers at build time. For the ~8MB Evo SDK + WASM chunk
    // this defeats the whole point of dynamic-importing it: the browser
    // races to fetch the SDK in parallel with the entry chunk, blocking
    // FCP. Strip the SDK preload so it only fetches when SessionContext
    // actually triggers the dynamic import.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((d) => !d.includes("evo-sdk")),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/**/*.d.ts"],
    },
  },
});
