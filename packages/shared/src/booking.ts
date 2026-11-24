/** 空間/物品預約借用的共用契約。擁有者：預約借用模組。 */
import { z } from "zod";
import type { UserRef } from "./core.ts";
import type { RoomRef } from "./space.ts";
import { DateStrSchema, TimeStrSchema, timeToMinutes } from "./time.ts";

/**
 * pending -> approved -> checked_out -> returned
 *         -> rejected
 * pending / approved -> cancelled
 */
export const BOOKING_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "checked_out",
  "returned",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** 這些狀態的預約會占用教室（資料庫 EXCLUDE 約束也用同一組） */
export const OCCUPYING_BOOKING_STATUSES = [
  "approved",
  "checked_out",
] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已拒絕",
  cancelled: "已取消",
  checked_out: "已借出",
  returned: "已歸還",
};

export const ITEM_CATEGORIES = ["key", "pointer", "laptop", "other"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  key: "鑰匙",
  pointer: "投影筆",
  laptop: "筆電",
  other: "其他",
};

const itemFields = {
  name: z.string().trim().min(1).max(50),
  category: z.enum(ITEM_CATEGORIES),
  /** 鑰匙要綁教室；其他物品是 null */
  roomId: z.uuid().nullable(),
  quantity: z.int().min(0).max(999),
  description: z.string().max(500),
  isActive: z.boolean(),
};

export const ItemInput = z.object({
  ...itemFields,
  roomId: itemFields.roomId.default(null),
  description: itemFields.description.default(""),
  isActive: itemFields.isActive.default(true),
});
export type ItemInput = z.infer<typeof ItemInput>;

/** PATCH 用（沒有 default） */
export const ItemPatch = z.object(itemFields).partial();
export type ItemPatch = z.infer<typeof ItemPatch>;

/*
 * 借用規則，依《管理學院場所管理要點》（115-03-11 修正）與管院教室租借規範：
 * - 使用日 3 天前提出申請（管理員代為登記不受限）
 * - 每日分上午、下午、晚間，每段最多 4 小時，最晚使用到 21:00
 * - 管253 產業教室、管352 默契咖啡原則上不外借（教室主檔設為不可預約）
 * 收費、保證金、學生社團需先經課外活動組核准等規定，系統只做說明，不在這裡計算。
 */
export const BOOKING_OPEN_TIME = "08:00";
export const BOOKING_CLOSE_TIME = "21:00";
/** 單筆預約最長分鐘數 */
export const BOOKING_MAX_MINUTES = 4 * 60;
/** 最晚要在使用日前幾天申請 */
export const BOOKING_LEAD_DAYS = 3;
export const BOOKING_RULES_URL = "https://cm.ncnu.edu.tw/p/406-1066-37926,r1554.php";
/** 預約時間以 10 分鐘為單位 */
export const BOOKING_STEP_MINUTES = 10;

export const CreateBookingInput = z
  .object({
    roomId: z.uuid(),
    date: DateStrSchema,
    startTime: TimeStrSchema,
    endTime: TimeStrSchema,
    purpose: z.string().trim().min(1, "請填用途").max(200),
    attendeeCount: z.int().min(1).max(1000).optional(),
    items: z
      .array(z.object({ itemId: z.uuid(), quantity: z.int().min(1).max(99) }))
      .max(10)
      .default([]),
  })
  .refine((v) => timeToMinutes(v.endTime) > timeToMinutes(v.startTime), {
    message: "結束時間要晚於開始時間",
    path: ["endTime"],
  })
  .refine(
    (v) =>
      timeToMinutes(v.startTime) >= timeToMinutes(BOOKING_OPEN_TIME) &&
      timeToMinutes(v.endTime) <= timeToMinutes(BOOKING_CLOSE_TIME),
    { message: `只能預約 ${BOOKING_OPEN_TIME} 到 ${BOOKING_CLOSE_TIME}`, path: ["startTime"] },
  )
  .refine((v) => timeToMinutes(v.endTime) - timeToMinutes(v.startTime) <= BOOKING_MAX_MINUTES, {
    message: `單次最多借用 ${BOOKING_MAX_MINUTES / 60} 小時`,
    path: ["endTime"],
  })
  .refine(
    (v) =>
      timeToMinutes(v.startTime) % BOOKING_STEP_MINUTES === 0 &&
      timeToMinutes(v.endTime) % BOOKING_STEP_MINUTES === 0,
    { message: `時間要以 ${BOOKING_STEP_MINUTES} 分鐘為單位`, path: ["startTime"] },
  )
  .refine((v) => new Set(v.items.map((i) => i.itemId)).size === v.items.length, {
    message: "同一個物品不要重複選",
    path: ["items"],
  });
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;

export const ReviewBookingInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(200).optional() }),
  z.object({
    decision: z.literal("reject"),
    note: z.string().trim().min(1, "請填拒絕原因").max(200),
  }),
]);
export type ReviewBookingInput = z.infer<typeof ReviewBookingInput>;

export const HandoverInput = z.object({ note: z.string().trim().max(200).optional() });
export type HandoverInput = z.infer<typeof HandoverInput>;

export const BookingListQuery = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  roomId: z.uuid().optional(),
  from: DateStrSchema.optional(),
  to: DateStrSchema.optional(),
});
export type BookingListQuery = z.infer<typeof BookingListQuery>;

export const ItemAvailabilityQuery = z.object({
  roomId: z.uuid().optional(),
  date: DateStrSchema,
  startTime: TimeStrSchema,
  endTime: TimeStrSchema,
});

export interface ItemDto {
  id: string;
  name: string;
  category: ItemCategory;
  roomId: string | null;
  quantity: number;
  description: string;
  isActive: boolean;
}

export interface ItemAvailabilityDto extends ItemDto {
  /** 該時段還能借的數量 */
  available: number;
}

export interface BookingItemDto {
  itemId: string;
  name: string;
  category: ItemCategory;
  quantity: number;
}

export interface BookingDto {
  id: string;
  user: UserRef;
  room: RoomRef;
  startsAt: string;
  endsAt: string;
  purpose: string;
  attendeeCount: number | null;
  status: BookingStatus;
  items: BookingItemDto[];
  reviewNote: string | null;
  reviewedAt: string | null;
  checkedOutAt: string | null;
  returnedAt: string | null;
  createdAt: string;
}

export const BOOKING_EVENT_ACTIONS = [
  "created",
  "approved",
  "rejected",
  "cancelled",
  "checked_out",
  "returned",
] as const;
export type BookingEventAction = (typeof BOOKING_EVENT_ACTIONS)[number];

export interface BookingEventDto {
  id: string;
  action: BookingEventAction;
  actor: UserRef;
  note: string | null;
  at: string;
}

export interface BookingDetailDto extends BookingDto {
  events: BookingEventDto[];
}
