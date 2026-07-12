import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Integration tests hit a local Postgres/GoTrue instance sequentially —
    // running suites in parallel would race on the same DB rows.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
