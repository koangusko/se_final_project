/**
 * 教室占用：三個模組整合的核心概念。擁有者：整合者。
 *
 * 一間教室在某時段「被占用」= 以下任一成立：
 *   1. 有狀態為 approved 或 checked_out 的預約
 *   2. 有狀態為 scheduled、且指定了這間教室的課程時段
 * 後端唯一的計算入口是 apps/api/src/core/occupancy.ts。
 */
import { z } from "zod";
import { DateStrSchema } from "./time.ts";

export const OCCUPANCY_SOURCES = ["booking", "course"] as const;
export type OccupancySource = (typeof OCCUPANCY_SOURCES)[number];

export const OccupancyQuery = z.object({
  roomId: z.uuid().optional(),
  /** 含 */
  from: DateStrSchema,
  /** 不含 */
  to: DateStrSchema,
});
export type OccupancyQuery = z.infer<typeof OccupancyQuery>;

export interface OccupancyDto {
  roomId: string;
  roomCode: string;
  startsAt: string;
  endsAt: string;
  source: OccupancySource;
  /** booking id 或 course session id */
  refId: string;
  /**
   * 課程：課名（例「資料庫系統」）。
   * 預約：一律是「已預約」，不透露用途與借用人（占用資訊開放給所有已登入的人看）。
   * 需要預約細節的地方（管理員頁面）用 refId 另外查。
   */
  label: string;
}
