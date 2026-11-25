import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../core/http.ts";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "./cookies.ts";
import { validateSessionToken } from "./session.ts";

/** 讀 session cookie，把登入者放進 c.var.user。不擋任何請求，擋人用 core/guards.ts */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  const token = readSessionCookie(c);
  if (token) {
    const result = await validateSessionToken(c.var.db, token);
    if (result) {
      c.set("user", result.user);
      c.set("sessionId", result.sessionId);
      if (result.refreshed) writeSessionCookie(c, token, result.expiresAt);
    } else {
      clearSessionCookie(c);
    }
  }
  await next();
});

/**
 * CSRF 防護：非 GET 請求如果瀏覽器標明來自其他網站就拒絕。
 * Sec-Fetch-Site 所有現行瀏覽器都會送；舊瀏覽器沒有這個 header 時改看 Origin。
 */
export const csrfMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const site = c.req.header("sec-fetch-site");
    const origin = c.req.header("origin");
    const ok =
      site !== undefined
        ? site === "same-origin" || site === "none"
        : origin === undefined || origin === c.var.config.appOrigin;
    if (!ok) return c.json({ error: { code: "FORBIDDEN", message: "跨站請求被拒絕" } }, 403);
  }
  await next();
});
