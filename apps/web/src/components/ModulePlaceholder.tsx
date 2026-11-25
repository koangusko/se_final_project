import { EmptyState, PageHeader } from "./ui/index.ts";

/** 模組頁面還沒實作時的佔位。實作時整個換掉。 */
export function ModulePlaceholder({ title, task }: { title: string; task: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState title="這個頁面還沒實作" description={`對應任務：${task}`} />
    </div>
  );
}
