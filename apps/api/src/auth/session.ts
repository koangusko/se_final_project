/**
 * Session：token 格式是「id.secret」。
 * - id：80 bits 隨機值，當資料表主鍵。
 * - secret：256 bits 隨機值，資料庫只存 SHA-256 雜湊，比對用常數時間。
 * - 有效期 10 天，有使用就往後延（最多每小時寫一次資料庫）。
 * 參考 Lucia 作者的現行建議做法（lucia-auth/lucia code/auth_session.ts）。
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { sessions, users } from "../db/schema/index.ts";
import type { CurrentUser } from "../core/http.ts";

export const SESSION_TTL_MS = 10 * 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 60 * 60 * 1000;

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest();

export function generateSessionToken() {
  const id = randomBytes(10).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  return { id, secret, token: `${id}.${secret}` };
}

export async function createSession(db: Db, userId: string, now = new Date()) {
  const { id, secret, token } = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, secretHash: hashSecret(secret), expiresAt });
  return { token, sessionId: id, expiresAt };
}

export interface ValidatedSession {
  sessionId: string;
  expiresAt: Date;
  /** true 表示這次有延長效期，呼叫端要重送 cookie */
  refreshed: boolean;
  user: CurrentUser;
}

export async function validateSessionToken(
  db: Db,
  token: string,
  now = new Date(),
): Promise<ValidatedSession | null> {
  const [id, secret, extra] = token.split(".");
  if (!id || !secret || extra !== undefined) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      secretHash: sessions.secretHash,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        name: users.name,
        displayName: users.lineDisplayName,
        pictureUrl: users.linePictureUrl,
        role: users.role,
        status: users.status,
        affiliation: users.affiliation,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const given = hashSecret(secret);
  if (given.length !== row.secretHash.length || !timingSafeEqual(given, row.secretHash)) {
    return null;
  }

  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  let expiresAt = row.expiresAt;
  let refreshed = false;
  if (expiresAt.getTime() - now.getTime() < SESSION_TTL_MS - REFRESH_AFTER_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    refreshed = true;
  }

  return { sessionId: row.sessionId, expiresAt, refreshed, user: row.user };
}

export async function invalidateSession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateUserSessions(db: Db, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
