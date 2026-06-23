import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

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
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((d) => !d.includes("evo-sdk")),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
