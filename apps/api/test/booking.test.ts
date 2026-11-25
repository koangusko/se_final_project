/**
 * 預約借用模組驗收測試。做任務時把對應的 it.todo 改成 it(...) 並實作，測試名稱不要改。
 * 規格：docs/modules/booking.md
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  BookingDetailDto,
  BookingDto,
  ItemAvailabilityDto,
  ItemDto,
} from "@class/shared/booking";
import { addDays, todayInTaipei } from "@class/shared/time";
import { bookingEvents, bookingItems } from "../src/db/schema/index.ts";
import { insertBooking, insertCourse, insertItem, insertRoom, insertSession } from "./fixtures.ts";
import { createTestContext, type TestContext, type TestUser } from "./helpers.ts";

let t: TestContext;
let admin: TestUser;
let alice: TestUser;
let bob: TestUser;

/** 遠在未來的日期，避免「不能預約過去」干擾 */
const DAY = "2030-03-04";

beforeAll(async () => {
  t = await createTestContext();
  admin = await t.createUser({ role: "admin" });
  alice = await t.createUser();
  bob = await t.createUser();
});
afterAll(() => t?.close());

const json = async <T>(res: Response) => (await res.json()) as T;
const errorCode = async (res: Response) =>
  (await json<{ error: { code: string } }>(res)).error.code;

/** 預設 DAY 10:00–12:00 的預約 */
function book(as: TestUser | undefined, body: Record<string, unknown>) {
  return t.request("/api/booking/bookings", {
    ...(as ? { as } : {}),
    json: { date: DAY, startTime: "10:00", endTime: "12:00", purpose: "讀書會", ...body },
  });
}

