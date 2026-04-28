import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url).href)
    }
  }
});
