/**
 * /api/booking/*：空間/物品預約借用。
 *
 * 規格與任務清單：docs/modules/booking.md
 * 這個檔案是模組的 API 入口，已經掛在 apps/api/src/routes.ts，不需要改那裡。
 * 路由要用串接寫法（new Hono().get(...).post(...)），前端的型別才推得出來。
 */
import { Hono } from "hono";
import type { AppEnv } from "../../core/http.ts";

export const bookingRoutes = new Hono<AppEnv>();
