/**
 * 空間查詢模組驗收測試。做任務時把對應的 it.todo 改成 it(...) 並實作，測試名稱不要改。
 * 規格：docs/modules/space.md
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers.ts";

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
afterAll(() => t?.close());

describe("S1 教室清單", () => {
  it.todo("未登入也能取得樓層清單，依建築與樓層排序");
  it.todo("未登入也能取得教室清單，不包含停用的教室");
  it.todo("可以依樓層、類型篩選");
  it.todo("q 可以搜尋代碼、名稱與設備");
  it.todo("bookable=1 只回可預約的教室");
  it.todo("coverUrl、hasPanorama、hasSplat 依媒體正確計算");
});

describe("S2 教室詳細", () => {
  it.todo("未登入可以取得教室詳細資料與媒體清單");
  it.todo("停用或不存在的教室回 404");
});

describe("S3 管理員教室增刪改", () => {
  it.todo("管理員可以新增教室，回 201");
  it.todo("代碼重複回 409 DUPLICATE");
  it.todo("欄位驗證失敗回 400 VALIDATION 並附欄位錯誤");
  it.todo("管理員可以修改部分欄位");
  it.todo("刪除是軟刪除，之後清單看不到但預約紀錄仍可關聯");
  it.todo("非管理員新增、修改、刪除都回 403；未登入回 401");
});

describe("S4 樓層與平面圖", () => {
  it.todo("管理員可以新增、修改樓層；同建築同樓層重複回 409");
  it.todo("還有教室的樓層不能刪除，回 409 INVALID_STATE");
  it.todo("上傳平面圖後樓層回傳 planImageUrl 與寬高");
  it.todo("可以設定與清除教室在平面圖上的位置");
});

describe("S5 媒體上傳", () => {
  it.todo("管理員可以上傳照片，檔案寫入媒體資料夾並回傳網址");
  it.todo("全景圖格式不對回 400，超過大小上限回 413");
  it.todo("3D 格局只接受 .glb，上傳後有預設設定，可以修改");
  it.todo("3D 模型只接受 .spz");
  it.todo("可以修改說明與 viewConfig");
  it.todo("刪除媒體會一併刪除檔案");
  it.todo("多間教室共用的檔案，最後一筆刪掉才刪檔案");
});

describe("S9 與預約整合", () => {
  it.todo("教室詳細頁需要的本週占用可以由 /api/occupancy 依 roomId 取得（已登入）");
});
