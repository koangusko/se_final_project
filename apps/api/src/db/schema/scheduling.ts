/**
 * 課程排課。擁有者：課程排課模組。
 *
 * 課程時段之間允許重疊（不設 DB 約束），重疊會出現在管理員的衝突清單。
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { SESSION_STATUSES } from "@class/shared/scheduling";
import { timestamps, users } from "./core.ts";
import { rooms } from "./space.ts";

export const sessionStatusEnum = pgEnum("session_status", SESSION_STATUSES);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code"),
    name: text("name").notNull(),
    /** 授課教師。管理員可以先建課程、之後再指派 */
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
    preferredRoomId: uuid("preferred_room_id").references(() => rooms.id, { onDelete: "set null" }),
    description: text("description").notNull().default(""),
    /**
     * 匯入課程的教師姓名（iNCNU 原始字串，可能多位以逗號分隔）。
     * 教師還沒有帳號時用來顯示；之後由管理員把 teacherId 指派給註冊好的帳號。
     */
    teacherName: text("teacher_name"),
    /** 開課系所（匯入時的原始字串，合開課以「、」分隔） */
    unitName: text("unit_name"),
    /** manual：在系統內建立；incnu：從 iNCNU 公開課表匯入 */
    source: text("source", { enum: ["manual", "incnu"] })
      .notNull()
      .default("manual"),
    /** 學期，例如 1151 */
    semester: text("semester"),
    /** 匯入來源的識別碼（iNCNU SemesterCourseID，合開課以 + 連接） */
    externalId: text("external_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("courses_teacher_id_idx").on(t.teacherId),
    uniqueIndex("courses_external_uq").on(t.source, t.semester, t.externalId),
  ],
);

export const courseSessions = pgTable(
  "course_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** null = 還沒排教室，不算占用 */
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    check("course_sessions_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    index("course_sessions_room_time_idx").on(t.roomId, t.startsAt),
    index("course_sessions_course_id_idx").on(t.courseId),
  ],
);
