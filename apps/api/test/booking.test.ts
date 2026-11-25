/**
 * 預約借用模組驗收測試。做任務時把對應的 it.todo 改成 it(...) 並實作，測試名稱不要改。
 * 規格：docs/modules/booking.md
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ItemAvailabilityDto, ItemDto } from "@class/shared/booking";
import { insertBooking, insertItem, insertRoom } from "./fixtures.ts";
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
  it.todo("已核准使用者可以建立預約，狀態為 pending，並寫入 created 歷程");
  it.todo("未登入 401、待審核 403");
  it.todo("與已排課程重疊回 409 ROOM_OCCUPIED");
  it.todo("與已核准預約重疊回 409 ROOM_OCCUPIED；與待審核預約重疊可以建立");
  it.todo("不可預約或停用的教室回 409 INVALID_STATE");
  it.todo("過去的時段回 400");
  it.todo("依管理要點：未滿 3 天前申請回 400，管理員代為登記不受限");
  it.todo("依管理要點：單筆最多 4 小時、最晚到 21:00");
  it.todo("物品數量不足回 409 ITEM_UNAVAILABLE");
  it.todo("不能借其他教室的鑰匙");
});

describe("B3 教室週狀態", () => {
  it.todo("回傳該週課程與已核准預約，以及我在這間教室的待審核預約");
});

describe("B5 借用紀錄", () => {
  it.todo("mine 只回自己的預約，可依狀態篩選");
  it.todo("預約詳細含歷程；別人的預約回 404");
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
