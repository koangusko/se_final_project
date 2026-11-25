/**
 * 所有 /api 路由的總表。前端的型別（AppType）從這裡推出來。
 * 擁有者：整合者。模組不要改這個檔案，各自改 modules/<模組>/routes.ts。
 */
import { Hono } from "hono";
import { adminUserRoutes } from "./admin/users.ts";
import { authRoutes } from "./auth/routes.ts";
import type { AppEnv } from "./core/http.ts";
import { occupancyRoutes } from "./core/occupancy-routes.ts";
import { roomOptionRoutes } from "./core/rooms-routes.ts";
import { bookingRoutes } from "./modules/booking/routes.ts";
import { schedulingRoutes } from "./modules/scheduling/routes.ts";
import { spaceRoutes } from "./modules/space/routes.ts";
import { sql } from "drizzle-orm";

export const apiRoutes = new Hono<AppEnv>()
  .get("/health", async (c) => {
    await c.var.db.execute(sql`select 1`);
    return c.json({ ok: true });
  })
  .route("/auth", authRoutes)
  .route("/admin/users", adminUserRoutes)
  .route("/occupancy", occupancyRoutes)
  .route("/rooms", roomOptionRoutes)
  .route("/space", spaceRoutes)
  .route("/booking", bookingRoutes)
  .route("/scheduling", schedulingRoutes);

export type ApiRoutes = typeof apiRoutes;
