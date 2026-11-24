/** GET /api/occupancy?from=YYYY-MM-DD&to=YYYY-MM-DD[&roomId=]：登入且審核通過才能看。 */
import { Hono } from "hono";
import { OccupancyQuery, type OccupancyDto } from "@class/shared/occupancy";
import { toInstant } from "@class/shared/time";
import { requireAction } from "./guards.ts";
import type { AppEnv } from "./http.ts";
import { listOccupancy, toOccupancyDto } from "./occupancy.ts";
import { validate } from "./validate.ts";

export const occupancyRoutes = new Hono<AppEnv>().get(
  "/",
  requireAction("occupancy.view"),
  validate("query", OccupancyQuery),
  async (c) => {
    const q = c.req.valid("query");
    const entries = await listOccupancy(c.var.db, {
      ...(q.roomId ? { roomIds: [q.roomId] } : {}),
      from: toInstant(q.from, "00:00"),
      to: toInstant(q.to, "00:00"),
    });
    const occupancy: OccupancyDto[] = entries.map(toOccupancyDto);
    return c.json({ occupancy });
  },
);
