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
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
