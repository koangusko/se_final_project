# 模組 1：管院空間查詢（space）

需求：SPACE-1 ～ SPACE-6、INT-1（見 `docs/requirements.md`）。
擁有的檔案：

- `apps/api/src/modules/space/`、`apps/api/src/db/schema/space.ts`、`apps/api/test/space.test.ts`
- `apps/web/src/routes/space/`、`apps/web/src/modules/space/`
- `packages/shared/src/space.ts`
- 本文件的 `## 進度`

資料表 `floors`、`rooms`、`room_media` 已經建好，69 間空間的種子資料用 `pnpm db:seed` 匯入。

## 進度

做完一個任務，就在同一個 PR 裡把它打勾。開工時從第一個沒打勾的任務開始。

- [ ] S1 教室清單
- [ ] S2 教室詳細頁
- [ ] S3 管理員教室增刪改
- [ ] S4 樓層與平面圖
- [ ] S5 媒體上傳
- [ ] S6 360 全景檢視器
- [ ] S7 3D 檢視器：兩種格式
- [ ] S8 從 3D 模型產生全景圖
- [ ] S9 與預約整合

## API 一覽

全部掛在 `/api/space`。回應格式、錯誤處理見根目錄 `AGENTS.md`。DTO 型別都在 `packages/shared/src/space.ts`。

| 方法與路徑                                                | 權限           | 說明                                                                                                             | 任務   |
| --------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| `GET /floors`                                             | 公開           | `{ floors: FloorDto[] }`，依建築、樓層排序                                                                       | S1     |
| `GET /rooms?floorId&type&q&bookable`                      | 公開           | `{ rooms: RoomDto[] }`，只回 `is_active`；`q` 搜尋代碼、名稱、設備                                               | S1     |
| `GET /rooms/:id`                                          | 公開           | `{ room: RoomDetailDto }`（含 media）；停用的教室回 404                                                          | S2     |
| `POST /rooms`                                             | `space.manage` | body `RoomInput` → 201 `{ room }`；代碼重複 409 `DUPLICATE`                                                      | S3     |
| `PATCH /rooms/:id`                                        | `space.manage` | body `RoomInput` 的部分欄位 → `{ room }`                                                                         | S3     |
| `DELETE /rooms/:id`                                       | `space.manage` | 軟刪除（`is_active=false`）→ `{ ok: true }`                                                                      | S3     |
| `POST /floors`、`PATCH /floors/:id`、`DELETE /floors/:id` | `space.manage` | 樓層管理；還有教室的樓層不能刪（409 `INVALID_STATE`）                                                            | S4     |
| `PUT /floors/:id/plan?width&height`                       | `space.manage` | body 直接是圖片（jpeg/png/webp，最大 10MB），寬高由前端讀圖後帶 query                                            | S4     |
| `PUT /rooms/:id/placement`                                | `space.manage` | body `UpdatePlacementInput`                                                                                      | S4     |
| `PUT /rooms/:id/media?kind&caption&filename`              | `space.manage` | body 直接是檔案；kind 是 photo / panorama / mesh（.glb）/ splat（.spz），限制見 `MEDIA_LIMITS` → 201 `{ media }` | S5     |
| `PATCH /media/:mediaId`                                   | `space.manage` | 改 `caption`、`sortOrder`、`viewConfig`（splat）、`meshConfig`（mesh）                                           | S5、S7 |
| `DELETE /media/:mediaId`                                  | `space.manage` | 刪資料列；沒有其他資料列共用同一個檔案時才刪檔案                                                                 | S5     |

封面圖 `coverUrl`：第一張 photo，沒有就用 panorama，都沒有是 null。
`hasPanorama` / `hasSplat`：有沒有該種 media。

## 頁面一覽

