# 模組 2：空間/物品預約借用（booking）

需求：BOOK-1 ～ BOOK-7、INT-1、INT-2（見 `docs/requirements.md`）。
擁有的檔案：

- `apps/api/src/modules/booking/`、`apps/api/src/db/schema/booking.ts`、`apps/api/test/booking.test.ts`
- `apps/web/src/routes/booking/`、`apps/web/src/modules/booking/`
- `packages/shared/src/booking.ts`
- 本文件的 `## 進度`

## 進度

做完一個任務，就在同一個 PR 裡把它打勾。開工時從第一個沒打勾的任務開始。

- [x] B1 物品
- [x] B2 建立預約
- [x] B3 教室週狀態
- [x] B4 新增預約頁面
- [x] B5 借用紀錄
- [x] B6 審核
- [x] B7 借出與歸還
- [x] B8 取消

## API 一覽

全部掛在 `/api/booking`，全部至少要已登入且核准。

| 方法與路徑                                                        | 權限               | 說明                                                                                                                                                            | 任務 |
| ----------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `GET /items?roomId`                                               | 已核准             | query `roomId`（uuid，選填）→ `{ items: ItemDto[] }`：啟用中的共用物品 + 該教室的鑰匙                                                                           | B1   |
| `GET /items/availability?roomId&date&startTime&endTime`           | 已核准             | `{ items: ItemAvailabilityDto[] }`                                                                                                                              | B1   |
| `GET /admin/items`、`POST /admin/items`、`PATCH /admin/items/:id` | `item.manage`      | 物品管理（含停用）                                                                                                                                              | B1   |
| `GET /rooms/:id/week?week`                                        | 已核准             | query `week`（`DateStr`，該週任一天）→ `{ room: { id, code, name, capacity }, occupancy: OccupancyDto[], mine: BookingDto[] }`：該週占用 + 我在這間的待審核預約 | B3   |
| `POST /bookings`                                                  | `booking.create`   | body `CreateBookingInput` → 201 `{ booking }`                                                                                                                   | B2   |
| `GET /bookings/mine?status`                                       | `booking.viewOwn`  | `{ bookings }`：我的預約（借用紀錄）                                                                                                                            | B5   |
| `GET /bookings/:id`                                               | 本人或管理員       | `{ booking: BookingDetailDto }`（含 events）                                                                                                                    | B5   |
| `POST /bookings/:id/cancel`                                       | `canCancelBooking` |                                                                                                                                                                 | B8   |
| `GET /admin/bookings?status&roomId&from&to`                       | `booking.viewAll`  | 所有預約                                                                                                                                                        | B6   |
| `POST /admin/bookings/:id/review`                                 | `booking.review`   | body `ReviewBookingInput`                                                                                                                                       | B6   |
| `POST /admin/bookings/:id/checkout`                               | `booking.handover` | body `HandoverInput` → approved → checked_out                                                                                                                   | B7   |
| `POST /admin/bookings/:id/return`                                 | `booking.handover` | body `HandoverInput` → checked_out → returned                                                                                                                   | B7   |

## 規則

依《管理學院場所管理要點》（115-03-11 修正，常數在 `packages/shared/src/booking.ts`）：

- 使用日 3 天前申請（`BOOKING_LEAD_DAYS`）；管理員代為登記不受限。
- 開放 08:00–21:00，單筆最多 4 小時（`BOOKING_MAX_MINUTES`）。
- 管253、管352 原則上不外借（教室主檔 `is_bookable=false`）。只有要點附表二列出的場地開放預約。
- 收費、保證金、學生社團需先經課外活動組核准：系統只在預約頁顯示說明，不計算。

- 建立：
  - 教室要存在、啟用、可預約。
  - 時段不能在過去。
  - `assertRoomFree`（課程與已核准預約都會擋）。
  - 物品可借數量足夠；鑰匙只能借該教室的。
- 核准：
  - 再檢查一次占用與物品。
  - 同時被別人核准造成的重疊由 DB 約束擋下，轉成 409 `ROOM_OCCUPIED`。
- 每個狀態變化寫 `booking_events`。
- 狀態不允許的動作回 409 `INVALID_STATE`，訊息寫明目前狀態。

## 頁面

| 路徑                       | 內容                                                                 | 任務   |
| -------------------------- | -------------------------------------------------------------------- | ------ |
| `/booking`                 | 我的預約（依狀態分頁籤）+「新增預約」                                | B5     |
| `/booking/new?roomId&week` | 選教室（下拉 + 樓層分組）→ 該教室週曆 → 點空格或填表 → 選物品 → 送出 | B3、B4 |
| `/booking/$bookingId`      | 預約詳細 + 歷程 + 取消                                               | B5、B8 |
| `/booking/admin`           | 頁籤：待審核、待借出、借出中、全部；核准/退件（附意見）、借出、歸還  | B6、B7 |
| `/booking/admin/items`     | 物品管理                                                             | B1     |

