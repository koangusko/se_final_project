/**
 * 預約借用。擁有者：預約借用模組。
 *
 * bookings 的時段重疊由資料庫擋：同一間教室，狀態為 approved / checked_out 的預約，
 * 時段 [starts_at, ends_at) 不能重疊。約束寫在 drizzle/0001_booking_exclusion.sql，
 * 違反時 Postgres 錯誤碼是 23P01（用 core/db-errors.ts 的 isExclusionViolation 判斷）。
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { BOOKING_EVENT_ACTIONS, BOOKING_STATUSES, ITEM_CATEGORIES } from "@class/shared/booking";
import { timestamps, users } from "./core.ts";
import { rooms } from "./space.ts";

export const bookingStatusEnum = pgEnum("booking_status", BOOKING_STATUSES);
export const itemCategoryEnum = pgEnum("item_category", ITEM_CATEGORIES);
export const bookingEventActionEnum = pgEnum("booking_event_action", BOOKING_EVENT_ACTIONS);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: itemCategoryEnum("category").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [check("items_quantity_nonneg", sql`${t.quantity} >= 0`)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    purpose: text("purpose").notNull(),
    attendeeCount: integer("attendee_count"),
    status: bookingStatusEnum("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    checkedOutBy: uuid("checked_out_by").references(() => users.id),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    returnedBy: uuid("returned_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    check("bookings_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    index("bookings_room_time_idx").on(t.roomId, t.startsAt),
    index("bookings_user_id_idx").on(t.userId),
    index("bookings_status_idx").on(t.status),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bookingId, t.itemId] }),
    check("booking_items_quantity_pos", sql`${t.quantity} > 0`),
  ],
);

/** 預約的狀態變化紀錄，用於借用歷史 */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    action: bookingEventActionEnum("action").notNull(),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_id_idx").on(t.bookingId)],
);
