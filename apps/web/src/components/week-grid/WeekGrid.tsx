/**
 * 週曆格子（預約的教室週狀態、排課的週曆都用這個）。
 *
 *   <WeekGrid
 *     weekStart="2026-11-23"
 *     events={[{ id, start, end, title, tone: "course", draggable: true }]}
 *     onEventMove={(id, start, end) => ...}   // 有傳才能拖拉
 *     onSlotClick={(start) => ...}            // 點空白處
 *     onEventClick={(id) => ...}
 *   />
 *
 * 拖拉用 @dnd-kit/core v6（不是 @dnd-kit/react）。垂直方向對齊 stepMinutes，水平方向放到哪一天就是哪一天。
 *
 * 手機（640px 以下）自動切成單日檢視：上方有星期切換，一次顯示一天。
 * 觸控拖拉要長按 0.25 秒才開始，避免和捲動衝突；手機上只能在同一天內上下移動，換天請用編輯表單。
 */
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import {
  addDays,
  formatTimeRange,
  minutesToTime,
  taipeiParts,
  todayInTaipei,
  toInstant,
  weekdayLabel,
  type DateStr,
} from "@class/shared/time";
import { cn } from "../../lib/cn.ts";
import { PHONE_QUERY, useMediaQuery } from "../../lib/use-media-query.ts";
import { movedInterval, placeEvents, type PlacedEvent } from "./layout.ts";

export type EventTone = "course" | "booking" | "pending" | "conflict" | "muted";

export interface WeekGridEvent {
  id: string;
  start: Date;
  end: Date;
  title: string;
  subtitle?: string;
  tone?: EventTone;
  draggable?: boolean;
}

export interface WeekGridProps {
  weekStart: DateStr;
  events: WeekGridEvent[];
  /** 顯示的時段，預設 07:00–22:00 */
  dayStart?: string;
  dayEnd?: string;
  /** 拖拉對齊的分鐘數，預設 10 */
  stepMinutes?: number;
  /** 點空白格時對齊的分鐘數，預設 30 */
  clickStepMinutes?: number;
  /** 每小時高度（px），預設 48 */
  hourHeight?: number;
  days?: number;
  onEventMove?: (id: string, start: Date, end: Date) => void;
  onEventClick?: (id: string) => void;
  onSlotClick?: (start: Date) => void;
}

