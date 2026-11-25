/**
 * 解析 iNCNU 公開課表的資料（純函式，有單元測試 parse.test.ts）。
 *
 * 上課時間的寫法：「星期數字 + 節次字母」，多段以逗號分隔，例如 `1i,4bcd`
 * = 週一第 i 節、週四第 b–d 節。上課教室以逗號分隔，和時間段一一對應；
 * 只有一間教室時代表每段都在那間。
 */
export type PeriodCode =
  | "x"
  | "y"
  | "a"
  | "b"
  | "c"
  | "d"
  | "z"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m";

/** 暨大節次時間表（iNCNU 教室課表查詢） */
export const PERIODS: readonly { code: PeriodCode; start: string; end: string }[] = [
  { code: "x", start: "06:10", end: "07:00" },
  { code: "y", start: "07:10", end: "08:00" },
  { code: "a", start: "08:10", end: "09:00" },
  { code: "b", start: "09:10", end: "10:00" },
  { code: "c", start: "10:10", end: "11:00" },
  { code: "d", start: "11:10", end: "12:00" },
  { code: "z", start: "12:10", end: "13:00" },
  { code: "e", start: "13:30", end: "14:20" },
  { code: "f", start: "14:30", end: "15:20" },
  { code: "g", start: "15:30", end: "16:20" },
  { code: "h", start: "16:30", end: "17:20" },
  { code: "i", start: "17:30", end: "18:20" },
  { code: "j", start: "18:30", end: "19:20" },
  { code: "k", start: "19:30", end: "20:20" },
  { code: "l", start: "20:30", end: "21:20" },
  { code: "m", start: "21:30", end: "22:20" },
];

const ORDER = PERIODS.map((p) => p.code).join("");

export interface TimeBlock {
  /** 1 = 週一 … 7 = 週日 */
  weekday: number;
  start: string;
  end: string;
}

/** 一段時間（例如 `4bcd`）拆成連續節次的時間區塊；不連續的節次會分成多塊 */
export function parseSegment(segment: string): TimeBlock[] {
  const m = /^([1-7])([a-z]+)$/.exec(segment.trim());
  if (!m) throw new Error(`無法解析上課時間：${segment}`);
  const weekday = Number(m[1]);
  const idx = [...new Set(m[2]!.split(""))]
    .map((c) => {
      const i = ORDER.indexOf(c);
      if (i === -1) throw new Error(`未知的節次：${c}（${segment}）`);
      return i;
    })
    .toSorted((a, b) => a - b);
  const blocks: TimeBlock[] = [];
  let runStart = idx[0]!;
  let prev = idx[0]!;
  for (const i of [...idx.slice(1), -1]) {
    if (i === prev + 1) {
      prev = i;
      continue;
    }
    blocks.push({ weekday, start: PERIODS[runStart]!.start, end: PERIODS[prev]!.end });
    runStart = i;
    prev = i;
  }
  return blocks;
}

export function splitList(s: string): string[] {
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export interface IncnuRow {
  SemesterCourseID: string | number;
  CourseNo: string;
  SemesterCourseName: string;
  UnitName: string;
  DayfgClassTypeName: string;
  Grade: string | number;
  Choose: string;
  Credit: string | number;
  Teacher: string;
  SemCourseTime: string;
  ClassRoom: string;
  Memo: string;
}

export interface ImportBlock extends TimeBlock {
  roomCode: string;
}

export interface ImportCourse {
  externalId: string;
  code: string;
  name: string;
  teacherName: string | null;
  unitName: string;
  description: string;
  blocks: ImportBlock[];
}

/**
 * 原始資料 -> 要匯入的課程。
 * - 只保留 knownRooms 裡的教室時段（其他大樓的時段略過）。
 * - 合開課（時間、教室、教師、課名都相同的多筆）合併成一門。
 */
export function buildImport(
  rows: IncnuRow[],
  knownRooms: Set<string>,
): { courses: ImportCourse[]; warnings: string[] } {
  const warnings: string[] = [];
  const groups = new Map<string, IncnuRow[]>();
  for (const r of rows) {
    const key = [r.SemCourseTime, r.ClassRoom, r.Teacher, r.SemesterCourseName].join("|");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const courses: ImportCourse[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    const segments = splitList(first.SemCourseTime);
    const roomList = splitList(first.ClassRoom);
    if (segments.length === 0 || roomList.length === 0) continue;
    if (roomList.length !== 1 && roomList.length !== segments.length) {
      warnings.push(
        `${first.CourseNo} ${first.SemesterCourseName}：時間 ${segments.length} 段、教室 ${roomList.length} 間，對不上，略過`,
      );
      continue;
    }

    const blocks: ImportBlock[] = [];
    segments.forEach((seg, i) => {
      const roomCode = roomList.length === 1 ? roomList[0]! : roomList[i]!;
      if (!knownRooms.has(roomCode)) {
        if (roomCode.startsWith("管"))
          warnings.push(`${first.CourseNo}：教室 ${roomCode} 不在教室主檔`);
        return;
      }
      for (const b of parseSegment(seg)) blocks.push({ ...b, roomCode });
    });
    if (blocks.length === 0) continue;

    const units = [...new Set(group.map((r) => r.UnitName))];
    const meta = [
      units.join("、"),
      [first.DayfgClassTypeName, first.Grade ? `${first.Grade} 年級` : ""]
        .filter(Boolean)
        .join(" "),
      first.Choose,
      first.Credit !== "" ? `${first.Credit} 學分` : "",
    ].filter(Boolean);
    courses.push({
      externalId: group.map((r) => String(r.SemesterCourseID)).join("+"),
      code: first.CourseNo,
      name: first.SemesterCourseName,
      teacherName: first.Teacher || null,
      unitName: units.join("、"),
      description: [meta.join("｜"), first.Memo].filter(Boolean).join("\n"),
      blocks,
    });
  }
  return { courses, warnings };
}
