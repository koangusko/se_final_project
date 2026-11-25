import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../core/http.ts";

/** 正式環境用 __Host- 前綴：強制 Secure、Path=/、不能設 Domain */
export const sessionCookieName = (c: Context<AppEnv>) =>
  c.var.config.secureCookies ? "__Host-session" : "session";

export function readSessionCookie(c: Context<AppEnv>) {
  return getCookie(c, sessionCookieName(c));
}

export function writeSessionCookie(c: Context<AppEnv>, token: string, expiresAt: Date) {
  setCookie(c, sessionCookieName(c), token, {
    httpOnly: true,
    secure: c.var.config.secureCookies,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, sessionCookieName(c), { path: "/", secure: c.var.config.secureCookies });
}

const OAUTH_COOKIE = "line_oauth";
const OAUTH_PATH = "/api/auth/line";

const OAuthStateSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  redirect: z.string(),
});
export type OAuthState = z.infer<typeof OAuthStateSchema>;

export function writeOAuthCookie(c: Context<AppEnv>, value: OAuthState) {
  setCookie(c, OAUTH_COOKIE, Buffer.from(JSON.stringify(value)).toString("base64url"), {
    httpOnly: true,
    secure: c.var.config.secureCookies,
    // LINE 轉回來是跨站的頂層 GET 導向，Lax 會帶 cookie；Strict 不會
    sameSite: "Lax",
    path: OAUTH_PATH,
    maxAge: 600,
  });
}

export function takeOAuthCookie(c: Context<AppEnv>): OAuthState | null {
  const raw = getCookie(c, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: OAUTH_PATH, secure: c.var.config.secureCookies });
  if (!raw) return null;
  try {
    const parsed = OAuthStateSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    // cookie 被竄改或格式錯誤，當作沒有
    return null;
  }
}

/** 只允許站內相對路徑，避免 open redirect */
export function safeRedirectPath(p: string | undefined | null): string {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p;
}
