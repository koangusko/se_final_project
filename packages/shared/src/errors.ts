/**
 * API 錯誤格式。所有非 2xx 回應的 body 都長這樣：
 *   { "error": { "code": "ROOM_OCCUPIED", "message": "給人看的中文訊息", "details": ... } }
 * 前端用 code 判斷邏輯，用 message 顯示給使用者。
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED", // 401 沒登入或 session 過期
  "NOT_APPROVED", // 403 登入了但帳號還沒審核通過
  "FORBIDDEN", // 403 沒有權限
  "NOT_FOUND", // 404
  "VALIDATION", // 400 輸入格式錯誤，details 是欄位錯誤
  "INVALID_STATE", // 409 狀態不允許這個動作（例如已核准的預約不能再核准）
  "ROOM_OCCUPIED", // 409 教室在該時段已被占用，details 是衝突清單
  "ITEM_UNAVAILABLE", // 409 物品數量不足
  "DUPLICATE", // 409 唯一值重複（例如教室代碼）
  "PAYLOAD_TOO_LARGE", // 413
  "LINE_NOT_CONFIGURED", // 503 伺服器沒設定 LINE channel
  "INTERNAL", // 500
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
