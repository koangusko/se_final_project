# 權限矩陣

程式：`packages/shared/src/permissions.ts`（前後端共用）。後端用 `requireAction(...)` 把關，前端只用來決定要不要顯示按鈕。
「已核准」= 狀態為 `approved`。未登入、未註冊、待審核、被拒絕的使用者都只能用「訪客」那一欄。

| 動作（action）                            | 訪客 |  一般使用者  |     教師     |     管理員     |
| ----------------------------------------- | :--: | :----------: | :----------: | :------------: |
| `space.view` 瀏覽教室、平面圖、全景、3D   |  是  |      是      |      是      |       是       |
| `space.manage` 教室與樓層增刪改、上傳媒體 |      |              |              |       是       |
| `occupancy.view` 看教室占用               |      |      是      |      是      |       是       |
| `booking.create` 建立預約                 |      |      是      |      是      |       是       |
| `booking.viewOwn` 看自己的預約與紀錄      |      |      是      |      是      |       是       |
| 取消預約                                  |      | 自己的待審核 | 自己的待審核 | 待審核與已核准 |
| `booking.viewAll` 看所有預約              |      |              |              |       是       |
| `booking.review` 核准、退件               |      |              |              |       是       |
| `booking.handover` 註記借出、歸還         |      |              |              |       是       |
| `item.manage` 物品增刪改                  |      |              |              |       是       |
| `course.view` 看排課週曆                  |      |      是      |      是      |       是       |
| `course.create` 建立課程                  |      |              |      是      |       是       |
| 修改、刪除課程與時段                      |      |              |   自己的課   |      全部      |
| `course.manageAll` 指派教師、改任何課     |      |              |              |       是       |
| `course.viewConflicts` 衝突清單           |      |              |              |       是       |
| `user.manage` 帳號審核、改角色            |      |              |              |       是       |

逐筆判斷的規則（不是單純看角色）：

- `canEditCourse(actor, course)`：管理員全部可以；教師只能改 `teacher_id` 是自己的課。
- `canCancelBooking(actor, booking)`：見上表「取消預約」。
