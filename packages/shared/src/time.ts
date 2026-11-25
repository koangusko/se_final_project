/**
 * 時間工具。整個系統只用台北時間（UTC+8）。
 *
 * 台灣自 1979 年起沒有日光節約時間，所以固定 +08:00 是正確的，不需要時區資料庫。
 * 資料庫一律存 timestamptz（絕對時間點），畫面上的日期和時間一律用這裡的函式換算。
 * 不要在其他地方用 Date 的 getHours()/getDay()：那是瀏覽器或伺服器所在時區，不是台北。
 */
import { z } from "zod";

export const TZ_OFFSET = "+08:00";
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD'（台北日期） */
export type DateStr = string;
/** 'HH:mm'（台北時間，24 小時制） */
export type TimeStr = string;

export const DateStrSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式要是 YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00${TZ_OFFSET}`)), "日期不存在");

export const TimeStrSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時間格式要是 HH:mm");

/** 台北日期 + 時間 -> 絕對時間點 */
export function toInstant(date: DateStr, time: TimeStr): Date {
  return new Date(`${date}T${time}:00${TZ_OFFSET}`);
}

export interface TaipeiParts {
  date: DateStr;
  time: TimeStr;
  /** 1 = 週一 ... 7 = 週日 */
  weekday: number;
  /** 從當天 00:00 起算的分鐘數 */
  minuteOfDay: number;
}

/** 絕對時間點 -> 台北的日期、時間、星期 */
export function taipeiParts(instant: Date | string): TaipeiParts {
  const shifted = new Date(new Date(instant).getTime() + OFFSET_MS);
  const iso = shifted.toISOString();
  const day = shifted.getUTCDay();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    weekday: day === 0 ? 7 : day,
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function addDays(date: DateStr, days: number): DateStr {
  const t = Date.parse(`${date}T00:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

/** 該日期所在那週的週一 */
export function weekStartOf(date: DateStr): DateStr {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export function todayInTaipei(now: Date = new Date()): DateStr {
  return taipeiParts(now).date;
}

/** 一週的範圍：週一 00:00 到下週一 00:00（半開區間） */
export function weekRange(weekStart: DateStr): { start: Date; end: Date } {
  return { start: toInstant(weekStart, "00:00"), end: toInstant(addDays(weekStart, 7), "00:00") };
}

export interface Interval {
  start: Date;
  end: Date;
}

/** 半開區間 [start, end) 是否重疊。剛好接在一起（前一段結束 = 後一段開始）不算重疊。 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function timeToMinutes(time: TimeStr): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): TimeStr {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;

/** 1..7 -> 「一」..「日」 */
export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? "";
}

/** 例：11/24（一） 14:00 */
export function formatDateTime(instant: Date | string): string {
  const p = taipeiParts(instant);
  return `${formatDate(p.date)} ${p.time}`;
}

/** 例：11/24（一） */
export function formatDate(date: DateStr): string {
  const p = taipeiParts(toInstant(date, "12:00"));
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${weekdayLabel(p.weekday)}）`;
}

/** 例：14:00–16:00 */
export function formatTimeRange(start: Date | string, end: Date | string): string {
  return `${taipeiParts(start).time}–${taipeiParts(end).time}`;
}
