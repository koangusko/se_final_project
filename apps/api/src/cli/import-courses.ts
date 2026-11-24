/**
 * 匯入 iNCNU 公開課表的快照，展開成每一次上課的時段。每學期執行一次。
 *
 *   本機：pnpm --filter @class/api import-courses -- 1151 [--dry-run]
 *   正式：docker exec class-app-1 node apps/api/src/cli/import-courses.ts 1151
 *
 * 讀取：
 *   seed-data/incnu-<學期>.json     課表快照（scripts 抓取後整理，只留在管院教室上課的課）
 *   seed-data/calendar-<學期>.json  行事曆：上課起訖日與停課日
 *
 * 規則：
 * - 以 (source=incnu, 學期, 外部編號) 對應同一門課；重新匯入會更新課程資料，
 *   並**重建該課所有時段**（在系統裡手動拖拉過的匯入課程時段會被覆蓋）。
 * - 快照裡已經沒有的匯入課程會被刪除；在系統內手動建立的課程（source=manual）不受影響。
 * - 已指派的教師帳號（teacherId）保留。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { addDays, DateStrSchema, toInstant, weekStartOf } from "@class/shared/time";
import { createDb } from "../db/client.ts";
import { courseSessions, courses, rooms, users } from "../db/schema/index.ts";
import { loadConfig } from "../env.ts";
import { buildImport, type IncnuRow } from "./incnu/parse.ts";

const Calendar = z.object({
  semester: z.string(),
  source: z.string(),
  classStart: DateStrSchema,
  classEnd: DateStrSchema,
  /** 停課日（國定假日、校慶補假等） */
  holidays: z.array(z.object({ date: DateStrSchema, name: z.string() })),
});

// pnpm 會把 `--` 也傳進來，略過
const args = process.argv.slice(2).filter((a) => a !== "--");
const semester = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!semester || !/^\d{4}$/.test(semester)) {
  console.error("用法：import-courses.ts <學期，例如 1151> [--dry-run]");
  process.exit(1);
}

const dataDir = path.join(import.meta.dirname, "seed-data");
const snapshot = JSON.parse(
  await readFile(path.join(dataDir, `incnu-${semester}.json`), "utf8"),
) as { rows: IncnuRow[] };
const calendar = Calendar.parse(
  JSON.parse(await readFile(path.join(dataDir, `calendar-${semester}.json`), "utf8")),
);
const holidays = new Map(calendar.holidays.map((h) => [h.date, h.name]));

const handle = await createDb(loadConfig());
await handle.migrate();
const db = handle.db;

const roomRows = await db.select({ id: rooms.id, code: rooms.code }).from(rooms);
const roomId = new Map(roomRows.map((r) => [r.code, r.id]));
const { courses: imported, warnings } = buildImport(snapshot.rows, new Set(roomId.keys()));
for (const w of warnings) console.warn(`警告：${w}`);

/** 每週固定時段 -> 學期內每一次上課的日期（跳過停課日） */
function datesFor(weekday: number): string[] {
  const out: string[] = [];
  for (
    let d = addDays(weekStartOf(calendar.classStart), weekday - 1);
    d <= calendar.classEnd;
    d = addDays(d, 7)
  ) {
    if (d >= calendar.classStart && !holidays.has(d)) out.push(d);
  }
  return out;
}

const sessionCount = imported.reduce(
  (n, c) => n + c.blocks.reduce((m, b) => m + datesFor(b.weekday).length, 0),
  0,
);
console.log(
  `${semester}：${imported.length} 門課、每週 ${imported.reduce((n, c) => n + c.blocks.length, 0)} 個時段，展開為 ${sessionCount} 次上課（${calendar.classStart} – ${calendar.classEnd}，停課 ${holidays.size} 天）`,
);

if (dryRun) {
  await handle.close();
  process.exit(0);
}

await db.transaction(async (tx) => {
  // 匯入用的系統帳號（不能登入，只當 createdBy）
  const [system] = await tx
    .insert(users)
    .values({
      lineUserId: "system:incnu",
      lineDisplayName: "iNCNU 課表匯入",
      name: "iNCNU 課表匯入",
      status: "approved",
    })
    .onConflictDoUpdate({ target: users.lineUserId, set: { lineDisplayName: "iNCNU 課表匯入" } })
    .returning({ id: users.id });
  if (!system) throw new Error("無法建立匯入用帳號");

  const keepIds: string[] = [];
  for (const c of imported) {
    const values = {
      code: c.code,
      name: c.name,
      teacherName: c.teacherName,
      unitName: c.unitName,
      description: c.description,
      preferredRoomId: roomId.get(c.blocks[0]!.roomCode) ?? null,
    };
    const [row] = await tx
      .insert(courses)
      .values({
        ...values,
        source: "incnu",
        semester,
        externalId: c.externalId,
        createdBy: system.id,
      })
      .onConflictDoUpdate({
        target: [courses.source, courses.semester, courses.externalId],
        set: values,
      })
      .returning({ id: courses.id });
    if (!row) throw new Error(`匯入失敗：${c.code}`);
    keepIds.push(row.id);

    await tx.delete(courseSessions).where(eq(courseSessions.courseId, row.id));
    const sessions = c.blocks.flatMap((b) =>
      datesFor(b.weekday).map((date) => ({
        courseId: row.id,
        roomId: roomId.get(b.roomCode) ?? null,
        startsAt: toInstant(date, b.start),
        endsAt: toInstant(date, b.end),
      })),
    );
    if (sessions.length > 0) await tx.insert(courseSessions).values(sessions);
  }

  const removed = await tx
    .delete(courses)
    .where(
      and(
        eq(courses.source, "incnu"),
        eq(courses.semester, semester),
        keepIds.length > 0 ? notInArray(courses.id, keepIds) : undefined,
      ),
    )
    .returning({ id: courses.id });
  console.log(`完成：匯入 ${keepIds.length} 門，移除快照中已不存在的 ${removed.length} 門`);
});

await handle.close();
