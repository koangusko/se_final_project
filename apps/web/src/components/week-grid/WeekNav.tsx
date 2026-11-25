import { addDays, formatDate, todayInTaipei, weekStartOf, type DateStr } from "@class/shared/time";
import { Button } from "../ui/index.ts";

/** 上一週 / 本週 / 下一週 */
export function WeekNav({
  weekStart,
  onChange,
}: {
  weekStart: DateStr;
  onChange: (w: DateStr) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => onChange(addDays(weekStart, -7))}>
        上一週
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onChange(weekStartOf(todayInTaipei()))}>
        本週
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onChange(addDays(weekStart, 7))}>
        下一週
      </Button>
      <span className="text-sm text-ink-muted">
        {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
      </span>
    </div>
  );
}