describe("B1 物品", () => {
  it("列出共用物品與該教室的鑰匙，不含其他教室的鑰匙與停用物品", async () => {
    const r1 = await insertRoom(t.db);
    const r2 = await insertRoom(t.db);
    const key1 = await insertItem(t.db, { name: "r1 鑰匙", category: "key", roomId: r1.id });
    const key2 = await insertItem(t.db, { name: "r2 鑰匙", category: "key", roomId: r2.id });
    const pointer = await insertItem(t.db, { name: "投影筆", category: "pointer", quantity: 3 });
    const off = await insertItem(t.db, { name: "壞掉的筆電", category: "laptop", isActive: false });

    const res = await t.request(`/api/booking/items?roomId=${r1.id}`, { as: alice });
    expect(res.status).toBe(200);
    const ids = (await json<{ items: ItemDto[] }>(res)).items.map((i) => i.id);
    expect(ids).toContain(key1.id);
    expect(ids).toContain(pointer.id);
    expect(ids).not.toContain(key2.id);
    expect(ids).not.toContain(off.id);

    // 沒給教室時只有共用物品
    const shared = await t.request("/api/booking/items", { as: alice });
    const sharedIds = (await json<{ items: ItemDto[] }>(shared)).items.map((i) => i.id);
    expect(sharedIds).toContain(pointer.id);
    expect(sharedIds).not.toContain(key1.id);
  });

  it("可借數量扣掉重疊時段已核准與借出中的數量", async () => {
    const room = await insertRoom(t.db);
    const other = await insertRoom(t.db);
    const laptop = await insertItem(t.db, { name: "筆電 B1", category: "laptop", quantity: 3 });
    // 10–11 與 11–12 各借 1（不同時，峰值 1）+ 另一間 10–12 借 1 = 峰值 2
    // 待審核、已取消的不算；12:00 之後開始的不重疊
    const uses = [
      [room.id, "10:00", "11:00", "approved"],
      [room.id, "11:00", "12:00", "checked_out"],
      [other.id, "10:00", "12:00", "approved"],
      [other.id, "10:00", "12:00", "pending"],
      [other.id, "10:00", "12:00", "cancelled"],
      [room.id, "12:00", "13:00", "approved"],
    ] as const;
    for (const [roomId, start, end, status] of uses) {
      await insertBooking(t.db, {
        userId: bob.id,
        roomId,
        date: DAY,
        start,
        end,
        status,
        items: [{ itemId: laptop.id, quantity: 1 }],
      });
    }
    const res = await t.request(
      `/api/booking/items/availability?date=${DAY}&startTime=10:00&endTime=12:00`,
      { as: alice },
    );
    expect(res.status).toBe(200);
    const { items } = await json<{ items: ItemAvailabilityDto[] }>(res);
    expect(items.find((i) => i.id === laptop.id)?.available).toBe(1);
  });

  it("管理員可以新增、修改、停用物品；非管理員 403", async () => {
    const create = await t.request("/api/booking/admin/items", {
      as: admin,
      json: { name: "麥克風", category: "other", quantity: 2 },
    });
    expect(create.status).toBe(201);
    const { item } = await json<{ item: ItemDto }>(create);
    expect(item).toMatchObject({ name: "麥克風", roomId: null, description: "", isActive: true });

    const rename = await t.request(`/api/booking/admin/items/${item.id}`, {
      method: "PATCH",
      as: admin,
      json: { name: "無線麥克風", quantity: 4 },
    });
    expect(rename.status).toBe(200);
    expect((await json<{ item: ItemDto }>(rename)).item).toMatchObject({
      name: "無線麥克風",
      quantity: 4,
    });

    const disable = await t.request(`/api/booking/admin/items/${item.id}`, {
      method: "PATCH",
      as: admin,
      json: { isActive: false },
    });
    expect((await json<{ item: ItemDto }>(disable)).item.isActive).toBe(false);

    // 停用的物品管理員仍看得到
    const all = await t.request("/api/booking/admin/items", { as: admin });
    expect((await json<{ items: ItemDto[] }>(all)).items.map((i) => i.id)).toContain(item.id);

    // 只改一個欄位時，其他欄位（鑰匙綁定的教室、說明）不能被預設值蓋掉
    const room = await insertRoom(t.db);
    const key = await insertItem(t.db, {
      name: "鑰匙 PATCH",
      category: "key",
      roomId: room.id,
      description: "放在系辦",
    });
    const off = await t.request(`/api/booking/admin/items/${key.id}`, {
      method: "PATCH",
      as: admin,
      json: { isActive: false },
    });
    expect((await json<{ item: ItemDto }>(off)).item).toMatchObject({
      roomId: room.id,
      description: "放在系辦",
    });

    // 鑰匙要選所屬教室
    const keyless = await t.request("/api/booking/admin/items", {
      as: admin,
      json: { name: "沒教室的鑰匙", category: "key", quantity: 1 },
    });
    expect(keyless.status).toBe(400);

    const missing = await t.request(`/api/booking/admin/items/${crypto.randomUUID()}`, {
      method: "PATCH",
      as: admin,
      json: { isActive: false },
    });
    expect(missing.status).toBe(404);

    const denied = await t.request("/api/booking/admin/items", {
      as: alice,
      json: { name: "x", category: "other", quantity: 1 },
    });
    expect(denied.status).toBe(403);
    expect((await t.request("/api/booking/admin/items", { as: alice })).status).toBe(403);
  });
});

