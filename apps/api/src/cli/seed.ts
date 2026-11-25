/**
 * 種子資料：管院樓層、教室主檔、可借用物品。可以重複執行。
 *
 *   本機：pnpm db:seed
 *   正式：docker exec class-app-1 node apps/api/src/cli/seed.ts
 *
 * 教室主檔 seed-data/rooms.json 的來源：
 *   1. 管理學院場所管理要點附表二（115-03-11 修正）：可借場地的人數、管理單位、收費（以此為準）
 *   2. 管院網站「空間/教室」列表：設備、辦公室與研究室
 *   3. iNCNU 115-1 公開課表：課程有用到、但前兩者沒列的空間
 * 重新執行會以主檔覆蓋教室的基本資料（名稱、類型、人數、設備、可否預約、管理單位、收費），
 * 不會動管理員調整的平面圖位置與上傳的媒體。
 *
 * 加 --demo 另外建立示範用的教師與課程、預約（只在本機用）。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import type { RoomType } from "@class/shared/space";
import { addDays, todayInTaipei, toInstant, weekStartOf } from "@class/shared/time";
import { createDb } from "../db/client.ts";
import {
  bookings,
  courseSessions,
  courses,
  floors,
  items,
  rooms,
  users,
} from "../db/schema/index.ts";
import { loadConfig } from "../env.ts";

interface SeedRoom {
  code: string;
  name: string;
  building: string;
  level: number | null;
  capacity: number;
  type: RoomType;
  equipment: string[];
  isBookable: boolean;
  managingUnit: string | null;
  hourlyFee: number | null;
  description: string;
}

const floorName = (level: number) => (level < 0 ? `B${-level}` : `${level}F`);

const config = loadConfig();
const handle = await createDb(config);
await handle.migrate();
const db = handle.db;

const data = JSON.parse(
  await readFile(path.join(import.meta.dirname, "seed-data/rooms.json"), "utf8"),
) as { rooms: SeedRoom[] };

// 樓層
const floorIds = new Map<string, string>();
for (const r of data.rooms) {
  if (r.level === null) continue;
  const key = `${r.building}|${r.level}`;
  if (floorIds.has(key)) continue;
  const [row] = await db
    .insert(floors)
    .values({ building: r.building, level: r.level, name: floorName(r.level) })
    .onConflictDoUpdate({
      target: [floors.building, floors.level],
      set: { name: floorName(r.level) },
    })
    .returning({ id: floors.id });
  if (row) floorIds.set(key, row.id);
}

// 教室：以代碼為準，新增或以主檔覆蓋基本資料
for (const r of data.rooms) {
  const values = {
    name: r.name,
    floorId: r.level === null ? null : (floorIds.get(`${r.building}|${r.level}`) ?? null),
    type: r.type,
    capacity: r.capacity,
    equipment: r.equipment,
    description: r.description,
    isBookable: r.isBookable,
    managingUnit: r.managingUnit,
    hourlyFee: r.hourlyFee,
    isActive: true,
  };
  await db
    .insert(rooms)
    .values({ code: r.code, ...values })
    .onConflictDoUpdate({ target: rooms.code, set: values });
}

// 鑰匙：每間可預約的教室一把；不再開放預約的教室，鑰匙停用
const bookable = await db
  .select({ id: rooms.id, code: rooms.code })
  .from(rooms)
  .where(and(eq(rooms.isBookable, true), eq(rooms.isActive, true)));
const existingKeys = await db
  .select({ roomId: items.roomId })
  .from(items)
  .where(and(eq(items.category, "key"), isNotNull(items.roomId)));
const hasKey = new Set(existingKeys.map((k) => k.roomId));
const missing = bookable.filter((r) => !hasKey.has(r.id));
if (missing.length > 0) {
  await db.insert(items).values(
    missing.map((r) => ({
      name: `${r.code} 鑰匙`,
      category: "key" as const,
      roomId: r.id,
      quantity: 1,
    })),
  );
}
const bookableIds = bookable.map((r) => r.id);
const deactivated = await db
  .update(items)
  .set({ isActive: false })
  .where(
    and(
      eq(items.category, "key"),
      eq(items.isActive, true),
      bookableIds.length > 0 ? notInArray(items.roomId, bookableIds) : undefined,
    ),
  )
  .returning({ id: items.id });

// 共用物品：第一次執行才建立（數量是暫定值，請管理員依實際數量在「物品管理」修改）
const [{ n: sharedCount } = { n: 0 }] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(items)
  .where(inArray(items.category, ["pointer", "laptop", "other"]));
if (sharedCount === 0) {
  await db.insert(items).values([
    { name: "投影筆", category: "pointer" as const, quantity: 6 },
    {
      name: "筆電",
      category: "laptop" as const,
      quantity: 4,
      description: "Windows 筆電，附電源線",
    },
    { name: "HDMI 轉接頭", category: "other" as const, quantity: 5 },
    { name: "延長線", category: "other" as const, quantity: 4 },
  ]);
}

console.log(
  `樓層 ${floorIds.size}、教室 ${data.rooms.length}（可預約 ${bookable.length}）、新增鑰匙 ${missing.length}、停用鑰匙 ${deactivated.length}`,
);

if (process.argv.includes("--demo")) await seedDemo();

await handle.close();

/** 示範資料：兩位教師、三門課（本週與下週）、幾筆預約。只在本機用 */
async function seedDemo() {
  const upsertUser = async (
    lineUserId: string,
    name: string,
    role: "teacher" | "user" | "admin",
  ) => {
    const [u] = await db
      .insert(users)
      .values({
        lineUserId,
        lineDisplayName: name,
        name,
        affiliation: "示範資料",
        role,
        status: "approved",
      })
      .onConflictDoUpdate({ target: users.lineUserId, set: { role, status: "approved" } })
      .returning({ id: users.id });
    return u!.id;
  };
  const t1 = await upsertUser("demo-teacher-1", "林老師", "teacher");
  const t2 = await upsertUser("demo-teacher-2", "陳老師", "teacher");
  const student = await upsertUser("demo-user-1", "王同學", "user");

  const roomByCode = async (code: string) =>
    (await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)))[0]!.id;
  const r212 = await roomByCode("管212");
  const r331 = await roomByCode("管331");
  const r350 = await roomByCode("管350");

  const week = weekStartOf(todayInTaipei());
  const existing = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.createdBy, t1));
  if (existing.length === 0) {
    const mk = async (
      name: string,
      code: string,
      teacherId: string,
      roomId: string,
      day: number,
      s: string,
      e: string,
    ) => {
      const [c] = await db
        .insert(courses)
        .values({ name, code, teacherId, preferredRoomId: roomId, createdBy: teacherId })
        .returning({ id: courses.id });
      for (let w = 0; w < 2; w++) {
        const date = addDays(week, day + w * 7);
        await db.insert(courseSessions).values({
          courseId: c!.id,
          roomId,
          startsAt: toInstant(date, s),
          endsAt: toInstant(date, e),
        });
      }
    };
    await mk("資料庫系統", "IM301", t1, r212, 0, "09:10", "12:00");
    await mk("管理數學", "IB102", t2, r331, 2, "13:10", "16:00");
    // 刻意與資料庫系統同教室同時段，衝突清單會列出
    await mk("專題討論", "IM499", t2, r212, 0, "10:10", "12:00");
  }

  const has = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.userId, student), eq(bookings.roomId, r350)));
  if (has.length === 0) {
    await db.insert(bookings).values([
      {
        userId: student,
        roomId: r350,
        startsAt: toInstant(addDays(week, 1), "18:00"),
        endsAt: toInstant(addDays(week, 1), "20:00"),
        purpose: "讀書會",
        status: "approved",
        reviewedAt: new Date(),
      },
      {
        userId: student,
        roomId: r350,
        startsAt: toInstant(addDays(week, 3), "14:00"),
        endsAt: toInstant(addDays(week, 3), "16:00"),
        purpose: "小組報告練習",
        status: "pending",
      },
    ]);
  }
  console.log("示範資料已建立");
}
