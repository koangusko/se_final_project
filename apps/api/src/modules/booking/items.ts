/** 物品：DTO、可借數量、管理時的欄位檢查。 */
import { and, asc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import {
  OCCUPYING_BOOKING_STATUSES,
  type ItemAvailabilityDto,
  type ItemCategory,
  type ItemDto,
} from "@class/shared/booking";
import { AppError, validationError } from "../../core/errors.ts";
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

/**
 * 檢查要借的物品：存在、啟用、鑰匙屬於這間教室（否則 400），
 * 該時段數量足夠（否則 409 ITEM_UNAVAILABLE，details 列出不足的物品）。
 */
export async function assertItemsAvailable(
  db: Db,
  requested: { itemId: string; quantity: number }[],
  q: { roomId: string; start: Date; end: Date; excludeBookingId?: string },
): Promise<void> {
  if (requested.length === 0) return;
  const rows = await db
    .select()
    .from(items)
    .where(
      inArray(
        items.id,
        requested.map((r) => r.itemId),
      ),
    );
  for (const r of requested) {
    const item = rows.find((i) => i.id === r.itemId);
    if (!item || !item.isActive) {
      throw validationError("選擇的物品不存在或已停用", { items: "選擇的物品不存在或已停用" });
    }
    if (item.roomId !== null && item.roomId !== q.roomId) {
      const msg = `「${item.name}」不是這間教室的鑰匙`;
      throw validationError(msg, { items: msg });
    }
  }

  const availability = await itemAvailability(db, q);
  const short = requested
    .map((r) => {
      const a = availability.find((x) => x.id === r.itemId);
      return {
        itemId: r.itemId,
        name: a?.name ?? "",
        requested: r.quantity,
        available: a?.available ?? 0,
      };
    })
    .filter((x) => x.requested > x.available);
  if (short.length > 0) {
    throw new AppError(
      409,
      "ITEM_UNAVAILABLE",
      `物品數量不足：${short.map((s) => `${s.name}（剩 ${s.available}）`).join("、")}`,
      short,
    );
  }
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
