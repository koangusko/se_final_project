/**
 * 直接寫資料庫的測試資料。跨模組測試（例如預約要擋課程）用這些建前置資料，
 * 不必經過別的模組的 API。
 */
import { toInstant, type DateStr, type TimeStr } from "@class/shared/time";
import type { Db } from "../src/db/client.ts";
import {
  bookingItems,
  bookings,
  courseSessions,
  courses,
  floors,
  items,
  rooms,
} from "../src/db/schema/index.ts";

let seq = 0;
const next = () => ++seq;

export async function insertFloor(db: Db, o: Partial<typeof floors.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(floors)
    .values({ level: n, name: `${n}F`, ...o })
    .returning();
  return row!;
}

export async function insertRoom(db: Db, o: Partial<typeof rooms.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(rooms)
    .values({ code: `T${100 + n}`, name: `測試教室 ${n}`, capacity: 40, ...o })
    .returning();
  return row!;
}

export async function insertItem(db: Db, o: Partial<typeof items.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(items)
    .values({ name: `物品 ${n}`, category: "other", quantity: 1, ...o })
    .returning();
  return row!;
}

export async function insertBooking(
  db: Db,
  o: {
    userId: string;
    roomId: string;
    date: DateStr;
    start: TimeStr;
    end: TimeStr;
    status?: (typeof bookings.$inferInsert)["status"];
    purpose?: string;
    items?: { itemId: string; quantity: number }[];
  },
) {
  const [row] = await db
    .insert(bookings)
    .values({
      userId: o.userId,
      roomId: o.roomId,
      startsAt: toInstant(o.date, o.start),
      endsAt: toInstant(o.date, o.end),
      purpose: o.purpose ?? "測試",
      status: o.status ?? "pending",
    })
    .returning();
  if (o.items?.length) {
    await db
      .insert(bookingItems)
      .values(
        o.items.map((it) => ({ bookingId: row!.id, itemId: it.itemId, quantity: it.quantity })),
      );
  }
  return row!;
}

export async function insertCourse(
  db: Db,
  o: {
    createdBy: string;
    teacherId?: string | null;
    name?: string;
    preferredRoomId?: string | null;
  },
) {
  const n = next();
  const [row] = await db
    .insert(courses)
    .values({
      name: o.name ?? `測試課程 ${n}`,
      createdBy: o.createdBy,
      teacherId: o.teacherId ?? null,
      preferredRoomId: o.preferredRoomId ?? null,
    })
    .returning();
  return row!;
}

export async function insertSession(
  db: Db,
  o: {
    courseId: string;
    roomId: string | null;
    date: DateStr;
    start: TimeStr;
    end: TimeStr;
    status?: "scheduled" | "cancelled";
  },
) {
  const [row] = await db
    .insert(courseSessions)
    .values({
      courseId: o.courseId,
      roomId: o.roomId,
      startsAt: toInstant(o.date, o.start),
      endsAt: toInstant(o.date, o.end),
      status: o.status ?? "scheduled",
    })
    .returning();
  return row!;
}
