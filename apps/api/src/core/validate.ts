/**
 * 輸入驗證。route 一律用這個，不要直接用 zValidator：
 *   .post("/", validate("json", CreateBookingInput), (c) => { const input = c.req.valid("json"); ... })
 * 驗證失敗會回 400 VALIDATION，details 是 { 欄位路徑: 錯誤訊息 }。
 */
import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import { validationError } from "./errors.ts";

export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] ??= issue.message;
      }
      const first = Object.values(fields)[0] ?? "輸入格式錯誤";
      throw validationError(first, fields);
    }
  });
}
