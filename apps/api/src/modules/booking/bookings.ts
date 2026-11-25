/** 預約：建立、查詢組成 DTO、寫歷程。 */
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
  BOOKING_LEAD_DAYS,
  BOOKING_STATUS_LABELS,
  type BookingDto,
  type BookingEventAction,
  type BookingEventDto,
  type BookingStatus,
  type CreateBookingInput,
  type ReviewBookingInput,
} from "@class/shared/booking";
import { addDays, todayInTaipei, toInstant } from "@class/shared/time";
import { can, canCancelBooking } from "@class/shared/permissions";
import { toUserRef } from "../../auth/users.ts";
import { isExclusionViolation } from "../../core/db-errors.ts";
import { AppError, invalidState, notFound, validationError } from "../../core/errors.ts";
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

export async function findEvents(db: Db, bookingId: string): Promise<BookingEventDto[]> {
  const rows = await db
    .select({
      id: bookingEvents.id,
      action: bookingEvents.action,
      note: bookingEvents.note,
      at: bookingEvents.at,
      actor: { id: users.id, name: users.name, lineDisplayName: users.lineDisplayName },
    })
    .from(bookingEvents)
    .innerJoin(users, eq(bookingEvents.actorId, users.id))
    .where(eq(bookingEvents.bookingId, bookingId))
    .orderBy(asc(bookingEvents.at));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    note: r.note,
    at: r.at.toISOString(),
    actor: toUserRef(r.actor),
  }));
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

/** 狀態不允許這個動作就丟 409 INVALID_STATE，訊息寫明目前狀態 */
export function expectStatus(current: BookingStatus, allowed: BookingStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw invalidState(`預約目前是「${BOOKING_STATUS_LABELS[current]}」，不能${action}`);
  }
}

/**
 * 審核待審核的預約。核准時再檢查一次教室占用與物品；
 * 檢查完到寫入之間被別人核准了重疊的預約時，資料庫約束擋下，轉成 409 ROOM_OCCUPIED。
 */
export async function reviewBooking(
  db: Db,
  reviewer: CurrentUser,
  id: string,
  input: ReviewBookingInput,
): Promise<void> {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!row) throw notFound("預約");
  expectStatus(row.status, ["pending"], "審核");

  const approve = input.decision === "approve";
  if (approve) {
    await assertRoomFree(db, row.roomId, row.startsAt, row.endsAt, { excludeBookingId: id });
    const requested = await db
      .select({ itemId: bookingItems.itemId, quantity: bookingItems.quantity })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, id));
    await assertItemsAvailable(db, requested, {
      roomId: row.roomId,
      start: row.startsAt,
      end: row.endsAt,
      excludeBookingId: id,
    });
  }

  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(bookings)
        .set({
          status: approve ? "approved" : "rejected",
          reviewNote: input.note || null,
          reviewedBy: reviewer.id,
          reviewedAt: new Date(),
        })
        // 只改還是待審核的；同時有人先審過就不會重複審
        .where(and(eq(bookings.id, id), eq(bookings.status, "pending")))
        .returning({ id: bookings.id });
      if (updated.length === 0) throw invalidState("這筆預約剛剛已經被審核過了");
      await recordEvent(tx, id, reviewer.id, approve ? "approved" : "rejected", input.note || null);
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError(409, "ROOM_OCCUPIED", "這個時段教室剛剛已被其他已核准的預約占用");
    }
    throw err;
  }
}

const HANDOVER = {
  checkout: { from: "approved", to: "checked_out", label: "借出" },
  return: { from: "checked_out", to: "returned", label: "歸還" },
} as const;

/** 借出（approved → checked_out）或歸還（checked_out → returned），記錄時間與經手人 */
export async function handoverBooking(
  db: Db,
  handler: CurrentUser,
  id: string,
  kind: keyof typeof HANDOVER,
  note: string | undefined,
): Promise<void> {
  const step = HANDOVER[kind];
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!row) throw notFound("預約");
  expectStatus(row.status, [step.from], step.label);

  const now = new Date();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set(
        kind === "checkout"
          ? { status: step.to, checkedOutAt: now, checkedOutBy: handler.id }
          : { status: step.to, returnedAt: now, returnedBy: handler.id },
      )
      .where(and(eq(bookings.id, id), eq(bookings.status, step.from)))
      .returning({ id: bookings.id });
    if (updated.length === 0) throw invalidState(`這筆預約剛剛已經${step.label}過了`);
    await recordEvent(tx, id, handler.id, step.to, note || null);
  });
}

/**
 * 取消預約，依 canCancelBooking：本人只能取消待審核的，管理員可以取消待審核與已核准的。
 * 別人的預約（非管理員）當作不存在。
 */
export async function cancelBooking(db: Db, me: CurrentUser, id: string): Promise<void> {
  const actor = { id: me.id, role: me.role, status: me.status };
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!row || (row.userId !== actor.id && !can(actor, "booking.viewAll"))) {
    throw notFound("預約");
  }
  if (!canCancelBooking(actor, row)) {
    if (row.status === "approved") {
      throw invalidState("已核准的預約不能自行取消，請聯絡管理員");
    }
    throw invalidState(`預約目前是「${BOOKING_STATUS_LABELS[row.status]}」，不能取消`);
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({ status: "cancelled" })
      .where(and(eq(bookings.id, id), eq(bookings.status, row.status)))
      .returning({ id: bookings.id });
    if (updated.length === 0) throw invalidState("這筆預約的狀態剛剛變了，請重新整理");
    await recordEvent(tx, id, me.id, "cancelled");
  });
}
