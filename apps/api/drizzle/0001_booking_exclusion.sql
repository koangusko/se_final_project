-- 手寫的 migration：Drizzle 不支援 EXCLUDE 約束。
-- 同一間教室，會占用教室的預約（approved / checked_out）時段不能重疊。
-- 時段是半開區間 [starts_at, ends_at)，剛好接在一起不算重疊。
-- 違反時 Postgres 回傳錯誤碼 23P01 (exclusion_violation)。
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('approved', 'checked_out'));
