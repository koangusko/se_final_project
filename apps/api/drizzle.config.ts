import { defineConfig } from "drizzle-kit";

// 只用 generate + migrate，不要用 push（push 不認得手寫的 EXCLUDE 約束，會想把它刪掉）。
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
});
