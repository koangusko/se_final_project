/**
 * /api/booking/*：空間/物品預約借用。
 *
 * 規格與任務清單：docs/modules/booking.md
 * 這個檔案是模組的 API 入口，已經掛在 apps/api/src/routes.ts，不需要改那裡。
 * 路由要用串接寫法（new Hono().get(...).post(...)），前端的型別才推得出來。
 */
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  BOOKING_STATUSES,
  BookingListQuery,
  CreateBookingInput,
  HandoverInput,
  ItemAvailabilityQuery,
  ItemInput,
  ItemPatch,
  ReviewBookingInput,
  type BookingDetailDto,
} from "@class/shared/booking";
import { can } from "@class/shared/permissions";
import { DateStrSchema, toInstant, weekRange, weekStartOf } from "@class/shared/time";
import { notFound } from "../../core/errors.ts";
import { actorOf, requireAction, requireApproved } from "../../core/guards.ts";
import type { AppEnv } from "../../core/http.ts";
import { listOccupancy, toOccupancyDto } from "../../core/occupancy.ts";
import { validate } from "../../core/validate.ts";
import { bookings, items, rooms } from "../../db/schema/index.ts";
import {
  cancelBooking,
  createBooking,
  findBooking,
  findBookings,
  findEvents,
  handoverBooking,
  reviewBooking,
} from "./bookings.ts";
import { assertItemRoom, itemAvailability, listBorrowableItems, toItemDto } from "./items.ts";

const idParam = z.object({ id: z.uuid() });