---

## 任務

### B1 物品（P1）

- 前置：無。
- API：`GET /items?roomId`、`GET /items/availability`、`GET /admin/items`、`POST /admin/items`、`PATCH /admin/items/:id`（PATCH 用 `ItemPatch`）。
- 可借數量 = `quantity` − 該時段「同一時間最多被借走的數量」（approved / checked_out 的預約）。用掃描線計算，不是把所有重疊預約的數量加總。
- 頁面 `/booking/admin/items`：`DataTable` 列出物品；新增與編輯用 `Dialog`；類別是鑰匙時要選所屬教室（選項來自 `api.rooms.$get({ query: { bookable: "1" } })`）；可以停用。
- 驗收：`test/booking.test.ts` B1 區塊。

### B2 建立預約（P1）

- 前置：B1。
- API：`POST /bookings`，body `CreateBookingInput`，依「規則」一節檢查，寫入預約、物品與 `created` 歷程要在同一個 transaction。
- 驗收：B2 區塊。

### B3 教室週狀態（P1）

- 前置：無。
- API：`GET /rooms/:id/week?week`，回傳教室 `room`、該週 `occupancy`（`listOccupancy`）與我在這間教室的待審核預約 `mine`。
- 驗收：B3 區塊。

### B4 新增預約頁面（P1）

- 前置：B1、B2、B3。
- `/booking/new?roomId&week`：佔位頁已經定好 `validateSearch`（`roomId`、`week`），保留這兩個欄位。
- 教室下拉：`api.rooms.$get({ query: { bookable: "1" } })`，依建築與樓層用 `<optgroup>` 分組；換教室時更新網址的 `roomId`。
- `WeekNav` + `WeekGrid`：顯示時段用 `BOOKING_OPEN_TIME`–`BOOKING_CLOSE_TIME`；課程 `tone: "course"`、已核准預約 `tone: "booking"`、我的待審核 `tone: "pending"`、正在填的這筆 `tone: "conflict"`，附圖例。
- 點空白格帶入日期與時間（預設一小時）；早於最早可預約日時用 `toast` 提示，不帶入。
- 表單：日期（`min` 為最早可預約日）、開始與結束時間（`step` 600）、用途、人數；填好時間後列出 `availability` 的物品，可勾選與填數量。
- 頁面上方顯示「借用須知」：3 天前申請、開放時間、單次上限、學生社團規定，附 `BOOKING_RULES_URL` 連結。
- 送出成功導到 `/booking/$bookingId`；驗證錯誤顯示在欄位下方，`ROOM_OCCUPIED`、`ITEM_UNAVAILABLE` 用 `toast` 顯示後端訊息。
- 驗收：手動（電腦與手機）。

### B5 借用紀錄（P1）

- 前置：B2。
- API：`GET /bookings/mine?status`、`GET /bookings/:id`（本人或管理員；別人的回 404，含歷程 `events`）。
- 頁面 `/booking`：依狀態分頁籤（網址參數 `tab`）列出我的預約，有「新增預約」。
- 頁面 `/booking/$bookingId`：教室、時間、用途、人數、物品、審核意見、歷程時間軸；可以取消時顯示「取消預約」。
- 驗收：B5 區塊。

### B6 審核（P1）

- 前置：B2。
- API：`GET /admin/bookings?status&roomId&from&to`、`POST /admin/bookings/:id/review`（只有 pending 可以審核；核准時再檢查占用與物品；DB 約束擋下的重疊轉成 409 `ROOM_OCCUPIED`）。
- 頁面 `/booking/admin`：頁籤（網址參數 `tab`）「待審核、待借出、借出中、全部」，`DataTable` 列出；「審核」開 `Dialog`，可核准或退件，退件必填意見；有連到物品管理的按鈕。
- 驗收：B6 區塊。

### B7 借出與歸還（P2）

- 前置：B6。
- API：`POST /admin/bookings/:id/checkout`（approved → checked_out）、`POST /admin/bookings/:id/return`（checked_out → returned），body `HandoverInput`（選填備註），記錄時間與經手人。
- 頁面 `/booking/admin`：「借出」「歸還」按鈕，按下用 `ConfirmDialog` 確認（顯示教室、時間、借用人、物品）。
- 驗收：B7 區塊。

### B8 取消（P2）

- 前置：B2。
- API：`POST /bookings/:id/cancel`，依 `canCancelBooking`；別人的預約回 404。
- 頁面：預約詳細頁與管理頁（已核准的預約）都可以取消，用 `ConfirmDialog` 確認。
- 驗收：B8 區塊。
