import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "shared",
          root: "packages/shared",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "api",
          root: "apps/api",
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          // 每個測試檔各自起一個記憶體 PGlite，第一次載入 WASM 需要幾秒
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: "web",
          root: "apps/web",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