describe("B2 建立預約", () => {
  it("已核准使用者可以建立預約，狀態為 pending，並寫入 created 歷程", async () => {
    const room = await insertRoom(t.db);
    const pointer = await insertItem(t.db, {
      name: "投影筆 B2-1",
      category: "pointer",
      quantity: 2,
    });
    const res = await book(alice, {
      roomId: room.id,
      attendeeCount: 12,
      items: [{ itemId: pointer.id, quantity: 2 }],
    });
    expect(res.status).toBe(201);
    const { booking } = await json<{ booking: BookingDto }>(res);
    expect(booking).toMatchObject({
      status: "pending",
      purpose: "讀書會",
      attendeeCount: 12,
      user: { id: alice.id },
      room: { id: room.id, code: room.code },
      startsAt: "2030-03-04T02:00:00.000Z",
      endsAt: "2030-03-04T04:00:00.000Z",
      items: [{ itemId: pointer.id, quantity: 2, category: "pointer" }],
    });

    const events = await t.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, booking.id));
    expect(events).toMatchObject([{ action: "created", actorId: alice.id }]);
  });

  it("未登入 401、待審核 403", async () => {
    const room = await insertRoom(t.db);
    expect((await book(undefined, { roomId: room.id })).status).toBe(401);
    const pending = await t.createUser({ status: "pending" });
    expect((await book(pending, { roomId: room.id })).status).toBe(403);
  });

  it("與已排課程重疊回 409 ROOM_OCCUPIED", async () => {
    const room = await insertRoom(t.db);
    const course = await insertCourse(t.db, { createdBy: admin.id, name: "會計學" });
    await insertSession(t.db, {
      courseId: course.id,
      roomId: room.id,
      date: DAY,
      start: "11:10",
      end: "13:00",
    });
    const res = await book(alice, { roomId: room.id });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("ROOM_OCCUPIED");

    // 課程結束後接著借可以
    const after = await book(alice, { roomId: room.id, startTime: "13:00", endTime: "14:00" });
    expect(after.status).toBe(201);
  });

  it("與已核准預約重疊回 409 ROOM_OCCUPIED；與待審核預約重疊可以建立", async () => {
    const room = await insertRoom(t.db);
    await insertBooking(t.db, {
      userId: bob.id,
      roomId: room.id,
      date: DAY,
      start: "09:00",
      end: "10:30",
      status: "approved",
    });
    const res = await book(alice, { roomId: room.id });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("ROOM_OCCUPIED");

    const room2 = await insertRoom(t.db);
    await insertBooking(t.db, {
      userId: bob.id,
      roomId: room2.id,
      date: DAY,
      start: "09:00",
      end: "10:30",
      status: "pending",
    });
    expect((await book(alice, { roomId: room2.id })).status).toBe(201);
  });

  it("不可預約或停用的教室回 409 INVALID_STATE", async () => {
    const office = await insertRoom(t.db, { isBookable: false });
    const closed = await insertRoom(t.db, { isActive: false });
    const r1 = await book(alice, { roomId: office.id });
    expect(r1.status).toBe(409);
    expect(await errorCode(r1)).toBe("INVALID_STATE");
    const r2 = await book(alice, { roomId: closed.id });
    expect(r2.status).toBe(409);
    expect(await errorCode(r2)).toBe("INVALID_STATE");
    expect((await book(alice, { roomId: crypto.randomUUID() })).status).toBe(404);
  });

  it("過去的時段回 400", async () => {
    const room = await insertRoom(t.db);
    // 管理員不受 3 天限制，仍不能借過去
    expect((await book(admin, { roomId: room.id, date: "2020-01-06" })).status).toBe(400);
    expect((await book(alice, { roomId: room.id, date: "2020-01-06" })).status).toBe(400);
  });

  it("依管理要點：未滿 3 天前申請回 400，管理員代為登記不受限", async () => {
    const room = await insertRoom(t.db);
    const soon = addDays(todayInTaipei(), 2);
    const tooSoon = await book(alice, { roomId: room.id, date: soon });
    expect(tooSoon.status).toBe(400);
    expect(await errorCode(tooSoon)).toBe("VALIDATION");
    expect((await book(admin, { roomId: room.id, date: soon })).status).toBe(201);
    const ok = addDays(todayInTaipei(), 3);
    expect(
      (await book(alice, { roomId: room.id, date: ok, startTime: "13:00", endTime: "14:00" }))
        .status,
    ).toBe(201);
  });

  it("依管理要點：單筆最多 4 小時、最晚到 21:00", async () => {
    const room = await insertRoom(t.db);
    const cases = [
      ["08:00", "12:10", 400],
      ["19:00", "21:10", 400],
      ["07:50", "09:00", 400],
      ["17:00", "21:00", 201],
      ["08:00", "12:00", 201],
    ] as const;
    for (const [startTime, endTime, status] of cases) {
      expect((await book(alice, { roomId: room.id, startTime, endTime })).status).toBe(status);
    }
  });

  it("物品數量不足回 409 ITEM_UNAVAILABLE", async () => {
    const room = await insertRoom(t.db);
    const other = await insertRoom(t.db);
    const pointer = await insertItem(t.db, { name: "投影筆 B2", category: "pointer", quantity: 2 });
    const res = await book(alice, {
      roomId: room.id,
      items: [{ itemId: pointer.id, quantity: 3 }],
    });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("ITEM_UNAVAILABLE");

    // 同時段別間教室已核准借走 1 支，只剩 1 支
    await insertBooking(t.db, {
      userId: bob.id,
      roomId: other.id,
      date: DAY,
      start: "11:00",
      end: "12:00",
      status: "approved",
      items: [{ itemId: pointer.id, quantity: 1 }],
    });
    const two = await book(alice, {
      roomId: room.id,
      items: [{ itemId: pointer.id, quantity: 2 }],
    });
    expect(await errorCode(two)).toBe("ITEM_UNAVAILABLE");
    const one = await book(alice, {
      roomId: room.id,
      items: [{ itemId: pointer.id, quantity: 1 }],
    });
    expect(one.status).toBe(201);

    // 停用的物品不能借
    const off = await insertItem(t.db, { category: "laptop", quantity: 5, isActive: false });
    const disabled = await book(alice, {
      roomId: room.id,
      items: [{ itemId: off.id, quantity: 1 }],
    });
    expect(disabled.status).toBe(400);
  });

  it("不能借其他教室的鑰匙", async () => {
    const room = await insertRoom(t.db);
    const other = await insertRoom(t.db);
    const key = await insertItem(t.db, { name: "別間鑰匙", category: "key", roomId: other.id });
    const res = await book(alice, { roomId: room.id, items: [{ itemId: key.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("VALIDATION");

    // 失敗時不留下任何資料
    const left = await t.db.select().from(bookingItems).where(eq(bookingItems.itemId, key.id));
    expect(left).toEqual([]);

    const own = await insertItem(t.db, { name: "這間鑰匙", category: "key", roomId: room.id });
    const ok = await book(alice, { roomId: room.id, items: [{ itemId: own.id, quantity: 1 }] });
    expect(ok.status).toBe(201);
  });
});

describe("B3 教室週狀態", () => {
  it("回傳該週課程與已核准預約，以及我在這間教室的待審核預約", async () => {
    // DAY = 2030-03-04 是週一
    const room = await insertRoom(t.db);
    const other = await insertRoom(t.db);
    const course = await insertCourse(t.db, { createdBy: admin.id, name: "財務管理" });
    await insertSession(t.db, {
      courseId: course.id,
      roomId: room.id,
      date: DAY,
      start: "08:10",
      end: "10:00",
    });
    // 別間教室的課、下週的課不算
    await insertSession(t.db, {
      courseId: course.id,
      roomId: other.id,
      date: DAY,
      start: "08:10",
      end: "10:00",
    });
    await insertSession(t.db, {
      courseId: course.id,
      roomId: room.id,
      date: "2030-03-11",
      start: "08:10",
      end: "10:00",
    });
    const at = (date: string, status: "pending" | "approved", userId = bob.id, roomId = room.id) =>
      insertBooking(t.db, { userId, roomId, date, start: "10:00", end: "12:00", status });
    const approved = await at("2030-03-05", "approved");
    await at("2030-03-06", "pending"); // 別人的待審核：不占用，也不是我的
    const mine = await at("2030-03-07", "pending", alice.id);
    await at("2030-03-08", "pending", alice.id, other.id); // 我在別間的
    await at("2030-03-11", "pending", alice.id); // 我下週的

    // week 給該週任一天都可以（這裡給週三）
    const res = await t.request(`/api/booking/rooms/${room.id}/week?week=2030-03-06`, {
      as: alice,
    });
    expect(res.status).toBe(200);
    const body = await json<{
      room: { id: string; code: string; name: string; capacity: number };
      occupancy: { source: string; refId: string; label: string }[];
      mine: BookingDto[];
    }>(res);
    expect(body.room).toEqual({
      id: room.id,
      code: room.code,
      name: room.name,
      capacity: room.capacity,
    });
    expect(body.occupancy.map((o) => o.source)).toEqual(["course", "booking"]);
    expect(body.occupancy[0]?.label).toBe("財務管理");
    expect(body.occupancy[1]?.refId).toBe(approved.id);
    expect(body.mine.map((b) => b.id)).toEqual([mine.id]);

    expect(
      (await t.request(`/api/booking/rooms/${crypto.randomUUID()}/week?week=${DAY}`, { as: alice }))
        .status,
    ).toBe(404);
    expect((await t.request(`/api/booking/rooms/${room.id}/week`, { as: alice })).status).toBe(400);
    expect((await t.request(`/api/booking/rooms/${room.id}/week?week=${DAY}`)).status).toBe(401);
  });
});

describe("B5 借用紀錄", () => {
  it("mine 只回自己的預約，可依狀態篩選", async () => {
    const carol = await t.createUser();
    const room = await insertRoom(t.db);
    const created = await book(carol, { roomId: room.id, startTime: "08:00", endTime: "09:00" });
    const { booking: b1 } = await json<{ booking: BookingDto }>(created);
    await insertBooking(t.db, {
      userId: bob.id,
      roomId: room.id,
      date: DAY,
      start: "13:00",
      end: "14:00",
    });
    const returned = await insertBooking(t.db, {
      userId: carol.id,
      roomId: room.id,
      date: "2030-03-05",
      start: "15:00",
      end: "16:00",
      status: "returned",
    });

    const all = await json<{ bookings: BookingDto[] }>(
      await t.request("/api/booking/bookings/mine", { as: carol }),
    );
    // 新到舊
    expect(all.bookings.map((b) => b.id)).toEqual([returned.id, b1.id]);
    expect(all.bookings.every((b) => b.user.id === carol.id)).toBe(true);

    const pending = await json<{ bookings: BookingDto[] }>(
      await t.request("/api/booking/bookings/mine?status=pending", { as: carol }),
    );
    expect(pending.bookings.map((b) => b.id)).toEqual([b1.id]);

    const bad = await t.request("/api/booking/bookings/mine?status=nope", { as: carol });
    expect(bad.status).toBe(400);
  });

  it("預約詳細含歷程；別人的預約回 404", async () => {
    const room = await insertRoom(t.db);
    const pointer = await insertItem(t.db, { category: "pointer", quantity: 2 });
    const created = await book(alice, {
      roomId: room.id,
      items: [{ itemId: pointer.id, quantity: 1 }],
    });
    const { booking: b } = await json<{ booking: BookingDto }>(created);

    const mine = await t.request(`/api/booking/bookings/${b.id}`, { as: alice });
    expect(mine.status).toBe(200);
    const { booking: detail } = await json<{ booking: BookingDetailDto }>(mine);
    expect(detail).toMatchObject({
      id: b.id,
      status: "pending",
      room: { id: room.id },
      items: [{ itemId: pointer.id, quantity: 1 }],
    });
    expect(detail.events).toMatchObject([
      { action: "created", actor: { id: alice.id, name: alice.name }, note: null },
    ]);

    const other = await t.request(`/api/booking/bookings/${b.id}`, { as: bob });
    expect(other.status).toBe(404);
    expect((await t.request(`/api/booking/bookings/${b.id}`, { as: admin })).status).toBe(200);
    const missing = await t.request(`/api/booking/bookings/${crypto.randomUUID()}`, { as: alice });
    expect(missing.status).toBe(404);
  });
});

describe("B6 審核", () => {
  it.todo("管理員核准後狀態為 approved，記錄審核者與意見");
  it.todo("退件必須填意見");
  it.todo("核准時若已被課程占用回 409 ROOM_OCCUPIED");
  it.todo("兩筆重疊的待審核預約，核准第一筆後第二筆核准失敗");
  it.todo("只有 pending 可以審核，其他狀態回 409 INVALID_STATE");
  it.todo("非管理員 403");
});

describe("B7 借出與歸還", () => {
  it.todo("approved 可以借出，checked_out 可以歸還，各自記錄時間與經手人");
  it.todo("狀態不對回 409 INVALID_STATE");
});

describe("B8 取消", () => {
  it.todo("本人可以取消待審核的預約");
  it.todo("本人不能取消已核准的預約；管理員可以");
});
