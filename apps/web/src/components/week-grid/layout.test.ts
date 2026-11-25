import { describe, expect, it } from "vitest";
import { toInstant } from "@class/shared/time";
import { movedInterval, placeEvents } from "./layout.ts";

const ev = (id: string, date: string, s: string, e: string) => ({
  id,
  start: toInstant(date, s),
  end: toInstant(date, e),
});

describe("placeEvents", () => {
  it("算出星期與分鐘", () => {
    const [p] = placeEvents([ev("a", "2026-11-25", "09:10", "12:00")], "2026-11-23", 420, 1320);
    expect(p).toMatchObject({ dayIndex: 2, startMinute: 550, endMinute: 720, lane: 0, lanes: 1 });
  });

  it("不在這週的事件略過", () => {
    expect(placeEvents([ev("a", "2026-11-30", "09:00", "10:00")], "2026-11-23", 420, 1320)).toEqual(
      [],
    );
  });

  it("重疊事件分欄，不重疊的不受影響", () => {
    const placed = placeEvents(
      [
        ev("a", "2026-11-23", "09:00", "11:00"),
        ev("b", "2026-11-23", "10:00", "12:00"),
        ev("c", "2026-11-23", "13:00", "14:00"),
      ],
      "2026-11-23",
      420,
      1320,
    );
    const byId = Object.fromEntries(placed.map((p) => [p.event.id, p]));
    expect([byId.a?.lane, byId.a?.lanes]).toEqual([0, 2]);
    expect([byId.b?.lane, byId.b?.lanes]).toEqual([1, 2]);
    expect([byId.c?.lane, byId.c?.lanes]).toEqual([0, 1]);
  });
});

describe("movedInterval", () => {
  it("換天並保持長度", () => {
    const r = movedInterval(
      ev("a", "2026-11-23", "09:00", "11:00"),
      "2026-11-23",
      3,
      30,
      420,
      1320,
    );
    expect(r.start.toISOString()).toBe(toInstant("2026-11-26", "09:30").toISOString());
    expect(r.end.toISOString()).toBe(toInstant("2026-11-26", "11:30").toISOString());
  });

  it("不會拖出顯示時段", () => {
    const r = movedInterval(
      ev("a", "2026-11-23", "20:00", "22:00"),
      "2026-11-23",
      0,
      120,
      420,
      1320,
    );
    expect(r.end.toISOString()).toBe(toInstant("2026-11-23", "22:00").toISOString());
  });
});
