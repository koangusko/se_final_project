/**
 * GET /api/rooms[?bookable=1]：給所有模組用的教室選單資料（公開）。擁有者：整合者。
 *
 * 只回下拉選單需要的欄位。教室的完整資料、增刪改、媒體由空間模組的 /api/space 負責。
 */
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { RoomOptionDto } from "@class/shared/core";
import { floors, rooms } from "../db/schema/index.ts";
import type { AppEnv } from "./http.ts";
import { mainBuildingFirst } from "./ordering.ts";
import { validate } from "./validate.ts";

export const roomOptionRoutes = new Hono<AppEnv>().get(
  "/",
  validate("query", z.object({ bookable: z.enum(["0", "1"]).optional() })),
  async (c) => {
    const { bookable } = c.req.valid("query");
    const rows = await c.var.db
      .select({
        id: rooms.id,
        code: rooms.code,
        name: rooms.name,
        capacity: rooms.capacity,
        isBookable: rooms.isBookable,
        building: floors.building,
        level: floors.level,
        floorName: floors.name,
      })
      .from(rooms)
      .leftJoin(floors, eq(rooms.floorId, floors.id))
      .where(
        and(eq(rooms.isActive, true), bookable === "1" ? eq(rooms.isBookable, true) : undefined),
      )
      .orderBy(
        mainBuildingFirst(floors.building),
        asc(floors.building),
        asc(floors.level),
        asc(rooms.code),
      );
    const list: RoomOptionDto[] = rows;
    return c.json({ rooms: list });
  },
);
