/** 管院空間查詢的共用契約。擁有者：空間查詢模組。 */
import { z } from "zod";

export const ROOM_TYPES = [
  "classroom",
  "lecture_hall",
  "seminar_room",
  "meeting_room",
  "computer_lab",
  "office",
  "other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  classroom: "一般教室",
  lecture_hall: "階梯教室 / 會議廳",
  seminar_room: "研討室",
  meeting_room: "會議室",
  computer_lab: "電腦教室",
  office: "辦公室 / 研究室",
  other: "其他",
};

const floorFields = {
  building: z.string().trim().min(1, "請填建築名稱").max(50, "建築名稱最多 50 字"),
  /** 地下一樓是 -1 */
  level: z.int("樓層要是整數").min(-5, "樓層最低 -5").max(30, "樓層最高 30"),
  name: z.string().trim().min(1, "請填顯示名稱").max(20, "顯示名稱最多 20 字"),
};

export const FloorInput = z.object({
  ...floorFields,
  building: floorFields.building.default("管理學院"),
});
export type FloorInput = z.infer<typeof FloorInput>;

/** PATCH /floors/:id。和 RoomPatchInput 一樣不能用 FloorInput.partial()（會把 building 蓋成預設值） */
export const FloorPatchInput = z.object(floorFields).partial();
export type FloorPatchInput = z.infer<typeof FloorPatchInput>;

/** 平面圖圖片限制 */
export const FLOOR_PLAN_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  accept: ["image/jpeg", "image/png", "image/webp"],
};

const pixelSize = z
  .string()
  .regex(/^[1-9]\d{0,4}$/, "寬高要是 1–99999 的整數")
  .transform(Number);

/** PUT /floors/:id/plan 的 query：前端用 new Image() 讀出圖片寬高帶過來 */
export const FloorPlanQuery = z.object({ width: pixelSize, height: pixelSize });

const roomFields = {
  code: z.string().trim().min(1, "請填教室代碼").max(20, "代碼最多 20 字"),
  name: z.string().trim().min(1, "請填教室名稱").max(50, "名稱最多 50 字"),
  floorId: z.uuid("請選擇樓層").nullable(),
  type: z.enum(ROOM_TYPES, "請選擇類型"),
  capacity: z.int("人數要是整數").min(0, "人數不能是負數").max(1000, "人數最多 1000"),
  equipment: z
    .array(z.string().trim().min(1, "設備名稱不能空白").max(30, "設備名稱最多 30 字"))
    .max(30, "設備最多 30 項"),
  description: z.string().max(2000, "說明最多 2000 字"),
  isBookable: z.boolean(),
};

export const RoomInput = z.object({
  ...roomFields,
  equipment: roomFields.equipment.default([]),
  description: roomFields.description.default(""),
  isBookable: roomFields.isBookable.default(true),
});
export type RoomInput = z.infer<typeof RoomInput>;

/**
 * PATCH /rooms/:id。注意不能用 RoomInput.partial()：Zod 4 在 optional 欄位裡仍會套用 default，
 * 沒送的 equipment / description / isBookable 會被蓋成預設值。
 */
export const RoomPatchInput = z.object(roomFields).partial();
export type RoomPatchInput = z.infer<typeof RoomPatchInput>;

/** GET /rooms 的篩選條件。query string 一律是字串，bookable 用 "1" / "0" */
export const RoomListQuery = z.object({
  floorId: z.uuid().optional(),
  type: z.enum(ROOM_TYPES).optional(),
  /** 搜尋代碼、名稱、設備（不分大小寫、部分符合） */
  q: z.string().trim().max(50).optional(),
  bookable: z.enum(["0", "1"]).optional(),
});
export type RoomListQuery = z.infer<typeof RoomListQuery>;

/** 教室在樓層平面圖上的位置，座標是平面圖圖片的像素 */
export const RoomPlacement = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type RoomPlacement = z.infer<typeof RoomPlacement>;

export const UpdatePlacementInput = z.object({ placement: RoomPlacement.nullable() });

/**
 * panorama：360 全景照片
 * mesh：LiDAR 掃描的 3D 格局（GLB 網格，iPhone Pro 用 Scaniverse/Polycam 的 Mesh 模式拍）
 * splat：高斯噴濺 3D 模型（SPZ）
 * photo：一般照片
 */
