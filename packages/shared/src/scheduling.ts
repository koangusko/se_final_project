/** 課程排課的共用契約。擁有者：課程排課模組。 */
import { z } from "zod";
import type { UserRef } from "./core.ts";
import type { RoomRef } from "./space.ts";
import { DateStrSchema, TimeStrSchema, timeToMinutes } from "./time.ts";

export const CourseInput = z.object({
  code: z.string().trim().max(20).nullable().default(null),
  name: z.string().trim().min(1, "請填課程名稱").max(100),
  /** 只有管理員能指定；教師建立時後端一律設成自己 */
  teacherId: z.uuid().nullable().optional(),
  preferredRoomId: z.uuid().nullable().default(null),
  description: z.string().max(2000).default(""),
});
export type CourseInput = z.infer<typeof CourseInput>;

/**
 * PATCH /courses/:id：只送要改的欄位。
 * 不能用 CourseInput.partial()：Zod 4 的 partial 仍會套用 default，沒送的欄位會被清空。
 */
export const UpdateCourseInput = z.object({
  code: z.string().trim().max(20).nullable().optional(),
  name: z.string().trim().min(1, "請填課程名稱").max(100).optional(),
  /** 教師只能送自己的 id（或不送）；管理員可以改 */
  teacherId: z.uuid().nullable().optional(),
  preferredRoomId: z.uuid().nullable().optional(),
  description: z.string().max(2000).optional(),
});
export type UpdateCourseInput = z.infer<typeof UpdateCourseInput>;

export const CourseListQuery = z.object({
  /** "1"：只回自己教的課 */
  mine: z.literal("1").optional(),
});

export const AssignTeacherInput = z.object({ teacherId: z.uuid().nullable() });
export type AssignTeacherInput = z.infer<typeof AssignTeacherInput>;

const timeRange = (v: { startTime: string; endTime: string }) =>
  timeToMinutes(v.endTime) > timeToMinutes(v.startTime);

export const SCHEDULE_STEP_MINUTES = 10;

const onStep = (v: { startTime: string; endTime: string }) =>
  timeToMinutes(v.startTime) % SCHEDULE_STEP_MINUTES === 0 &&
  timeToMinutes(v.endTime) % SCHEDULE_STEP_MINUTES === 0;
const stepMessage = {
  message: `時間要以 ${SCHEDULE_STEP_MINUTES} 分鐘為單位`,
  path: ["startTime"],
};

export const CreateSessionsInput = z
  .object({
    date: DateStrSchema,
    startTime: TimeStrSchema,
    endTime: TimeStrSchema,
    /** null 表示還沒排教室；省略時用課程的偏好教室 */
    roomId: z.uuid().nullable().optional(),
    /** 從 date 起每週同一時間重複幾次（含第一次） */
    repeatWeeks: z.int().min(1).max(18).default(1),
    note: z.string().trim().max(200).optional(),
  })
  .refine(timeRange, { message: "結束時間要晚於開始時間", path: ["endTime"] })
  .refine(onStep, stepMessage);
export type CreateSessionsInput = z.infer<typeof CreateSessionsInput>;

/** 改時間（拖拉）或改教室 */
export const UpdateSessionInput = z
  .object({
    date: DateStrSchema,
    startTime: TimeStrSchema,
    endTime: TimeStrSchema,
    roomId: z.uuid().nullable().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine(timeRange, { message: "結束時間要晚於開始時間", path: ["endTime"] })
  .refine(onStep, stepMessage);
export type UpdateSessionInput = z.infer<typeof UpdateSessionInput>;

export const CalendarQuery = z.object({
  /** 該週週一（不是週一時後端會換成那週的週一） */
  week: DateStrSchema,
  roomId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
});

/** 衝突清單的範圍：from 含、to 不含。省略時預設今天起 8 週 */
export const ConflictQuery = z
  .object({ from: DateStrSchema.optional(), to: DateStrSchema.optional() })
  .refine((v) => !v.from || !v.to || v.from < v.to, {
    message: "結束日期要晚於開始日期",
    path: ["to"],
  });
export const CONFLICT_DEFAULT_WEEKS = 8;

export const SESSION_STATUSES = ["scheduled", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface CourseDto {
  id: string;
  code: string | null;
  name: string;
  teacher: UserRef | null;
  /** 匯入課程的教師姓名；teacher 為 null 時顯示這個 */
  teacherName: string | null;
  /** 開課系所（匯入課程才有） */
  unitName: string | null;
  source: "manual" | "incnu";
  preferredRoom: RoomRef | null;
  description: string;
  sessionCount: number;
}

/** 顯示用的教師名稱：有帳號用帳號名稱，否則用匯入的姓名 */
export function teacherLabel(x: { teacher: UserRef | null; teacherName: string | null }): string {
  return x.teacher?.name ?? x.teacherName ?? "未指派";
}

export interface SessionDto {
  id: string;
  courseId: string;
  courseCode: string | null;
  courseName: string;
  teacher: UserRef | null;
  teacherName: string | null;
  room: RoomRef | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  note: string | null;
}

export const CONFLICT_KINDS = ["room_course", "room_booking", "teacher"] as const;
export type ConflictKind = (typeof CONFLICT_KINDS)[number];

export const CONFLICT_KIND_LABELS: Record<ConflictKind, string> = {
  room_course: "同教室課程重疊",
  room_booking: "課程與已核准預約重疊",
  teacher: "同一位教師時間重疊",
};

export interface ConflictSide {
  type: "course" | "booking";
  /** course 時是 session id，booking 時是 booking id */
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

export interface ConflictDto {
  kind: ConflictKind;
  a: ConflictSide;
  b: ConflictSide;
  room: RoomRef | null;
  teacher: UserRef | null;
}
