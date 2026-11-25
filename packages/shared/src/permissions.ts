/**
 * 權限規則。前後端共用同一份，後端是最終把關，前端只用來決定要不要顯示按鈕。
 * 完整矩陣見 docs/permissions.md。新增動作時兩邊一起改。
 */
export const ROLES = ["user", "teacher", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * unregistered：用 LINE 登入過，但還沒填註冊資料
 * pending：填完註冊資料，等管理員審核
 * approved：審核通過，可以使用需要登入的功能
 * rejected：審核不通過
 */
export const USER_STATUSES = ["unregistered", "pending", "approved", "rejected"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  user: "一般使用者",
  teacher: "教師",
  admin: "管理員",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  unregistered: "未填註冊資料",
  pending: "待審核",
  approved: "已核准",
  rejected: "未通過",
};

export interface Actor {
  id: string;
  role: Role;
  status: UserStatus;
}

const approved = (a: Actor | null): a is Actor => a !== null && a.status === "approved";
const admin = (a: Actor | null): boolean => approved(a) && a.role === "admin";
const teacherOrAdmin = (a: Actor | null): boolean =>
  approved(a) && (a.role === "teacher" || a.role === "admin");

export const POLICY = {
  // 空間查詢：瀏覽不需要登入
  "space.view": () => true,
  "space.manage": admin,
  // 預約借用
  "booking.create": approved,
  "booking.viewOwn": approved,
  "booking.viewAll": admin,
  "booking.review": admin,
  "booking.handover": admin,
  "item.manage": admin,
  "occupancy.view": approved,
  // 課程排課
  "course.view": approved,
  "course.create": teacherOrAdmin,
  "course.manageAll": admin,
  "course.viewConflicts": admin,
  // 帳號
  "user.manage": admin,
} as const satisfies Record<string, (a: Actor | null) => boolean>;

export type Action = keyof typeof POLICY;

export function can(actor: Actor | null, action: Action): boolean {
  return POLICY[action](actor);
}

/** 教師只能改自己的課；管理員可以改全部 */
export function canEditCourse(actor: Actor | null, course: { teacherId: string | null }): boolean {
  if (can(actor, "course.manageAll")) return true;
  return can(actor, "course.create") && actor !== null && course.teacherId === actor.id;
}

/** 借用人只能取消自己還沒被核准的預約 */
export function canCancelBooking(
  actor: Actor | null,
  booking: { userId: string; status: string },
): boolean {
  if (actor === null || !approved(actor)) return false;
  if (admin(actor)) return booking.status === "pending" || booking.status === "approved";
  return booking.userId === actor.id && booking.status === "pending";
}