export const bookingRoutes = new Hono<AppEnv>()
  // 整個模組至少要已登入且核准
  .use(requireAction("booking.viewOwn"))

  // ---- B1 物品 ----
  .get("/items", validate("query", z.object({ roomId: z.uuid().optional() })), async (c) => {
    const { roomId } = c.req.valid("query");
    const rows = await listBorrowableItems(c.var.db, roomId);
    return c.json({ items: rows.map(toItemDto) });
  })

  .get("/items/availability", validate("query", ItemAvailabilityQuery), async (c) => {
    const q = c.req.valid("query");
    const list = await itemAvailability(c.var.db, {
      roomId: q.roomId,
      start: toInstant(q.date, q.startTime),
      end: toInstant(q.date, q.endTime),
    });
    return c.json({ items: list });
  })

  .get("/admin/items", requireAction("item.manage"), async (c) => {
    const rows = await c.var.db.select().from(items).orderBy(asc(items.category), asc(items.name));
    return c.json({ items: rows.map(toItemDto) });
  })

  .post("/admin/items", requireAction("item.manage"), validate("json", ItemInput), async (c) => {
    const input = c.req.valid("json");
    await assertItemRoom(c.var.db, input);
    const [row] = await c.var.db.insert(items).values(input).returning();
    if (!row) throw new Error("insert item returned nothing");
    return c.json({ item: toItemDto(row) }, 201);
  })

  .patch(
    "/admin/items/:id",
    requireAction("item.manage"),
    validate("param", idParam),
    validate("json", ItemPatch),
    async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const [current] = await c.var.db.select().from(items).where(eq(items.id, id));
      if (!current) throw notFound("物品");
      await assertItemRoom(c.var.db, {
        category: patch.category ?? current.category,
        roomId: patch.roomId === undefined ? current.roomId : patch.roomId,
      });
      const [row] = await c.var.db.update(items).set(patch).where(eq(items.id, id)).returning();
      if (!row) throw notFound("物品");
      return c.json({ item: toItemDto(row) });
    },
  )

  // ---- B2 建立預約 ----
  .post(
    "/bookings",
    requireAction("booking.create"),
    validate("json", CreateBookingInput),
    async (c) => {
      const me = requireApproved(c);
      const id = await createBooking(c.var.db, me, c.req.valid("json"));
      const booking = await findBooking(c.var.db, id);
      if (!booking) throw notFound("預約");
      return c.json({ booking }, 201);
    },
  )

  // ---- B3 教室週狀態 ----
  .get(
    "/rooms/:id/week",
    validate("param", idParam),
    validate("query", z.object({ week: DateStrSchema })),
    async (c) => {
      const me = requireApproved(c);
      const { id } = c.req.valid("param");
      const [room] = await c.var.db
        .select({ id: rooms.id, code: rooms.code, name: rooms.name, capacity: rooms.capacity })
        .from(rooms)
        .where(and(eq(rooms.id, id), eq(rooms.isActive, true)));
      if (!room) throw notFound("教室");
      const { start, end } = weekRange(weekStartOf(c.req.valid("query").week));
      const occupancy = await listOccupancy(c.var.db, { roomIds: [id], from: start, to: end });
      const mine = await findBookings(
        c.var.db,
        and(
          eq(bookings.roomId, id),
          eq(bookings.userId, me.id),
          eq(bookings.status, "pending"),
          lt(bookings.startsAt, end),
          gt(bookings.endsAt, start),
        ),
        "asc",
      );
      return c.json({ room, occupancy: occupancy.map(toOccupancyDto), mine });
    },
  )

  // ---- B5 借用紀錄（mine 要在 :id 前面） ----
  .get(
    "/bookings/mine",
    validate("query", z.object({ status: z.enum(BOOKING_STATUSES).optional() })),
    async (c) => {
      const me = requireApproved(c);
      const { status } = c.req.valid("query");
      const list = await findBookings(
        c.var.db,
        and(eq(bookings.userId, me.id), status ? eq(bookings.status, status) : undefined),
      );
      return c.json({ bookings: list });
    },
  )

  .get("/bookings/:id", validate("param", idParam), async (c) => {
    const me = requireApproved(c);
    const booking = await findBooking(c.var.db, c.req.valid("param").id);
    // 別人的預約一律當作不存在，不透露有這筆
    if (!booking || (booking.user.id !== me.id && !can(actorOf(c), "booking.viewAll"))) {
      throw notFound("預約");
    }
    const detail: BookingDetailDto = { ...booking, events: await findEvents(c.var.db, booking.id) };
    return c.json({ booking: detail });
  })

  // ---- B6 審核 ----
  .get(
    "/admin/bookings",
    requireAction("booking.viewAll"),
    validate("query", BookingListQuery),
    async (c) => {
      const q = c.req.valid("query");
      const where = and(
        q.status ? eq(bookings.status, q.status) : undefined,
        q.roomId ? eq(bookings.roomId, q.roomId) : undefined,
        // 依使用日：from 含、to 不含
        q.from ? gte(bookings.startsAt, toInstant(q.from, "00:00")) : undefined,
        q.to ? lt(bookings.startsAt, toInstant(q.to, "00:00")) : undefined,
      );
      // 還要處理的（待審核、待借出、借出中）依時間先後，其他新到舊
      const todo = q.status === "pending" || q.status === "approved" || q.status === "checked_out";
      return c.json({ bookings: await findBookings(c.var.db, where, todo ? "asc" : "desc") });
    },
  )

  .post(
    "/admin/bookings/:id/review",
    requireAction("booking.review"),
    validate("param", idParam),
    validate("json", ReviewBookingInput),
    async (c) => {
      const { id } = c.req.valid("param");
      await reviewBooking(c.var.db, requireApproved(c), id, c.req.valid("json"));
      const booking = await findBooking(c.var.db, id);
      if (!booking) throw notFound("預約");
      return c.json({ booking });
    },
  )

  // ---- B7 借出與歸還 ----
  .post(
    "/admin/bookings/:id/checkout",
    requireAction("booking.handover"),
    validate("param", idParam),
    validate("json", HandoverInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { note } = c.req.valid("json");
      await handoverBooking(c.var.db, requireApproved(c), id, "checkout", note);
      const booking = await findBooking(c.var.db, id);
      if (!booking) throw notFound("預約");
      return c.json({ booking });
    },
  )

  .post(
    "/admin/bookings/:id/return",
    requireAction("booking.handover"),
    validate("param", idParam),
    validate("json", HandoverInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { note } = c.req.valid("json");
      await handoverBooking(c.var.db, requireApproved(c), id, "return", note);
      const booking = await findBooking(c.var.db, id);
      if (!booking) throw notFound("預約");
      return c.json({ booking });
    },
  )

  // ---- B8 取消 ----
  .post("/bookings/:id/cancel", validate("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    await cancelBooking(c.var.db, requireApproved(c), id);
    const booking = await findBooking(c.var.db, id);
    if (!booking) throw notFound("預約");
    return c.json({ booking });
  });
