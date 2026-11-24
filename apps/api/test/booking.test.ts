/**
 * 預約借用模組驗收測試。做任務時把對應的 it.todo 改成 it(...) 並實作，測試名稱不要改。
 * 規格：docs/modules/booking.md
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers.ts";

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
afterAll(() => t?.close());

describe("B1 物品", () => {
  it.todo("列出共用物品與該教室的鑰匙，不含其他教室的鑰匙與停用物品");
  it.todo("可借數量扣掉重疊時段已核准與借出中的數量");
  it.todo("管理員可以新增、修改、停用物品；非管理員 403");
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
