/**
 * 資料列表：電腦上是表格，手機上（md 以下）自動變成卡片。列表一律用這個，不要直接用 <table>。
 *
 *   <DataTable
 *     rows={bookings}
 *     rowKey={(b) => b.id}
 *     columns={[
 *       { header: "教室", cell: (b) => b.room.code, mobile: "title" },
 *       { header: "時間", cell: (b) => bookingWhen(b), mobile: "subtitle" },
 *       { header: "狀態", cell: (b) => <Badge>...</Badge>, mobile: "badge" },
 *       { header: "用途", cell: (b) => b.purpose },               // 手機上顯示成「用途：...」
 *       { header: "建立時間", cell: (b) => ..., mobile: "hide" },   // 手機上不顯示
 *     ]}
 *     actions={(b) => <Button size="sm">審核</Button>}
 *     onRowClick={(b) => navigate(...)}                          // 選填
 *   />
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** 手機卡片上的位置。預設 "meta"（顯示成「欄名：值」） */
  mobile?: "title" | "subtitle" | "badge" | "meta" | "hide";
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  actions,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const by = (slot: NonNullable<Column<T>["mobile"]>) =>
    columns.filter((c) => (c.mobile ?? "meta") === slot);
  const title = by("title");
  const subtitle = by("subtitle");
  const badge = by("badge");
  const meta = by("meta");

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-ink-muted">
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th key={c.header} className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {c.header}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-2.5">
                  <span className="sr-only">操作</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line last:border-0",
                  onRowClick && "cursor-pointer hover:bg-surface-muted/60",
                )}
              >
                {columns.map((c) => (
                  <td key={c.header} className={cn("px-4 py-3", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {actions && (
                  // 操作按鈕不觸發整列點擊
                  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1 whitespace-nowrap">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-card border border-line bg-surface">
            {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 卡片內的連結或按鈕才是主要操作 */}
            <div
              className={cn("space-y-1.5 p-4", onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {title.map((c) => (
                    <div key={c.header} className="font-medium">
                      {c.cell(row)}
                    </div>
                  ))}
                  {subtitle.map((c) => (
                    <div key={c.header} className="text-sm text-ink-muted">
                      {c.cell(row)}
                    </div>
                  ))}
                </div>
                {badge.length > 0 && (
                  <div className="flex shrink-0 gap-1">
                    {badge.map((c) => (
                      <span key={c.header}>{c.cell(row)}</span>
                    ))}
                  </div>
                )}
              </div>
              {meta.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {meta.map((c) => (
                    <div key={c.header} className="contents">
                      <dt className="text-ink-muted">{c.header}</dt>
                      <dd className="min-w-0 break-words">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-2.5">
                {actions(row)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
