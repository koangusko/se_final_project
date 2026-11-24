import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDate,
  overlaps,
  taipeiParts,
  toInstant,
  weekRange,
  weekStartOf,
} from "./time.ts";

describe("台北時間換算", () => {
  it("toInstant 以 +08:00 解讀", () => {
    expect(toInstant("2026-11-24", "09:00").toISOString()).toBe("2026-11-24T01:00:00.000Z");
  });

  it("taipeiParts 跨日正確", () => {
    const p = taipeiParts("2026-11-23T17:30:00.000Z");
    expect(p).toEqual({ date: "2026-11-24", time: "01:30", weekday: 2, minuteOfDay: 90 });
  });

  it("weekStartOf 回到週一，週日屬於前一週", () => {
    expect(weekStartOf("2026-11-24")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-29")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23");
  });

  it("addDays 跨月", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("weekRange 是週一 00:00 到下週一 00:00", () => {
    const r = weekRange("2026-11-23");
    expect(r.start.toISOString()).toBe("2026-11-22T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-29T16:00:00.000Z");
  });

  it("formatDate", () => {
    expect(formatDate("2026-11-24")).toBe("11/24（二）");
  });
});

const at = (t: string) => toInstant("2026-01-05", t);

describe("overlaps（半開區間）", () => {
  it("相接不算重疊", () => {
    expect(
      overlaps({ start: at("10:00"), end: at("12:00") }, { start: at("12:00"), end: at("13:00") }),
    ).toBe(false);
  });
  it("部分重疊", () => {
    expect(
      overlaps({ start: at("10:00"), end: at("12:00") }, { start: at("11:59"), end: at("13:00") }),
    ).toBe(true);
  });
  it("包含", () => {
    expect(
      overlaps({ start: at("10:00"), end: at("12:00") }, { start: at("10:30"), end: at("11:00") }),
    ).toBe(true);
  });
});