export const MEDIA_KINDS = ["panorama", "mesh", "splat", "photo"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** 上傳限制（位元組）。後端以此為準，前端用來提早提示。 */
export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; accept: string[] }> = {
  panorama: { maxBytes: 20 * 1024 * 1024, accept: ["image/jpeg", "image/webp"] },
  mesh: { maxBytes: 60 * 1024 * 1024, accept: [".glb"] },
  splat: { maxBytes: 80 * 1024 * 1024, accept: [".spz"] },
  photo: { maxBytes: 10 * 1024 * 1024, accept: ["image/jpeg", "image/webp", "image/png"] },
};

/**
 * 3D 模型的顯示設定，由管理員在後台調整後存起來。
 * 角度單位是度。座標系：Y 向上，地板在 y = 0。
 */
export const SplatViewConfig = z.object({
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([180, 0, 0]),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  scale: z.number().positive().default(1),
  cameraPosition: z.tuple([z.number(), z.number(), z.number()]).default([0, 1.6, 3]),
  cameraTarget: z.tuple([z.number(), z.number(), z.number()]).default([0, 1.2, 0]),
});
export type SplatViewConfig = z.infer<typeof SplatViewConfig>;

/**
 * 3D 格局（GLB）的顯示設定。LiDAR 掃描本來就是真實公尺尺寸、Y 軸朝上，所以不需要調方向。
 * cameraPosition / cameraTarget 是相對於模型地板中心的座標；null 表示自動從斜上方看整間。
 */
export const MeshViewConfig = z.object({
  /** 水平轉向（度），讓教室正面朝向固定方向 */
  rotationY: z.number().min(-360).max(360).default(0),
  /** 從地板往上幾公尺以上切掉（掀開天花板）；null 表示不切 */
  ceilingCut: z.number().min(0.5).max(20).nullable().default(2.4),
  cameraPosition: z.tuple([z.number(), z.number(), z.number()]).nullable().default(null),
  cameraTarget: z.tuple([z.number(), z.number(), z.number()]).nullable().default(null),
});
export type MeshViewConfig = z.infer<typeof MeshViewConfig>;

/**
 * PUT /rooms/:id/media 的 query。body 直接是檔案。
 * splat 沒有標準的 content-type，所以前端要帶原始檔名，後端檢查副檔名是不是 .spz。
 */
export const MediaUploadQuery = z.object({
  kind: z.enum(MEDIA_KINDS, "kind 要是 panorama、splat 或 photo"),
  caption: z.string().trim().max(200, "說明最多 200 字").optional(),
  filename: z.string().max(255).optional(),
});
export type MediaUploadQuery = z.infer<typeof MediaUploadQuery>;

/** PATCH /media/:mediaId。viewConfig 只有 splat 可以設定 */
export const UpdateMediaInput = z.object({
  caption: z.string().trim().max(200, "說明最多 200 字").optional(),
  sortOrder: z.int("順序要是整數").min(0).max(10_000).optional(),
  viewConfig: SplatViewConfig.optional(),
  meshConfig: MeshViewConfig.optional(),
});
export type UpdateMediaInput = z.infer<typeof UpdateMediaInput>;

export interface FloorDto {
  id: string;
  building: string;
  level: number;
  name: string;
  planImageUrl: string | null;
  planWidth: number | null;
  planHeight: number | null;
}

export interface RoomDto {
  id: string;
  code: string;
  name: string;
  floorId: string | null;
  type: RoomType;
  capacity: number;
  equipment: string[];
  description: string;
  isBookable: boolean;
  /** 管理單位，例如「資訊管理學系」；未知時 null */
  managingUnit: string | null;
  /** 對外借用每小時收費（新臺幣）；校內學術活動通常免費，見管理要點 */
  hourlyFee: number | null;
  placement: RoomPlacement | null;
  coverUrl: string | null;
  hasPanorama: boolean;
  hasSplat: boolean;
  /** 媒體總數（管理表格用） */
  mediaCount: number;
}

export interface RoomMediaDto {
  id: string;
  roomId: string;
  kind: MediaKind;
  url: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  /** 同一間教室內的顯示順序，小的在前 */
  sortOrder: number;
  /** 只有 splat 有 */
  viewConfig: SplatViewConfig | null;
  /** 只有 mesh 有 */
  meshConfig: MeshViewConfig | null;
}

export interface RoomDetailDto extends RoomDto {
  media: RoomMediaDto[];
}

/** 其他模組引用教室時只帶這三個欄位 */
export interface RoomRef {
  id: string;
  code: string;
  name: string;
}
