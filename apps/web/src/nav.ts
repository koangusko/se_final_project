/**
 * 導覽列項目。擁有者：整合者。各模組的頁面路徑已經先定好，模組只要實作對應的 route 檔。
 */
import type { Role } from "@class/shared/permissions";

export interface NavItem {
  to: "/space" | "/booking" | "/scheduling";
  label: string;
}

export const MAIN_NAV: NavItem[] = [
  { to: "/space", label: "空間查詢" },
  { to: "/booking", label: "預約借用" },
  { to: "/scheduling", label: "課程排課" },
];

export interface AdminNavItem {
  to: "/admin/users" | "/space/admin" | "/booking/admin" | "/scheduling/admin";
  label: string;
  roles: Role[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin/users", label: "帳號審核", roles: ["admin"] },
  { to: "/space/admin", label: "教室管理", roles: ["admin"] },
  { to: "/booking/admin", label: "預約審核與借還", roles: ["admin"] },
  { to: "/scheduling/admin", label: "排課管理", roles: ["admin"] },
];