| 路徑                         | 權限   | 內容                                                                       | 任務           |
| ---------------------------- | ------ | -------------------------------------------------------------------------- | -------------- |
| `/space`                     | 公開   | 樓層切換 + 平面圖 + 教室清單（篩選：類型、容納人數、關鍵字）               | S1、S4         |
| `/space/rooms/$roomId`       | 公開   | 教室詳細：基本資料、設備、照片、全景、3D、本週占用（登入後）、「預約這間」 | S2、S6、S7、S9 |
| `/space/admin`               | 管理員 | 教室管理表格 + 新增/編輯/停用                                              | S3             |
| `/space/admin/floors`        | 管理員 | 樓層、平面圖上傳、教室位置拖拉編輯                                         | S4             |
| `/space/admin/rooms/$roomId` | 管理員 | 單一教室的媒體管理：上傳照片/全景/3D、調整 3D 顯示、產生全景               | S5、S7、S8     |

`/space` 和 `/space/admin` 的佔位頁已存在，直接替換內容。

手機（見 `AGENTS.md`「手機與電腦一樣重要」）：

- `/space`：手機上平面圖佔滿寬度、可雙指縮放，清單在平面圖下方；樓層切換用橫向可捲動的按鈕列。
- 教室詳細頁：全景與 3D 都要有全螢幕按鈕；手機上全景預設可以用陀螺儀（按鈕啟用）。
- 管理頁：教室與媒體管理要能在手機上操作（上傳照片、全景可以直接從手機相簿選）。只有「教室位置拖拉編輯」可以只支援電腦，手機上顯示「請用電腦編輯平面圖位置」。

細部規則：

- PATCH 用沒有 default 的 schema（`RoomPatchInput`、`FloorPatchInput`），見 AGENTS.md「已知陷阱」。
- 停用的教室目前不能從介面重新啟用；代碼仍占用唯一值。之後如果需要，加「已停用」篩選與「重新啟用」。
- 只剩停用教室的樓層可以刪除，刪除後那些教室的樓層變成未指定。
- 教室換樓層時清掉它在舊平面圖上的位置。
- 沒有平面圖時格線畫布座標是 1000×600；換一張尺寸不同的平面圖，已標的位置不會自動縮放。
- 樓層與教室排序：管理學院在前（`core/ordering.ts` 的 `mainBuildingFirst`），再依建築名稱、樓層。
- 媒體的 `sortOrder` 是整間教室共用一個序號。
- 「預約這間」連到 `/booking/new?roomId=`（預約模組的頁面）。

---

## 任務

### S1 教室清單（P1）

- API：`GET /floors`、`GET /rooms`。
- 頁面 `/space`：先只做清單（卡片或表格）與篩選；平面圖在 S4 補上。手機單欄。
- 卡片顯示：代碼、名稱、類型（`ROOM_TYPE_LABELS`）、容納人數、前 4 項設備、封面圖、「有全景」「有 3D」標記。
- 驗收：`test/space.test.ts` 的 S1 區塊。

### S2 教室詳細頁（P1）

- API：`GET /rooms/:id`。
- 頁面 `/space/rooms/$roomId`：基本資料、完整設備清單、說明、照片。全景與 3D 先留位置（S6、S7 補）。
- 驗收：S2 區塊。

### S3 管理員教室增刪改（P1）

- API：`POST/PATCH/DELETE /rooms`。
- 頁面 `/space/admin`：表格（代碼、名稱、樓層、類型、人數、可預約、媒體數），新增/編輯用 `Dialog` + 表單，停用用 `ConfirmDialog`。
- 欄位驗證錯誤顯示在欄位下方（`fieldErrors(err.details)`）。
- 驗收：S3 區塊。

### S4 樓層與平面圖（P2）

- 平面圖用 SVG 自己畫，不要裝套件：
  - 有平面圖圖片時用 `<image>` 當底圖，沒有時畫淺色格線。
  - 每間教室畫成矩形，顯示代碼。點擊後到詳細頁。
  - 依類型上色，不可預約的空間用灰色。
  - 支援滑鼠滾輪/雙指縮放與拖曳平移，pointer events 手寫約 60 行即可。
