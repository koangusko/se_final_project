/**
 * 課程排課模組驗收測試。做任務時把對應的 it.todo 改成 it(...) 並實作，測試名稱不要改。
 * 規格：docs/modules/scheduling.md
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers.ts";

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
afterAll(() => t?.close());

describe("C1 課程增刪改", () => {
  it.todo("未登入回 401，待審核回 403");
  it.todo("教師建立課程時 teacherId 一律是自己");
  it.todo("一般使用者不能建立課程");
  it.todo("管理員可以建立未指派教師的課程");
  it.todo("mine=1 只回自己教的課，含 sessionCount");
  it.todo("教師只能修改、刪除自己的課，改別人的回 403");
  it.todo("教師不能把課程改成別的教師");
  it.todo("刪除課程會一併刪除時段");
});

describe("C3 時段", () => {
  it.todo("建立時段時 repeatWeeks=3 產生三週同一時間的時段（台北時間正確）");
  it.todo("roomId 省略時使用課程的希望教室");
  it.todo("結束時間早於開始時間回 400");
  it.todo("教師不能新增、修改、刪除別人課程的時段");
  it.todo("建立時段不受教室占用限制（與已核准預約重疊仍可建立）");
});

describe("C4 排課週曆", () => {
  it.todo("回傳該週（週一 00:00 到下週一 00:00）的 scheduled 時段，不含 cancelled");
  it.todo("可以依 roomId、teacherId 篩選");
  it.todo("SessionDto 含課名、教師與教室");
});

describe("C5 指派教師", () => {
  it.todo("管理員可以指派與取消指派教師");
  it.todo("指派的對象必須是已核准的教師，否則回 400");
  it.todo("teachers 只列已核准的教師");
  it.todo("非管理員回 403");
});

describe("C6 衝突清單", () => {
  it.todo("同教室時段重疊列為 room_course，每組只列一次");
  it.todo("同教師時段重疊列為 teacher");
  it.todo("與已核准預約重疊列為 room_booking；待審核的預約不算");
  it.todo("剛好接在一起不算衝突");
  it.todo("cancelled 的時段不列入");
  it.todo("非管理員回 403");
});

describe("C7 拖拉調整", () => {
  it.todo("PATCH 時段可以改日期、時間與教室");
  it.todo("移動後造成的衝突會出現在衝突清單");
});
