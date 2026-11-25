/**
 * 週曆的純計算（沒有 React），有單元測試：layout.test.ts。
 */
import { addDays, minutesToTime, taipeiParts, toInstant, type DateStr } from "@class/shared/time";

export interface GridEventInput {
  id: string;
  start: Date;
  end: Date;
}

export interface PlacedEvent<E extends GridEventInput> {
  event: E;
  /** 0 = 週一 */
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  /** 同時段重疊的事件並排顯示：第幾欄、共幾欄 */
  lane: number;
  lanes: number;
}

/** 把事件放進週曆格子；不在這週或不在顯示時段內的事件會被略過或截斷 */
export function placeEvents<E extends GridEventInput>(
  events: E[],
  weekStart: DateStr,
  dayStartMinute: number,
  dayEndMinute: number,
  days = 7,
): PlacedEvent<E>[] {
  const placed: PlacedEvent<E>[] = [];
  for (const event of events) {
    const s = taipeiParts(event.start);
    const e = taipeiParts(event.end);
    const dayIndex = dayDiff(weekStart, s.date);
    if (dayIndex < 0 || dayIndex >= days) continue;
    const endMinute = e.date === s.date ? e.minuteOfDay : 24 * 60;
    const startMinute = Math.max(s.minuteOfDay, dayStartMinute);
    const clippedEnd = Math.min(endMinute, dayEndMinute);
    if (clippedEnd <= startMinute) continue;
    placed.push({ event, dayIndex, startMinute, endMinute: clippedEnd, lane: 0, lanes: 1 });
  }
  assignLanes(placed);
  return placed;
}

function dayDiff(from: DateStr, to: DateStr): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 同一天互相重疊的事件分組，組內每個事件分配一欄 */
function assignLanes<E extends GridEventInput>(placed: PlacedEvent<E>[]) {
  const byDay = new Map<number, PlacedEvent<E>[]>();
  for (const p of placed) {
    const list = byDay.get(p.dayIndex) ?? [];
    list.push(p);
    byDay.set(p.dayIndex, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
    let cluster: PlacedEvent<E>[] = [];
    let clusterEnd = -1;
    const flush = () => {
      const laneEnds: number[] = [];
      for (const p of cluster) {
        let lane = laneEnds.findIndex((end) => end <= p.startMinute);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(p.endMinute);
        } else {
          laneEnds[lane] = p.endMinute;
        }
        p.lane = lane;
      }
      for (const p of cluster) p.lanes = laneEnds.length;
      cluster = [];
    };
    for (const p of list) {
      if (cluster.length > 0 && p.startMinute >= clusterEnd) flush();
      cluster.push(p);
      clusterEnd = Math.max(clusterEnd, p.endMinute);
    }
    if (cluster.length > 0) flush();
  }
}

/**
 * 拖拉結束後算出新時間：dayIndex 是放下的那一天，deltaMinutes 是垂直移動的分鐘數
 * （呼叫端已經對齊到 step）。保持原本的長度，並限制在顯示時段內。
 */
export function movedInterval(
  original: { start: Date; end: Date },
  weekStart: DateStr,
  dayIndex: number,
  deltaMinutes: number,
  dayStartMinute: number,
  dayEndMinute: number,
): { start: Date; end: Date } {
  const duration = Math.round((original.end.getTime() - original.start.getTime()) / 60_000);
  const startMinute = taipeiParts(original.start).minuteOfDay + deltaMinutes;
  const clamped = Math.min(Math.max(startMinute, dayStartMinute), dayEndMinute - duration);
  const date = addDays(weekStart, dayIndex);
  const start = toInstant(date, minutesToTime(clamped));
  return { start, end: new Date(start.getTime() + duration * 60_000) };
}
