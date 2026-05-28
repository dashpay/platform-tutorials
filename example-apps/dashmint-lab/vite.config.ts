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

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  resolve: {
    alias: {
      // DashMint Lab imports the shared browser-safe SDK core from the repo
      // root. That file also imports "@dashevo/evo-sdk", so bind the bare
      // specifier to this app's installed copy instead of depending on a
      // separate root-level npm install.
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
    exclude: ["test/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/**/*.d.ts"],
    },
  },
});
