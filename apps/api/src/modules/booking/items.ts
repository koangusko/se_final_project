/** 物品：DTO、可借數量、管理時的欄位檢查。 */
import { and, asc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import {
  OCCUPYING_BOOKING_STATUSES,
  type ItemAvailabilityDto,
  type ItemCategory,
  type ItemDto,
} from "@class/shared/booking";
import { validationError } from "../../core/errors.ts";
import type { Db } from "../../db/client.ts";
import { bookingItems, bookings, items, rooms } from "../../db/schema/index.ts";

type ItemRow = typeof items.$inferSelect;

export function toItemDto(i: ItemRow): ItemDto {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    roomId: i.roomId,
    quantity: i.quantity,
    description: i.description,
    isActive: i.isActive,
  };
}

/** 啟用中的共用物品，加上該教室的鑰匙（沒給教室時只有共用物品） */
export async function listBorrowableItems(db: Db, roomId?: string): Promise<ItemRow[]> {
  return db
    .select()
    .from(items)
    .where(
      and(
        eq(items.isActive, true),
        roomId ? or(isNull(items.roomId), eq(items.roomId, roomId)) : isNull(items.roomId),
      ),
    )
    .orderBy(asc(items.category), asc(items.name));
}

/**
 * 該時段每個物品還能借幾個。
 * 用掃描線算「同一時間最多被借走幾個」，不是把所有重疊預約的數量加總
 * （10–11 點和 11–12 點各借一台，對 10–12 點來說同時只被借走一台）。
 */
export async function itemAvailability(
  db: Db,
  q: { roomId?: string | undefined; start: Date; end: Date; excludeBookingId?: string },
): Promise<ItemAvailabilityDto[]> {
  const list = await listBorrowableItems(db, q.roomId);
  if (list.length === 0) return [];

  const used = await db
    .select({
      itemId: bookingItems.itemId,
      quantity: bookingItems.quantity,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .where(
      and(
        inArray(
          bookingItems.itemId,
          list.map((i) => i.id),
        ),
        inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
        lt(bookings.startsAt, q.end),
        gt(bookings.endsAt, q.start),
        q.excludeBookingId ? ne(bookings.id, q.excludeBookingId) : undefined,
      ),
    );

  const peak = new Map<string, number>();
  for (const [itemId, uses] of Map.groupBy(used, (u) => u.itemId)) {
    const points = uses.flatMap((u) => [
      { t: Math.max(u.startsAt.getTime(), q.start.getTime()), d: u.quantity },
      { t: Math.min(u.endsAt.getTime(), q.end.getTime()), d: -u.quantity },
    ]);
    // 同一時間點先歸還再借出（半開區間）
    points.sort((a, b) => a.t - b.t || a.d - b.d);
    let cur = 0;
    let max = 0;
    for (const p of points) {
      cur += p.d;
      max = Math.max(max, cur);
    }
    peak.set(itemId, max);
  }

  return list.map((i) =>
    Object.assign(toItemDto(i), { available: Math.max(0, i.quantity - (peak.get(i.id) ?? 0)) }),
  );
}

/** 鑰匙一定要綁一間存在的教室；其他物品不綁教室 */
export async function assertItemRoom(
  db: Db,
  v: { category: ItemCategory; roomId: string | null },
): Promise<void> {
  if (v.category !== "key") {
    if (v.roomId !== null) {
      throw validationError("只有鑰匙要選所屬教室", { roomId: "只有鑰匙要選所屬教室" });
    }
    return;
  }
  if (v.roomId === null) {
    throw validationError("鑰匙要選所屬教室", { roomId: "請選擇所屬教室" });
  }
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, v.roomId));
  if (!room) throw validationError("找不到所屬教室", { roomId: "找不到這間教室" });
}
