/**
 * 後端錯誤。route 和 service 裡一律 throw 這些，不要自己 c.json({...}, 4xx)。
 * app.ts 的 onError 會轉成 shared/errors.ts 定義的格式。
 */
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorCode } from "@class/shared/errors";

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: ContentfulStatusCode, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthenticated = (message = "請先登入") =>
  new AppError(401, "UNAUTHENTICATED", message);

export const notApproved = (message = "帳號尚未通過審核") =>
  new AppError(403, "NOT_APPROVED", message);

export const forbidden = (message = "沒有權限") => new AppError(403, "FORBIDDEN", message);

export const notFound = (what = "資料") => new AppError(404, "NOT_FOUND", `找不到${what}`);

export const invalidState = (message: string) => new AppError(409, "INVALID_STATE", message);

export const duplicate = (message: string) => new AppError(409, "DUPLICATE", message);

export const validationError = (message: string, details?: unknown) =>
  new AppError(400, "VALIDATION", message, details);
