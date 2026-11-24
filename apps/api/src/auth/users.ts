import type { MeDto, UserDto, UserRef } from "@class/shared/core";
import type { CurrentUser } from "../core/http.ts";
import type { users } from "../db/schema/index.ts";

type UserRow = typeof users.$inferSelect;

export function toMeDto(u: CurrentUser): MeDto {
  return {
    id: u.id,
    name: u.name,
    displayName: u.displayName,
    pictureUrl: u.pictureUrl,
    role: u.role,
    status: u.status,
    affiliation: u.affiliation,
  };
}

export function toUserDto(u: UserRow): UserDto {
  return {
    id: u.id,
    name: u.name,
    displayName: u.lineDisplayName,
    pictureUrl: u.linePictureUrl,
    role: u.role,
    status: u.status,
    affiliation: u.affiliation,
    phone: u.phone,
    requestedRole: u.requestedRole,
    reviewNote: u.reviewNote,
    reviewedAt: u.reviewedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** 給其他模組顯示人名用：有真名用真名，沒有就用 LINE 名稱 */
export function toUserRef(u: {
  id: string;
  name: string | null;
  lineDisplayName: string;
}): UserRef {
  return { id: u.id, name: u.name ?? u.lineDisplayName };
}
