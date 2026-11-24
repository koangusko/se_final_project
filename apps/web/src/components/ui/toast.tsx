/**
 * 提示訊息（Base UI Toast）。任何地方都能呼叫：
 *   toast.success("已送出預約");
 *   toast.error(err);   // 可以直接丟 ApiError
 */
import { Toast } from "@base-ui/react/toast";
import type { ReactNode } from "react";
import { errorMessage } from "../../lib/api.ts";
import { cn } from "../../lib/cn.ts";

const manager = Toast.createToastManager();

export const toast = {
  success: (title: string, description?: string) =>
    manager.add({ title, ...(description ? { description } : {}), type: "success" }),
  error: (err: unknown, title = "操作失敗") =>
    manager.add({ title, description: errorMessage(err), type: "error" }),
  info: (title: string, description?: string) =>
    manager.add({ title, ...(description ? { description } : {}), type: "info" }),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={manager} timeout={4000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 left-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-96">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root
      key={t.id}
      toast={t}
      className={cn(
        "rounded-xl border bg-surface p-3 shadow-lg transition-all data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0",
        t.type === "error"
          ? "border-danger/40"
          : t.type === "success"
            ? "border-success/40"
            : "border-line",
      )}
    >
      <Toast.Content className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Toast.Title
            className={cn(
              "text-sm font-semibold",
              t.type === "error" && "text-danger",
              t.type === "success" && "text-success",
            )}
          />
          <Toast.Description className="mt-0.5 text-sm text-ink-muted" />
        </div>
        <Toast.Close className="text-sm text-ink-faint hover:text-ink" aria-label="關閉">
          關閉
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}
