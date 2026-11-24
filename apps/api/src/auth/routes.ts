/** /api/auth/*：LINE 登入、登出、註冊、目前使用者、開發用假登入。 */
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { DevLoginInput, RegisterInput, type AuthConfigDto, type MeDto } from "@class/shared/core";
import type { Role, UserStatus } from "@class/shared/permissions";
import { users } from "../db/schema/index.ts";
import { forbidden, invalidState } from "../core/errors.ts";
import { requireUser } from "../core/guards.ts";
import type { AppEnv } from "../core/http.ts";
import { validate } from "../core/validate.ts";
import {
  clearSessionCookie,
  safeRedirectPath,
  takeOAuthCookie,
  writeOAuthCookie,
  writeSessionCookie,
} from "./cookies.ts";
import { pkceChallenge, randomToken } from "./line.ts";
import { createSession, invalidateSession } from "./session.ts";
import { toMeDto } from "./users.ts";

const DEV_USERS: Record<DevLoginInput["as"], { role: Role; status: UserStatus; name: string }> = {
  admin: { role: "admin", status: "approved", name: "測試管理員" },
  teacher: { role: "teacher", status: "approved", name: "測試教師" },
  user: { role: "user", status: "approved", name: "測試使用者" },
  pending: { role: "user", status: "pending", name: "待審核使用者" },
};

export const authRoutes = new Hono<AppEnv>()
  .get("/config", (c) => {
    const body: AuthConfigDto = {
      lineEnabled: c.var.line.enabled,
      devLogin: c.var.config.devLogin,
    };
    return c.json(body);
  })

  .get("/me", (c) => {
    const user: MeDto | null = c.var.user ? toMeDto(c.var.user) : null;
    return c.json({ user });
  })

  .get("/line/login", validate("query", z.object({ redirect: z.string().optional() })), (c) => {
    const { redirect } = c.req.valid("query");
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const url = c.var.line.authorizeUrl({ state, nonce, codeChallenge: pkceChallenge(verifier) });
    writeOAuthCookie(c, { state, nonce, verifier, redirect: safeRedirectPath(redirect) });
    return c.redirect(url, 302);
  })

  .get("/line/callback", async (c) => {
    const saved = takeOAuthCookie(c);
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (c.req.query("error")) return c.redirect("/login?error=cancelled", 302);
    if (!saved || !code || !state || state !== saved.state) {
      return c.redirect("/login?error=state", 302);
    }

    let profile;
    try {
      const { idToken } = await c.var.line.exchangeCode(code, saved.verifier);
      profile = await c.var.line.verifyIdToken(idToken, saved.nonce);
    } catch (err) {
      console.error("LINE login failed", err);
      return c.redirect("/login?error=line", 302);
    }

    const [user] = await c.var.db
      .insert(users)
      .values({
        lineUserId: profile.sub,
        lineDisplayName: profile.name || "LINE 使用者",
        linePictureUrl: profile.picture,
      })
      .onConflictDoUpdate({
        target: users.lineUserId,
        set: {
          lineDisplayName: sql`excluded.line_display_name`,
          linePictureUrl: sql`excluded.line_picture_url`,
        },
      })
      .returning({ id: users.id, status: users.status });
    if (!user) throw new Error("upsert user returned nothing");

    const session = await createSession(c.var.db, user.id);
    writeSessionCookie(c, session.token, session.expiresAt);
    const next = user.status === "approved" ? saved.redirect : "/register";
    return c.redirect(next, 302);
  })

  .post("/logout", async (c) => {
    if (c.var.sessionId) await invalidateSession(c.var.db, c.var.sessionId);
    clearSessionCookie(c);
    return c.json({ ok: true });
  })

  .post("/register", validate("json", RegisterInput), async (c) => {
    const me = requireUser(c);
    if (me.status === "approved") throw invalidState("帳號已經審核通過，不需要再註冊");
    const input = c.req.valid("json");
    const [row] = await c.var.db
      .update(users)
      .set({
        name: input.name,
        affiliation: input.affiliation,
        phone: input.phone ?? null,
        requestedRole: input.requestedRole,
        status: "pending",
        reviewNote: null,
      })
      .where(eq(users.id, me.id))
      .returning();
    if (!row) throw new Error("user disappeared");
    const user: MeDto = toMeDto({
      ...me,
      name: row.name,
      affiliation: row.affiliation,
      status: row.status,
    });
    return c.json({ user });
  })

  .post("/dev-login", validate("json", DevLoginInput), async (c) => {
    if (!c.var.config.devLogin) throw forbidden("未開啟開發用登入");
    const { as } = c.req.valid("json");
    const preset = DEV_USERS[as];
    const [user] = await c.var.db
      .insert(users)
      .values({
        lineUserId: `dev-${as}`,
        lineDisplayName: preset.name,
        name: preset.name,
        affiliation: "開發測試",
        role: preset.role,
        status: preset.status,
      })
      .onConflictDoUpdate({
        target: users.lineUserId,
        set: { role: preset.role, status: preset.status },
      })
      .returning();
    if (!user) throw new Error("dev user upsert failed");
    const session = await createSession(c.var.db, user.id);
    writeSessionCookie(c, session.token, session.expiresAt);
    const me: MeDto = {
      id: user.id,
      name: user.name,
      displayName: user.lineDisplayName,
      pictureUrl: user.linePictureUrl,
      role: user.role,
      status: user.status,
      affiliation: user.affiliation,
    };
    return c.json({ user: me });
  });
