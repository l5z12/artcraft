import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: { "~": resolve(__dirname, "app/src") },
  },
  test: {
    environment: "jsdom",
    include: ["app/src/**/*.spec.{ts,tsx}"],
  },
});