const toneClass: Record<EventTone, string> = {
  course: "bg-event-course/12 border-event-course text-event-course",
  booking: "bg-event-booking/12 border-event-booking text-event-booking",
  pending: "bg-event-pending/10 border-event-pending text-event-pending border-dashed",
  conflict: "bg-event-conflict/12 border-event-conflict text-event-conflict",
  muted: "bg-event-muted/10 border-event-muted text-ink-muted",
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function WeekGrid({
  weekStart,
  events,
  dayStart = "07:00",
  dayEnd = "22:00",
  stepMinutes = 10,
  clickStepMinutes = 30,
  hourHeight = 48,
  days = 7,
  onEventMove,
  onEventClick,
  onSlotClick,
}: WeekGridProps) {
  const startMin = toMinutes(dayStart);
  const endMin = toMinutes(dayEnd);
  const pxPerMin = hourHeight / 60;
  const stepPx = stepMinutes * pxPerMin;
  const height = (endMin - startMin) * pxPerMin;
  const today = todayInTaipei();

  const placed = useMemo(
    () => placeEvents(events, weekStart, startMin, endMin, days),
    [events, weekStart, startMin, endMin, days],
  );

  const isPhone = useMediaQuery(PHONE_QUERY);
  const todayIndex = Math.max(
    0,
    Array.from({ length: days }, (_, i) => addDays(weekStart, i)).indexOf(today),
  );
  const [pickedDay, setPickedDay] = useState<{ week: string; index: number } | null>(null);
  const selectedDay = pickedDay?.week === weekStart ? pickedDay.index : todayIndex;
  const visibleDays = isPhone ? [selectedDay] : Array.from({ length: days }, (_, i) => i);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const snapY: Modifier = ({ transform }) => ({
    ...transform,
    y: Math.round(transform.y / stepPx) * stepPx,
  });

  function handleDragEnd(e: DragEndEvent) {
    if (!onEventMove) return;
    const item = placed.find((p) => p.event.id === e.active.id);
    if (!item) return;
    const overDay =
      typeof e.over?.id === "string" && e.over.id.startsWith("day-")
        ? Number(e.over.id.slice(4))
        : item.dayIndex;
    const deltaMinutes = Math.round(e.delta.y / stepPx) * stepMinutes;
    if (overDay === item.dayIndex && deltaMinutes === 0) return;
    const next = movedInterval(item.event, weekStart, overDay, deltaMinutes, startMin, endMin);
    onEventMove(item.event.id, next.start, next.end);
  }

  const hours: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) hours.push(m);

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      {isPhone && (
        <div className="grid grid-cols-7 gap-1 border-b border-line p-1.5">
          {Array.from({ length: days }, (_, i) => {
            const date = addDays(weekStart, i);
            const count = placed.filter((p) => p.dayIndex === i).length;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setPickedDay({ week: weekStart, index: i })}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-lg text-xs",
                  i === selectedDay ? "bg-accent text-accent-ink" : "text-ink-muted",
                  i !== selectedDay && date === today && "text-accent",
                )}
              >
                <span className="font-medium">{weekdayLabel(i + 1)}</span>
                <span>{Number(date.slice(8, 10))}</span>
                <span
                  className={cn(
                    "mt-0.5 size-1 rounded-full",
                    count > 0
                      ? i === selectedDay
                        ? "bg-accent-ink"
                        : "bg-accent"
                      : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
      <div className={isPhone ? "" : "min-w-[720px]"}>
        <div
          className={cn(
            "sticky top-0 z-10 grid border-b border-line bg-surface",
            isPhone && "hidden",
          )}
          style={{ gridTemplateColumns: `3.5rem repeat(${visibleDays.length}, 1fr)` }}
        >
          <div />
          {visibleDays.map((i) => {
            const date = addDays(weekStart, i);
            const isToday = date === today;
            return (
              <div
                key={date}
                className={cn("px-2 py-2 text-center text-sm", isToday && "text-accent")}
              >
                <div className="font-medium">週{weekdayLabel(i + 1)}</div>
                <div className={cn("text-xs", isToday ? "font-semibold" : "text-ink-muted")}>
                  {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
                </div>
              </div>
            );
          })}
        </div>

        <DndContext sensors={sensors} modifiers={[snapY]} onDragEnd={handleDragEnd}>
          <div
            className="relative grid"
            style={{ gridTemplateColumns: `3.5rem repeat(${visibleDays.length}, 1fr)`, height }}
          >
            <div className="relative border-r border-line">
              {hours.map((m) => (
                <div
                  key={m}
                  className={cn(
                    "absolute right-1.5 text-[11px] text-ink-faint",
                    m === startMin ? "translate-y-0.5" : "-translate-y-1/2",
                  )}
                  style={{ top: (m - startMin) * pxPerMin }}
                >
                  {minutesToTime(m)}
                </div>
              ))}
            </div>
            {visibleDays.map((i) => (
              <DayColumn
                key={i}
                index={i}
                hours={hours}
                startMin={startMin}
                pxPerMin={pxPerMin}
                {...(onSlotClick
                  ? {
                      onClick: (e: MouseEvent<HTMLDivElement>) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const minute =
                          startMin +
                          Math.floor((e.clientY - rect.top) / pxPerMin / clickStepMinutes) *
                            clickStepMinutes;
                        onSlotClick(toInstant(addDays(weekStart, i), minutesToTime(minute)));
                      },
                    }
                  : {})}
              >
                {placed
                  .filter((p) => p.dayIndex === i)
                  .map((p) => (
                    <EventBlock
                      key={p.event.id}
                      placed={p}
                      startMin={startMin}
                      pxPerMin={pxPerMin}
                      draggable={Boolean(onEventMove && p.event.draggable)}
                      {...(onEventClick ? { onClick: () => onEventClick(p.event.id) } : {})}
                    />
                  ))}
              </DayColumn>
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

function DayColumn({
  index,
  hours,
  startMin,
  pxPerMin,
  onClick,
  children,
}: {
  index: number;
  hours: number[];
  startMin: number;
  pxPerMin: number;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${index}` });
  return (
    // 點空白格是滑鼠捷徑；鍵盤使用者用表單建立，所以這裡不提供鍵盤操作
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "relative border-r border-line last:border-r-0",
        isOver && "bg-accent-soft/40",
        onClick && "cursor-pointer",
      )}
    >
      {hours.map((m) => (
        <div
          key={m}
          className="pointer-events-none absolute inset-x-0 border-t border-line/70"
          style={{ top: (m - startMin) * pxPerMin }}
        />
      ))}
      {children}
    </div>
  );
}

function EventBlock({
  placed,
  startMin,
  pxPerMin,
  draggable,
  onClick,
}: {
  placed: PlacedEvent<WeekGridEvent>;
  startMin: number;
  pxPerMin: number;
  draggable: boolean;
  onClick?: () => void;
}) {
  const { event, lane, lanes } = placed;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !draggable,
  });
  const style: CSSProperties = {
    top: (placed.startMinute - startMin) * pxPerMin,
    height: Math.max((placed.endMinute - placed.startMinute) * pxPerMin, 18),
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`,
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
  };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`${event.title} ${formatTimeRange(event.start, event.end)}`}
      className={cn(
        "absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs leading-tight",
        toneClass[event.tone ?? "booking"],
        draggable && "cursor-grab touch-manipulation select-none active:cursor-grabbing",
        isDragging && "z-20 opacity-80 shadow-lg",
        !draggable && !onClick && "cursor-default",
      )}
    >
      <span className="block truncate font-medium">{event.title}</span>
      <span className="block truncate opacity-80">
        {isDragging ? "拖曳中" : `${taipeiParts(event.start).time}–${taipeiParts(event.end).time}`}
      </span>
      {event.subtitle && <span className="block truncate opacity-70">{event.subtitle}</span>}
    </button>
  );
}
