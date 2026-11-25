/**
 * 對話框（Base UI Dialog）。用法：
 *   <Dialog open={open} onOpenChange={setOpen} title="核准預約">...內容...</Dialog>
 * 需要確認的危險動作用 ConfirmDialog（失敗時把 mutation.error 傳給 error，錯誤顯示在對話框裡）：
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title="取消這筆預約？"
 *     confirmLabel="取消預約" cancelLabel="返回" danger onConfirm={...} />
 * 確認按鈕本身含「取消」兩個字時，用 cancelLabel 把關閉按鈕改成「返回」，免得兩個按鈕都叫取消。
 */
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Button } from "./button.tsx";
import { InlineError } from "./feedback.tsx";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <BaseDialog.Popup className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl transition-all data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 sm:max-w-lg sm:rounded-2xl">
            <BaseDialog.Title className="text-lg font-semibold">{title}</BaseDialog.Title>
            {description && (
              <BaseDialog.Description className="mt-1 text-sm text-ink-muted">
                {description}
              </BaseDialog.Description>
            )}
            {children && <div className="mt-4">{children}</div>}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "確定",
  cancelLabel = "取消",
  danger = false,
  loading = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** 關閉按鈕的文字，預設「取消」 */
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  /** 確認後失敗的錯誤，顯示在對話框裡（對話框不關） */
  error?: unknown;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      {...(error ? { children: <InlineError error={error} /> } : {})}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
