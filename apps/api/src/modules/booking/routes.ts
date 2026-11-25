/**
 * /api/booking/*：空間/物品預約借用。
 *
 * 規格與任務清單：docs/modules/booking.md
 * 這個檔案是模組的 API 入口，已經掛在 apps/api/src/routes.ts，不需要改那裡。
 * 路由要用串接寫法（new Hono().get(...).post(...)），前端的型別才推得出來。
 */
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { ItemAvailabilityQuery, ItemInput, ItemPatch } from "@class/shared/booking";
import { toInstant } from "@class/shared/time";
import { notFound } from "../../core/errors.ts";
import { requireAction } from "../../core/guards.ts";
import type { AppEnv } from "../../core/http.ts";
import { validate } from "../../core/validate.ts";
import { items } from "../../db/schema/index.ts";
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
  );
