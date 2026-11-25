/**
 * 設定第一位管理員（系統剛上線時沒有人能審核，所以用指令設定）。
 *
 *   列出使用者：docker exec class-app-1 node apps/api/src/cli/grant-admin.ts --list
 *   設為管理員：docker exec class-app-1 node apps/api/src/cli/grant-admin.ts <使用者 id 或 LINE 名稱>
 *   本機：pnpm --filter @class/api grant-admin -- --list
 */
import { desc, eq, or } from "drizzle-orm";
import { createDb } from "../db/client.ts";
import { users } from "../db/schema/index.ts";
import { loadConfig } from "../env.ts";

// pnpm 會把 `--` 也傳進來，略過
const arg = process.argv.slice(2).find((a) => a !== "--");
const handle = await createDb(loadConfig());
const db = handle.db;

try {
  if (!arg || arg === "--list") {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(30);
    console.log("id                                    角色     狀態          LINE 名稱 / 姓名");
    for (const u of rows) {
      console.log(
        `${u.id}  ${u.role.padEnd(8)} ${u.status.padEnd(13)} ${u.lineDisplayName} / ${u.name ?? "-"}`,
      );
    }
    if (!arg) console.log("\n用法：grant-admin.ts <使用者 id 或 LINE 名稱>");
  } else {
    const isUuid = /^[0-9a-f-]{36}$/i.test(arg);
    const matches = await db
      .select()
      .from(users)
      .where(isUuid ? eq(users.id, arg) : or(eq(users.lineDisplayName, arg), eq(users.name, arg)));
    if (matches.length !== 1) {
      console.error(matches.length === 0 ? "找不到這位使用者" : "符合的使用者不只一位，請改用 id");
      process.exitCode = 1;
    } else {
      const u = matches[0]!;
      await db
        .update(users)
        .set({ role: "admin", status: "approved", name: u.name ?? u.lineDisplayName })
        .where(eq(users.id, u.id));
      console.log(`已將 ${u.lineDisplayName} 設為管理員（已核准）`);
    }
  }
} finally {
  await handle.close();
}
