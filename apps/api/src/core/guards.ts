/**
 * 權限檢查。規則本身在 packages/shared/src/permissions.ts。
 *
 *   .post("/", requireAction("booking.create"), handler)   // middleware
 *   const user = requireUser(c)                             // handler 裡取得已登入使用者
 */
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { can, type Action, type Actor } from "@class/shared/permissions";
import { forbidden, notApproved, unauthenticated } from "./errors.ts";
import type { AppEnv, CurrentUser } from "./http.ts";

export function actorOf(c: Context<AppEnv>): Actor | null {
  const u = c.var.user;
  return u ? { id: u.id, role: u.role, status: u.status } : null;
}

/** 回傳目前使用者；沒登入就 401。不檢查審核狀態 */
export function requireUser(c: Context<AppEnv>): CurrentUser {
  const u = c.var.user;
  if (!u) throw unauthenticated();
  return u;
}

/** 回傳已審核通過的使用者；否則 401 / 403 */
export function requireApproved(c: Context<AppEnv>): CurrentUser {
  const u = requireUser(c);
  if (u.status !== "approved") throw notApproved();
  return u;
}

/** middleware：沒有這個動作的權限就擋下 */
export const requireAction = (action: Action) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = actorOf(c);
    if (!can(actor, action)) {
      if (!actor) throw unauthenticated();
      if (actor.status !== "approved") throw notApproved();
      throw forbidden();
    }
    await next();
  });
