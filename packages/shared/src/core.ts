/** 帳號與登入的共用契約。擁有者：整合者。 */
import { z } from "zod";
import { ROLES, type Role, type UserStatus } from "./permissions.ts";

/**
 * 註冊頁「系所或單位」的選項。不在清單裡的（例如外院教師）選「其他」並自行填寫，
 * 所以後端只檢查是非空字串，不限制一定在清單內。
 * 名稱以 115、116 學年度招生簡章與管院官網「教學單位」為準（2026-11-24 查證）。
 * 學系的學士班與碩士班都選學系本身。
 */
export const AFFILIATION_GROUPS: { label: string; options: string[] }[] = [
  {
    label: "管理學院學系",
    options: ["國際企業學系", "經濟學系", "資訊管理學系", "財務金融學系", "觀光休閒與餐旅管理學系"],
  },
  {
    label: "管理學院學位學程與專班",
    options: [
      "管理學院學士班",
      "管理學院商業管理及資訊科技創新應用全英語碩士學位學程",
      "新興產業策略與發展碩士學位學程",
      "新興產業策略與發展博士學位學程",
      "區域發展重點產業碩士專班",
      "管理學院高階經營管理碩士學位學程在職專班（EMBA）",
      "管理學院兩岸高階主管經營管理境外碩士在職學位學程",
    ],
  },
  { label: "管理學院行政", options: ["管理學院院辦公室"] },
];

export const AFFILIATION_OPTIONS = AFFILIATION_GROUPS.flatMap((g) => g.options);

export const RegisterInput = z.object({
  name: z.string().trim().min(1, "請填姓名").max(50),
  affiliation: z.string().trim().min(1, "請填系所或單位").max(100),
  phone: z.string().trim().max(30).optional(),
  requestedRole: z.enum(["user", "teacher"]),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const ReviewUserInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), role: z.enum(ROLES) }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().max(200).optional() }),
]);
export type ReviewUserInput = z.infer<typeof ReviewUserInput>;

export const UpdateUserRoleInput = z.object({ role: z.enum(ROLES) });
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInput>;

export const DevLoginInput = z.object({ as: z.enum(["admin", "teacher", "user", "pending"]) });
export type DevLoginInput = z.infer<typeof DevLoginInput>;

/** 目前登入者。沒登入時 /api/auth/me 回傳 { user: null } */
export interface MeDto {
  id: string;
  /** 註冊時填的真實姓名；還沒註冊時是 null */
  name: string | null;
  /** LINE 顯示名稱 */
  displayName: string;
  pictureUrl: string | null;
  role: Role;
  status: UserStatus;
  affiliation: string | null;
}

/** 管理員看到的使用者資料 */
export interface UserDto extends MeDto {
  phone: string | null;
  requestedRole: "user" | "teacher" | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** 其他模組引用使用者時只帶這兩個欄位 */
export interface UserRef {
  id: string;
  name: string;
}

/** GET /api/rooms：教室選單用的精簡資料（所有模組共用） */
export interface RoomOptionDto {
  id: string;
  code: string;
  name: string;
  capacity: number;
  isBookable: boolean;
  /** 沒有指定樓層的教室是 null */
  building: string | null;
  level: number | null;
  floorName: string | null;
}

export interface AuthConfigDto {
  lineEnabled: boolean;
  devLogin: boolean;
}
