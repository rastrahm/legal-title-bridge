import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      "@legal-title-bridge/shared": path.join(root, "../shared/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**"],
      exclude: [
        "src/**/*.test.*",
        "src/lib/demo/**",
        "src/lib/wallets/**",
        "src/hooks/useWindowSearch.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80,
      },
    },
  },
});
