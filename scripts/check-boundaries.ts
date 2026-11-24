/**
 * 模組邊界檢查（pnpm check:boundaries，CI 也會跑）。
 *
 * 規則：
 * 1. 三個模組（space / booking / scheduling）不能 import 彼此的檔案。
 *    要用別的模組的資料：後端查資料表（db/schema）或呼叫 core/，前端呼叫 API。
 * 2. packages/shared 不能 import apps/ 底下任何東西。
 * 3. 前端只能從後端 import 型別出口 @class/api/app-type。
 * 4. 後端不能 import 前端。
 *
 * 用 import 字串比對 + 解析相對路徑，所以 "../../booking/x.ts" 這種繞路也抓得到。
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MODULES = ["space", "booking", "scheduling"] as const;
const SCAN = ["apps/api/src", "apps/api/test", "apps/web/src", "packages/shared/src"];

const IMPORT_RE =
  /(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".gen.ts")) yield full;
  }
}

/** 檔案屬於哪個模組（不屬於任何模組回傳 null） */
function moduleOf(rel: string): string | null {
  for (const m of MODULES) {
    if (
      rel.startsWith(`apps/api/src/modules/${m}/`) ||
      rel.startsWith(`apps/web/src/modules/${m}/`) ||
      rel.startsWith(`apps/web/src/routes/${m}/`) ||
      rel === `apps/api/test/${m}.test.ts` ||
      rel.startsWith(`apps/api/test/${m}/`)
    ) {
      return m;
    }
  }
  return null;
}

const violations: string[] = [];

for (const dir of SCAN) {
  for await (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    const src = await readFile(file, "utf8");
    const owner = moduleOf(rel);
    for (const match of src.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;
      const target = spec.startsWith(".")
        ? path.relative(ROOT, path.resolve(path.dirname(file), spec))
        : spec;
      const targetModule = spec.startsWith(".") ? moduleOf(target) : null;
      const line = src.slice(0, match.index).split("\n").length;
      const where = `${rel}:${line}  import "${spec}"`;

      if (owner && targetModule && targetModule !== owner) {
        violations.push(`${where}\n    模組 ${owner} 不能 import 模組 ${targetModule} 的檔案`);
      }
      if (
        rel.startsWith("packages/shared/") &&
        (target.startsWith("apps/") ||
          spec.startsWith("@class/api") ||
          spec.startsWith("@class/web"))
      ) {
        violations.push(`${where}\n    packages/shared 不能依賴 apps/`);
      }
      if (
        rel.startsWith("apps/web/") &&
        (target.startsWith("apps/api/") ||
          (spec.startsWith("@class/api") && spec !== "@class/api/app-type"))
      ) {
        violations.push(`${where}\n    前端只能 import @class/api/app-type（型別）`);
      }
      if (
        rel.startsWith("apps/api/") &&
        (target.startsWith("apps/web/") || spec.startsWith("@class/web"))
      ) {
        violations.push(`${where}\n    後端不能 import 前端`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`模組邊界違規 ${violations.length} 處：\n`);
  for (const v of violations) console.error(`  ${v}\n`);
  process.exit(1);
}
console.log("模組邊界檢查通過");