- 管理頁 `/space/admin/floors`：
  - 樓層增刪改、上傳平面圖。前端用 `new Image()` 讀出寬高，帶在 query。
  - 教室位置編輯：左側列出這層還沒放的教室，拖到平面圖上產生矩形，矩形可以拖動和拉角縮放，按儲存呼叫 `PUT /rooms/:id/placement`。可以用 `@dnd-kit/core`，也可以直接用 pointer events。
- `/space` 頁加上平面圖，選樓層後平面圖與清單同步，滑過清單項目時平面圖上的矩形要亮起來。
- 驗收：S4 區塊。

### S5 媒體上傳（P2）

- API：`PUT /rooms/:id/media`、`PATCH/DELETE /media/:id`。
  - 用 `core/media.ts` 的 `saveRequestBody`。
  - 存放路徑 `rooms/<roomId>/<隨機 uuid>.<副檔名>`。
  - 大小與格式依 `MEDIA_LIMITS`，panorama 與 photo 檢查 content-type，mesh 檢查副檔名 `.glb`、splat 檢查 `.spz`（前端在 query 帶 `filename`）。
  - 上傳 mesh / splat 時寫入預設設定（`MeshViewConfig.parse({})` / `SplatViewConfig.parse({})`）。
- 前端用 `lib/api.ts` 的 `uploadFile`，要顯示上傳進度。
- 管理頁 `/space/admin/rooms/$roomId`：分四區（照片、360 全景、3D 格局、3D 實景），可上傳、刪除、改說明。
- 驗收：S5 區塊。

### S6 360 全景檢視器（P2）

自己用 three.js 寫，**不用 Pannellum**。元件放 `apps/web/src/modules/space/PanoramaViewer.tsx`，約 150–250 行：

- `three` 用動態 `import()` 載入。
- `THREE.WebGLRenderer({ antialias: false })`，`setPixelRatio(Math.min(devicePixelRatio, 2))`。
- 全景圖用 `TextureLoader` 載入：
  - `texture.mapping = THREE.EquirectangularReflectionMapping`
  - `texture.colorSpace = THREE.SRGBColorSpace`
  - 設成 `scene.background`
  - `renderer.toneMapping = THREE.NoToneMapping`
- 相機放原點，滑鼠/手指拖曳改變 yaw/pitch（pitch 限制在 ±85 度），滾輪/雙指縮放改 FOV（30–90）。
- 手機陀螺儀：要有「啟用陀螺儀」按鈕，在按鈕的點擊事件裡呼叫 `DeviceOrientationEvent.requestPermission()`（iOS）。
- 全螢幕按鈕（`element.requestFullscreen()`；iOS Safari 不支援時改用 CSS 固定全螢幕）。
- 元件卸載時 `renderer.dispose()`、`texture.dispose()`，取消 animation frame 和事件監聽。
- 驗收：手動（電腦與手機各試一次），寫在回報裡。

### S7 3D 檢視器：兩種格式（P2）

3D 有兩種來源，**兩種都要支援**。一間教室兩種都有時，教室頁提供切換（例如「格局 / 實景」頁籤），預設顯示 3D 格局。媒體種類與設定的契約已經定義在 `packages/shared/src/space.ts`（`mesh` + `MeshViewConfig`、`splat` + `SplatViewConfig`）。

|      | 3D 格局（`mesh`，主要）                                         | 高斯噴濺（`splat`，次要）                    |
| ---- | --------------------------------------------------------------- | -------------------------------------------- |
| 來源 | iPhone Pro LiDAR，Scaniverse / Polycam 的 Mesh 模式匯出 **GLB** | Scaniverse 的 Splat 模式，轉成 **SPZ**       |
| 元件 | `apps/web/src/modules/space/MeshViewer.tsx`                     | `apps/web/src/modules/space/SplatViewer.tsx` |

