import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import wasm from "vite-plugin-wasm";
import { resolve } from "node:path";
import { readFileSync, realpathSync } from "node:fs";

export default defineConfig({
  root: __dirname,
  server: { fs: { allow: [__dirname, realpathSync(resolve(__dirname, "node_modules"))] } },
  plugins: [
    react(),
    tsconfigPaths({ projects: [resolve(__dirname, "tsconfig.base.json")] }),
    // jsdom has no HTTP server for asset URLs. Run the real WASM from bytes.
    {
      name: "inline-test-wasm",
      enforce: "pre",
      load(id) {
        if (!id.endsWith(".wasm?url")) return;
        const bytes = readFileSync(id.slice(0, -4));
        return `export default "data:application/wasm;base64,${bytes.toString("base64")}"`;
      },
    },
    wasm(),
  ],
  test: {
    // Use source aliases in a clean checkout; library dist files are not needed.
    projects: [{ extends: true, test: { name: "desktop" } }],
    globals: true,
    environment: "jsdom",
    // Legacy Jest API tests under apps/artcraft/test target the removed web app.
    include: ["apps/*/app/src/**/*.{test,spec}.{ts,tsx}", "libs/**/src/**/*.{test,spec}.{ts,tsx}"],
    maxWorkers: 2,
    server: { deps: { inline: [/opencut-wasm/] } },
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/unit.xml" },
  },
});
