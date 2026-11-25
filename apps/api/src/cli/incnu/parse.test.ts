import { describe, expect, it } from "vitest";
import { buildImport, parseSegment, type IncnuRow } from "./parse.ts";

describe("parseSegment", () => {
  it("連續節次合成一塊", () => {
    expect(parseSegment("4bcd")).toEqual([{ weekday: 4, start: "09:10", end: "12:00" }]);
  });
  it("單一節次", () => {
    expect(parseSegment("1i")).toEqual([{ weekday: 1, start: "17:30", end: "18:20" }]);
  });
  it("跨午休 z 節仍算連續", () => {
    expect(parseSegment("2dze")).toEqual([{ weekday: 2, start: "11:10", end: "14:20" }]);
  });
  it("不連續的節次分成多塊", () => {
    expect(parseSegment("3bd")).toEqual([
      { weekday: 3, start: "09:10", end: "10:00" },
      { weekday: 3, start: "11:10", end: "12:00" },
    ]);
  });
  it("格式錯誤丟錯", () => {
    expect(() => parseSegment("8a")).toThrow("無法解析上課時間");
    expect(() => parseSegment("1q")).toThrow("未知的節次");
  });
});

const row = (o: Partial<IncnuRow>): IncnuRow => ({
  SemesterCourseID: 1,
  CourseNo: "100001",
  SemesterCourseName: "測試課",
  UnitName: "資訊管理學系",
  DayfgClassTypeName: "學士班",
  Grade: 1,
  Choose: "必修",
  Credit: 3,
  Teacher: "王老師",
  SemCourseTime: "2bcd",
  ClassRoom: "管212",
  Memo: "",
  ...o,
});

describe("buildImport", () => {
  const known = new Set(["管212", "管215", "管228", "管461", "管462"]);

  it("時段與教室一一對應", () => {
    const { courses } = buildImport(
      [row({ SemCourseTime: "1i,4bcd", ClassRoom: "管215,管228" })],
      known,
    );
    expect(courses[0]?.blocks).toEqual([
      { weekday: 1, start: "17:30", end: "18:20", roomCode: "管215" },
      { weekday: 4, start: "09:10", end: "12:00", roomCode: "管228" },
    ]);
  });

  it("只有一間教室時每段都在那間；同時段兩間教室各占一筆", () => {
    const one = buildImport([row({ SemCourseTime: "3bcd,4i", ClassRoom: "管212" })], known);
    expect(one.courses[0]?.blocks.map((b) => b.roomCode)).toEqual(["管212", "管212"]);
    const two = buildImport([row({ SemCourseTime: "2efg,2efg", ClassRoom: "管461,管462" })], known);
    expect(two.courses[0]?.blocks.map((b) => b.roomCode)).toEqual(["管461", "管462"]);
  });

  it("不在教室主檔的時段略過；全部略過的課不匯入", () => {
    const { courses } = buildImport(
      [
        row({ SemCourseTime: "1a,2b", ClassRoom: "管212,A100" }),
        row({ SemesterCourseID: 2, SemCourseTime: "1a", ClassRoom: "圖資027" }),
      ],
      known,
    );
    expect(courses).toHaveLength(1);
    expect(courses[0]?.blocks).toHaveLength(1);
  });

  it("合開課合併成一門", () => {
    const { courses } = buildImport(
      [
        row({ SemesterCourseID: 10, CourseNo: "110002", UnitName: "經濟學系" }),
        row({ SemesterCourseID: 11, CourseNo: "510008", UnitName: "管理學院學士班" }),
      ],
      known,
    );
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ externalId: "10+11", unitName: "經濟學系、管理學院學士班" });
  });
});
