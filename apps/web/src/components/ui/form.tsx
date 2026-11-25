/**
 * 表單元件。日期和時間一律用原生 <input type="date"> / <input type="time">，
 * 手機上會跳出系統內建的選擇器，不要另外裝日期套件。
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn.ts";

// 手機上字級 16px：iOS Safari 對小於 16px 的輸入框會在聚焦時自動放大整頁
const control =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink sm:text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-surface-muted aria-invalid:border-danger";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  /** 傳入 render 函式以取得 id，用來綁 label */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  const describedBy = error || hint ? msgId : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {(error || hint) && (
        <p id={msgId} className={cn("text-xs", error ? "text-danger" : "text-ink-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11 sm:h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-11 pr-8 sm:h-10", className)} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex min-h-11 items-center gap-2 text-sm sm:min-h-0", className)}>
      <input type="checkbox" className="size-5 accent-accent sm:size-4" {...props} />
      {label}
    </label>
  );
}

/** 從 ApiError.details（VALIDATION）取出欄位錯誤 */
export function fieldErrors(details: unknown): Record<string, string> {
  if (typeof details !== "object" || details === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(details)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * 欄位驗證錯誤顯示後，把第一個有錯的欄位捲進畫面（送出按鈕常在表單底部，錯誤在畫面外）。
 *   onError: (err) => { setErrors(fieldErrors(err.details)); revealFirstError(formRef.current); }
 */
export function revealFirstError(root: HTMLElement | null | undefined) {
  requestAnimationFrame(() =>
    root
      ?.querySelector('[aria-invalid="true"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
}
