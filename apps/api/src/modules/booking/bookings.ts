/** 預約：建立、查詢組成 DTO、寫歷程。 */
import { asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
  BOOKING_LEAD_DAYS,
  type BookingDto,
  type BookingEventAction,
  type CreateBookingInput,
} from "@class/shared/booking";
import { addDays, todayInTaipei, toInstant } from "@class/shared/time";
import { toUserRef } from "../../auth/users.ts";
import { invalidState, notFound, validationError } from "../../core/errors.ts";
import type { CurrentUser } from "../../core/http.ts";
import { assertRoomFree } from "../../core/occupancy.ts";
import type { Db } from "../../db/client.ts";
import {
  bookingEvents,
  bookingItems,
  bookings,
  items,
  rooms,
  users,
} from "../../db/schema/index.ts";
import { assertItemsAvailable } from "./items.ts";

/** 依條件查預約並組成 DTO（含借用人、教室、物品） */
export async function findBookings(
  db: Db,
  where: SQL | undefined,
  order: "asc" | "desc" = "desc",
): Promise<BookingDto[]> {
  const rows = await db
    .select({
      b: bookings,
      user: { id: users.id, name: users.name, lineDisplayName: users.lineDisplayName },
      room: { id: rooms.id, code: rooms.code, name: rooms.name },
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(where)
    .orderBy(order === "asc" ? asc(bookings.startsAt) : desc(bookings.startsAt));
  if (rows.length === 0) return [];

  const itemRows = await db
    .select({
      bookingId: bookingItems.bookingId,
      itemId: items.id,
      name: items.name,
      category: items.category,
      quantity: bookingItems.quantity,
    })
    .from(bookingItems)
    .innerJoin(items, eq(bookingItems.itemId, items.id))
    .where(
      inArray(
        bookingItems.bookingId,
        rows.map((r) => r.b.id),
      ),
    )
    .orderBy(asc(items.category), asc(items.name));
  const byBooking = Map.groupBy(itemRows, (r) => r.bookingId);

  return rows.map(({ b, user, room }) => ({
    id: b.id,
    user: toUserRef(user),
    room,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    purpose: b.purpose,
    attendeeCount: b.attendeeCount,
    status: b.status,
    items: (byBooking.get(b.id) ?? []).map(({ itemId, name, category, quantity }) => ({
      itemId,
      name,
      category,
      quantity,
    })),
    reviewNote: b.reviewNote,
    reviewedAt: b.reviewedAt?.toISOString() ?? null,
    checkedOutAt: b.checkedOutAt?.toISOString() ?? null,
    returnedAt: b.returnedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function findBooking(db: Db, id: string): Promise<BookingDto | null> {
  const [b] = await findBookings(db, eq(bookings.id, id));
  return b ?? null;
}

export async function recordEvent(
  db: Db,
  bookingId: string,
  actorId: string,
  action: BookingEventAction,
  note?: string | null,
) {
  await db.insert(bookingEvents).values({ bookingId, actorId, action, note: note ?? null });
}

/**
 * 建立待審核的預約。規則見 docs/modules/booking.md「規則」：
 * 教室可預約、不在過去、3 天前申請（管理員不受限）、教室沒被占用、物品夠借。
 */
export async function createBooking(
  db: Db,
  me: CurrentUser,
  input: CreateBookingInput,
): Promise<string> {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, input.roomId));
  if (!room) throw notFound("教室");
  if (!room.isActive || !room.isBookable) throw invalidState(`${room.code} 不開放預約`);

  const start = toInstant(input.date, input.startTime);
  const end = toInstant(input.date, input.endTime);
  if (start.getTime() <= Date.now()) {
    throw validationError("不能預約已經過去的時段", { date: "不能預約已經過去的時段" });
  }
  const earliest = addDays(todayInTaipei(), BOOKING_LEAD_DAYS);
  if (me.role !== "admin" && input.date < earliest) {
    throw validationError(`請在使用日 ${BOOKING_LEAD_DAYS} 天前申請`, {
      date: `最早可以預約 ${earliest}`,
    });
  }

  await assertRoomFree(db, room.id, start, end);
  await assertItemsAvailable(db, input.items, { roomId: room.id, start, end });

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(bookings)
      .values({
        userId: me.id,
        roomId: room.id,
        startsAt: start,
        endsAt: end,
        purpose: input.purpose,
        attendeeCount: input.attendeeCount ?? null,
      })
      .returning({ id: bookings.id });
    if (!row) throw new Error("insert booking returned nothing");
    if (input.items.length > 0) {
      await tx
        .insert(bookingItems)
        .values(
          input.items.map((i) => ({ bookingId: row.id, itemId: i.itemId, quantity: i.quantity })),
        );
    }
    await recordEvent(tx, row.id, me.id, "created");
    return row.id;
  });
}
