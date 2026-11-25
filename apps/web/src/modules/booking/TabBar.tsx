/**
 * 頁籤列。狀態放在網址參數 tab，由頁面傳 value / onChange 進來。
 * 頁籤多時在自己的區塊內左右捲動，不會讓整頁出現左右捲軸。
 */
import { cn } from "../../lib/cn.ts";

export interface Tab<T extends string> {
  value: T;
  label: string;
  /** 顯示在標籤後面的數量；0 或省略就不顯示 */
  count?: number;
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 給螢幕閱讀器的名稱 */
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap sm:min-h-9",
              selected
                ? "bg-accent-soft font-medium text-accent"
                : "text-ink-muted hover:bg-surface-muted",
            )}
          >
            {t.label}
            {t.count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  selected ? "bg-accent text-accent-ink" : "bg-surface-muted",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
