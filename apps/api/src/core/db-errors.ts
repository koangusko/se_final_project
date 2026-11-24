/**
 * 判斷 Postgres 錯誤種類。pg 和 PGlite 都會把 SQLSTATE 放在 code；
 * Drizzle 0.45 會把原始錯誤包在 DrizzleQueryError.cause 裡，所以兩層都要看。
 */
function sqlState(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

/** EXCLUDE 約束（例如預約時段重疊） */
export const isExclusionViolation = (err: unknown) => sqlState(err) === "23P01";

export const isUniqueViolation = (err: unknown) => sqlState(err) === "23505";

export const isForeignKeyViolation = (err: unknown) => sqlState(err) === "23503";
