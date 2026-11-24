/**
 * 教室占用：三個模組共用的唯一計算入口。定義見 packages/shared/src/occupancy.ts。
 *
 * - 預約模組：建立/核准預約前呼叫 assertRoomFree（課程時段要擋；預約之間另有 DB 約束）。
 * - 排課模組：衝突清單用 listOccupancy 找課程與已核准預約的重疊。
 * - 空間模組：顯示教室目前/本週是否有人用。
 * 不要在模組裡自己寫「查預約 + 查課程」的重疊邏輯，一律呼叫這裡。
 */
import { and, asc, eq, gt, inArray, isNotNull, lt, ne, type SQL } from "drizzle-orm";
import { OCCUPYING_BOOKING_STATUSES } from "@class/shared/booking";
import type { OccupancyDto, OccupancySource } from "@class/shared/occupancy";
import type { Db } from "../db/client.ts";
import { bookings, courseSessions, courses, rooms } from "../db/schema/index.ts";
import { AppError } from "./errors.ts";

export interface OccupancyEntry {
  roomId: string;
  roomCode: string;
  startsAt: Date;
  endsAt: Date;
  source: OccupancySource;
  refId: string;
  label: string;
}

export interface OccupancyFilter {
  /** 省略表示所有教室 */
  roomIds?: string[];
  from: Date;
  to: Date;
  excludeBookingId?: string;
  excludeSessionId?: string;
  /** 只看某一種來源 */
  sources?: OccupancySource[];
}

export async function listOccupancy(db: Db, f: OccupancyFilter): Promise<OccupancyEntry[]> {
  const want = (s: OccupancySource) => !f.sources || f.sources.includes(s);
  const out: OccupancyEntry[] = [];

  if (want("booking")) {
    const where: (SQL | undefined)[] = [
      inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
      lt(bookings.startsAt, f.to),
      gt(bookings.endsAt, f.from),
      f.roomIds ? inArray(bookings.roomId, f.roomIds) : undefined,
      f.excludeBookingId ? ne(bookings.id, f.excludeBookingId) : undefined,
    ];
    const rows = await db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        roomCode: rooms.code,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(and(...where));
    for (const r of rows) {
      out.push({ ...r, source: "booking", refId: r.id, label: "已預約" });
    }
  }

  if (want("course")) {
    const where: (SQL | undefined)[] = [
      eq(courseSessions.status, "scheduled"),
      isNotNull(courseSessions.roomId),
      lt(courseSessions.startsAt, f.to),
      gt(courseSessions.endsAt, f.from),
      f.roomIds ? inArray(courseSessions.roomId, f.roomIds) : undefined,
      f.excludeSessionId ? ne(courseSessions.id, f.excludeSessionId) : undefined,
    ];
    const rows = await db
      .select({
        id: courseSessions.id,
        roomId: courseSessions.roomId,
        startsAt: courseSessions.startsAt,
        endsAt: courseSessions.endsAt,
        roomCode: rooms.code,
        courseName: courses.name,
      })
      .from(courseSessions)
      .innerJoin(courses, eq(courseSessions.courseId, courses.id))
      .innerJoin(rooms, eq(courseSessions.roomId, rooms.id))
      .where(and(...where))
      .orderBy(asc(courseSessions.startsAt));
    for (const r of rows) {
      if (!r.roomId) continue;
      out.push({
        roomId: r.roomId,
        roomCode: r.roomCode,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        source: "course",
        refId: r.id,
        label: r.courseName,
      });
    }
  }

  return out.toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function toOccupancyDto(e: OccupancyEntry): OccupancyDto {
  return {
    roomId: e.roomId,
    roomCode: e.roomCode,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    source: e.source,
    refId: e.refId,
    label: e.label,
  };
}

/**
 * 教室在 [start, end) 被占用就丟 409 ROOM_OCCUPIED，details 是衝突清單（OccupancyDto[]）。
 */
export async function assertRoomFree(
  db: Db,
  roomId: string,
  start: Date,
  end: Date,
  opts: Omit<OccupancyFilter, "roomIds" | "from" | "to"> = {},
): Promise<void> {
  const conflicts = await listOccupancy(db, { ...opts, roomIds: [roomId], from: start, to: end });
  if (conflicts.length > 0) {
    const what = conflicts
      .map((c) => (c.source === "course" ? `課程「${c.label}」` : "其他已核准的預約"))
      .join("、");
    throw new AppError(
      409,
      "ROOM_OCCUPIED",
      `這個時段教室已被占用：${what}`,
      conflicts.map(toOccupancyDto),
    );
  }
}