**3D 格局（GLB）檢視器**

- `three/addons/loaders/GLTFLoader.js` 載入，`OrbitControls` 操作，three 用動態 `import()`。
- 材質換成 `MeshBasicMaterial`（保留 `map`），不打光。
- 模型移到「地板中心在原點」：用 `Box3` 算出範圍，位移成 `x、z` 置中、`min.y = 0`。
- 掀開天花板：`renderer.localClippingEnabled = true`，材質加 `clippingPlanes: [new Plane(new Vector3(0, -1, 0), 高度)]`。高度取 `ceilingCut` 與「模型高度 − 0.15 公尺」較小的那個。要有「掀開 / 蓋回天花板」按鈕。
- 材質只畫正面（`FrontSide`）。
- 沒有存過視角（`cameraPosition` 為 null）時，自動從斜上方看整間；不能轉到地板下面。
- 管理頁可以調整 `rotationY`、`ceilingCut`，可以「把目前視角存成預設」或「改回自動視角」，存到 `PATCH /media/:id` 的 `meshConfig`。

**高斯噴濺（SPZ）檢視器**

- 使用 `@sparkjsdev/spark` 2.4（版本鎖死，搭配 three 0.187）：
  ```ts
  const THREE = await import("three");
  const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  const scene = new THREE.Scene();
  scene.add(new SparkRenderer({ renderer }));
  const splat = new SplatMesh({ url });
  await splat.initialized;
  scene.add(splat);
  ```
- 套用 `viewConfig`（旋轉、位置、縮放、初始相機）。預設旋轉 `[180, 0, 0]`。
- 管理頁可以調整旋轉三軸、高度、縮放、初始視角，存到 `PATCH /media/:id` 的 `viewConfig`。
- 上傳前用 `node scripts/clean-spz.ts` 清掉過大的雜點（見 `docs/3d-capture.md`）。
- API 參考：`apps/web/node_modules/@sparkjsdev/spark/dist/types/SplatMesh.d.ts`、`SparkRenderer.d.ts`。

**共通**

- 載入中顯示進度；載入失敗顯示錯誤，不要整頁壞掉；有全螢幕按鈕（iPhone 用 CSS 全螢幕）。
- 一個檔案可以被多間教室共用（例如示範檔）：刪除媒體時，還有其他資料列用同一個路徑就不刪檔案。
- 驗收：S5 區塊的 API 測試 + 手動（用真的 GLB 與 SPZ 各試一次，電腦與手機）。

### S8 從 3D 模型產生全景圖（P2）

- 管理頁的 3D 區塊加「從這個位置產生全景」。
- 做法：
  1. 用 `spark.renderCubeMap({ scene, worldCenter, size: 1024, hideObjects: [], update: true, filter: false })` 取得 CubeTexture。
  2. 用一個全螢幕 shader（ShaderMaterial + 2:1 的 WebGLRenderTarget，例如 4096×2048）把 cube map 轉成等距長方投影。注意左右鏡像。
  3. `readRenderTargetPixels` 讀出後畫到 canvas，`canvas.toBlob("image/jpeg", 0.9)`。
  4. 以 panorama 上傳。
- `worldCenter` 用目前相機位置；管理員可以先在 3D 裡走到房間中央再按。
- 驗收：手動。

### S9 與預約整合（P3，INT-1）

- 教室詳細頁：
  - 已登入且已核准時，用 `GET /api/occupancy?roomId&from&to` 顯示本週占用。用 `WeekGrid`，課程用 `tone: "course"`，預約用 `tone: "booking"`，不可拖拉。
  - 未登入時顯示「登入後可查看借用狀況」。
- 「預約這間」按鈕連到 `/booking/new?roomId=<id>`（預約模組的頁面）；`is_bookable=false` 的空間不顯示。
- 驗收：S9 區塊（API 部分）+ 手動。
