/** 預約模組共用的顯示元件與格式化。 */
import {
  BOOKING_STATUS_LABELS,
  type BookingDto,
  type BookingEventAction,
  type BookingEventDto,
  type BookingStatus,
} from "@class/shared/booking";
import { formatDate, formatDateTime, formatTimeRange, taipeiParts } from "@class/shared/time";
import { Badge } from "../../components/ui/index.ts";

const STATUS_TONE: Record<
  BookingStatus,
  "warning" | "success" | "danger" | "neutral" | "info" | "accent"
> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  checked_out: "info",
  returned: "accent",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

/** 例：11/24（二） 14:00–16:00 */
export function bookingWhen(b: Pick<BookingDto, "startsAt" | "endsAt">) {
  return `${formatDate(taipeiParts(b.startsAt).date)} ${formatTimeRange(b.startsAt, b.endsAt)}`;
}

/** 例：管112 鑰匙、投影筆 ×2；沒借物品是「—」 */
export function itemsText(b: Pick<BookingDto, "items">) {
  if (b.items.length === 0) return "—";
  return b.items.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join("、");
}

/** 教室名稱已經含代碼時（管112教室）只顯示名稱 */
export function roomLabel(r: { code: string; name: string }) {
  return r.name.startsWith(r.code) ? r.name : `${r.code} ${r.name}`;
}

const ACTION_LABELS: Record<BookingEventAction, string> = {
  created: "送出申請",
  approved: "核准",
  rejected: "退件",
  cancelled: "取消",
  checked_out: "借出",
  returned: "歸還",
};

export function EventTimeline({ events }: { events: BookingEventDto[] }) {
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          <div className="min-w-0 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <span className="font-medium">{ACTION_LABELS[e.action]}</span>
              <span className="text-ink-muted">{e.actor.name}</span>
              <span className="text-ink-muted">{formatDateTime(e.at)}</span>
            </div>
            {e.note && <div className="mt-0.5 break-words text-ink-muted">{e.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
