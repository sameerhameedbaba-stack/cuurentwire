import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // tests/shadow holds the Intelligence-v2 shadow evaluations: they
    // self-skip unless SHADOW_EVAL=1 and the local benchmark data exists,
    // so normal runs and CI stay fast and offline.
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/shadow/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
