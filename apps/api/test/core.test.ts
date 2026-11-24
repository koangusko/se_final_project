/** 整合者負責的核心：登入、註冊審核、CSRF、教室占用、預約重疊約束。 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { toInstant } from "@class/shared/time";
import type { LineClient } from "../src/auth/line.ts";
import { isExclusionViolation } from "../src/core/db-errors.ts";
import { AppError } from "../src/core/errors.ts";
import { assertRoomFree, listOccupancy } from "../src/core/occupancy.ts";
import { bookings, users } from "../src/db/schema/index.ts";
import { insertBooking, insertCourse, insertRoom, insertSession } from "./fixtures.ts";
import { createTestContext, type TestContext } from "./helpers.ts";

const fakeLine: LineClient = {
  enabled: true,
  authorizeUrl: ({ state }) => `https://line.example/authorize?state=${state}`,
  exchangeCode: async (code) => ({ idToken: `id-token-for-${code}` }),
  verifyIdToken: async () => ({ sub: "U-line-123", name: "小明", picture: null }),
};

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext({ line: fakeLine });
});
afterAll(() => t?.close());

const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

describe("LINE 登入", () => {
  it("login 會導向 LINE 並設定 oauth cookie", async () => {
    const res = await t.request("/api/auth/line/login?redirect=/booking");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^https:\/\/line\.example\/authorize\?state=/);
    expect(res.headers.getSetCookie().join()).toContain("line_oauth=");
  });

  it("state 不符時拒絕", async () => {
    const login = await t.request("/api/auth/line/login");
    const res = await t.request("/api/auth/line/callback?code=abc&state=wrong", {
      headers: { cookie: cookiesOf(login) },
    });
    expect(res.headers.get("location")).toBe("/login?error=state");
  });

  it("第一次登入建立 unregistered 使用者並導向註冊頁", async () => {
    const login = await t.request("/api/auth/line/login?redirect=/booking");
    const state = new URL(login.headers.get("location")!).searchParams.get("state");
    const res = await t.request(`/api/auth/line/callback?code=abc&state=${state}`, {
      headers: { cookie: cookiesOf(login) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/register");
    const me = await t.request("/api/auth/me", { headers: { cookie: cookiesOf(res) } });
    const body = (await me.json()) as { user: { status: string; displayName: string } };
    expect(body.user).toMatchObject({ status: "unregistered", displayName: "小明" });
  });
});

describe("註冊與審核", () => {
  it("註冊後待審核，管理員核准後變成已核准", async () => {
    const newbie = await t.createUser({ status: "unregistered" });
    const admin = await t.createUser({ role: "admin" });

    const reg = await t.request("/api/auth/register", {
      as: newbie,
      json: { name: "王小明", affiliation: "資管系", requestedRole: "teacher" },
    });
    expect(reg.status).toBe(200);

    const pending = await t.request("/api/admin/users?status=pending", { as: admin });
    const list = (await pending.json()) as { users: { id: string }[] };
    expect(list.users.map((u) => u.id)).toContain(newbie.id);

    const review = await t.request(`/api/admin/users/${newbie.id}/review`, {
      as: admin,
      json: { decision: "approve", role: "teacher" },
    });
    expect(review.status).toBe(200);
    const [row] = await t.db.select().from(users).where(eq(users.id, newbie.id));
    expect(row).toMatchObject({ status: "approved", role: "teacher", reviewedBy: admin.id });
  });

  it("非管理員不能看使用者清單", async () => {
    const u = await t.createUser();
    const res = await t.request("/api/admin/users", { as: u });
    expect(res.status).toBe(403);
  });

  it("沒登入是 401", async () => {
    const res = await t.request("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("待審核的使用者是 403 NOT_APPROVED", async () => {
    const u = await t.createUser({ status: "pending" });
    const res = await t.request("/api/occupancy?from=2026-01-05&to=2026-01-12", { as: u });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("NOT_APPROVED");
  });
});

describe("CSRF", () => {
  it("跨站的非 GET 請求被拒絕", async () => {
    const u = await t.createUser();
    const res = await t.request("/api/auth/logout", {
      method: "POST",
      as: u,
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
  });
});

describe("教室占用", () => {
  it("已核准預約與課程時段都算占用，待審核不算", async () => {
    const admin = await t.createUser({ role: "admin" });
    const room = await insertRoom(t.db);
    await insertBooking(t.db, {
      userId: admin.id,
      roomId: room.id,
      date: "2026-03-02",
      start: "10:00",
      end: "12:00",
      status: "approved",
    });
    await insertBooking(t.db, {
      userId: admin.id,
      roomId: room.id,
      date: "2026-03-02",
      start: "13:00",
      end: "14:00",
      status: "pending",
    });
    const course = await insertCourse(t.db, { createdBy: admin.id, name: "資料庫系統" });
    await insertSession(t.db, {
      courseId: course.id,
      roomId: room.id,
      date: "2026-03-03",
      start: "09:10",
      end: "12:00",
    });
    await insertSession(t.db, {
      courseId: course.id,
      roomId: room.id,
      date: "2026-03-04",
      start: "09:10",
      end: "12:00",
      status: "cancelled",
    });

    const occ = await listOccupancy(t.db, {
      roomIds: [room.id],
      from: toInstant("2026-03-02", "00:00"),
      to: toInstant("2026-03-09", "00:00"),
    });
    expect(occ.map((o) => [o.source, o.label])).toEqual([
      ["booking", "已預約"],
      ["course", "資料庫系統"],
    ]);
  });

  it("assertRoomFree：剛好接在一起不算衝突，重疊會丟 ROOM_OCCUPIED", async () => {
    const admin = await t.createUser({ role: "admin" });
    const room = await insertRoom(t.db);
    const course = await insertCourse(t.db, { createdBy: admin.id, name: "統計學" });
    await insertSession(t.db, {
      courseId: course.id,
      roomId: room.id,
      date: "2026-03-05",
      start: "10:00",
      end: "12:00",
    });

    await expect(
      assertRoomFree(
        t.db,
        room.id,
        toInstant("2026-03-05", "12:00"),
        toInstant("2026-03-05", "13:00"),
      ),
    ).resolves.toBeUndefined();

    const err = await assertRoomFree(
      t.db,
      room.id,
      toInstant("2026-03-05", "11:50"),
      toInstant("2026-03-05", "13:00"),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("ROOM_OCCUPIED");
  });
});

describe("教室選單 /api/rooms", () => {
  it("未登入也能取得；只回啟用中的教室；bookable=1 只回可預約的", async () => {
    const open = await insertRoom(t.db, { code: "R-OPEN" });
    const office = await insertRoom(t.db, { code: "R-OFFICE", isBookable: false });
    const closed = await insertRoom(t.db, { code: "R-CLOSED", isActive: false });
    const all = (await (await t.request("/api/rooms")).json()) as { rooms: { id: string }[] };
    const ids = all.rooms.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([open.id, office.id]));
    expect(ids).not.toContain(closed.id);
    const bookable = (await (await t.request("/api/rooms?bookable=1")).json()) as {
      rooms: { id: string }[];
    };
    expect(bookable.rooms.map((r) => r.id)).not.toContain(office.id);
  });
});

describe("預約重疊的資料庫約束", () => {
  it("同教室兩筆已核准預約時段重疊會被擋（23P01）", async () => {
    const u = await t.createUser();
    const room = await insertRoom(t.db);
    await insertBooking(t.db, {
      userId: u.id,
      roomId: room.id,
      date: "2026-04-01",
      start: "10:00",
      end: "12:00",
      status: "approved",
    });
    const err = await insertBooking(t.db, {
      userId: u.id,
      roomId: room.id,
      date: "2026-04-01",
      start: "11:00",
      end: "13:00",
      status: "approved",
    }).catch((e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(true);
  });

  it("待審核的預約可以重疊；接在一起的已核准預約可以並存", async () => {
    const u = await t.createUser();
    const room = await insertRoom(t.db);
    await insertBooking(t.db, {
      userId: u.id,
      roomId: room.id,
      date: "2026-04-02",
      start: "10:00",
      end: "12:00",
      status: "approved",
    });
    await insertBooking(t.db, {
      userId: u.id,
      roomId: room.id,
      date: "2026-04-02",
      start: "11:00",
      end: "13:00",
      status: "pending",
    });
    await insertBooking(t.db, {
      userId: u.id,
      roomId: room.id,
      date: "2026-04-02",
      start: "12:00",
      end: "13:00",
      status: "approved",
    });
    const rows = await t.db.select().from(bookings).where(eq(bookings.roomId, room.id));
    expect(rows).toHaveLength(3);
  });
});
