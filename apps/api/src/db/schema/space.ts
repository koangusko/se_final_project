/** 管院空間。擁有者：空間查詢模組。 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  MEDIA_KINDS,
  ROOM_TYPES,
  type MeshViewConfig,
  type SplatViewConfig,
} from "@class/shared/space";
import { timestamps } from "./core.ts";

export const roomTypeEnum = pgEnum("room_type", ROOM_TYPES);
export const mediaKindEnum = pgEnum("media_kind", MEDIA_KINDS);

export const floors = pgTable(
  "floors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    building: text("building").notNull().default("管理學院"),
    level: integer("level").notNull(),
    name: text("name").notNull(),
    /** 相對於媒體根目錄的路徑 */
    planImagePath: text("plan_image_path"),
    planWidth: integer("plan_width"),
    planHeight: integer("plan_height"),
    ...timestamps,
  },
  (t) => [unique("floors_building_level_uq").on(t.building, t.level)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    floorId: uuid("floor_id").references(() => floors.id, { onDelete: "set null" }),
    type: roomTypeEnum("type").notNull().default("classroom"),
    capacity: integer("capacity").notNull().default(0),
    equipment: text("equipment").array().notNull().default([]),
    description: text("description").notNull().default(""),
    isBookable: boolean("is_bookable").notNull().default(true),
    /** 管理單位（依管理學院場所管理要點附表二，例如「資訊管理學系」）；未知時 null */
    managingUnit: text("managing_unit"),
    /** 對外借用每小時收費（新臺幣）；不外借或未知時 null */
    hourlyFee: integer("hourly_fee"),
    /** 軟刪除：有預約或課程紀錄的教室不能真的刪 */
    isActive: boolean("is_active").notNull().default(true),
    planX: real("plan_x"),
    planY: real("plan_y"),
    planW: real("plan_w"),
    planH: real("plan_h"),
    ...timestamps,
  },
  (t) => [index("rooms_floor_id_idx").on(t.floorId)],
);

export const roomMedia = pgTable(
  "room_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull(),
    /** 相對於媒體根目錄的路徑，例如 rooms/<roomId>/<uuid>.spz */
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    caption: text("caption").notNull().default(""),
    /** 只有 splat 用 */
    /** splat 存 SplatViewConfig，mesh 存 MeshViewConfig，其他是 null */
    viewConfig: jsonb("view_config").$type<SplatViewConfig | MeshViewConfig>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("room_media_room_id_idx").on(t.roomId)],
);
