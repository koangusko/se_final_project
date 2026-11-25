import { useEffect, useRef, type ReactNode } from "react";
import { errorMessage } from "../../lib/api.ts";
import { cn } from "../../lib/cn.ts";

export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-r-transparent",
        size === "sm" ? "size-3.5" : "size-5",
      )}
    />
  );
}

export function LoadingBlock({ label = "載入中" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 underline underline-offset-2">
          重試
        </button>
      )}
    </div>
  );
}

/**
 * 操作失敗時，在出錯的位置顯示紅字（對話框裡、按鈕旁、列表上方），出現時自動捲進畫面。
 * 不要用彈出提示。error 是 null / undefined 時不顯示。
 *   <InlineError error={mutation.error} />
 */
export function InlineError({ error }: { error: unknown }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // 每次新的失敗都是新的 error 物件，同樣的訊息再出現一次也會捲過去
  useEffect(() => {
    if (error) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);
  if (!error) return null;
  const message = errorMessage(error);
  return (
    <p
      ref={ref}
      role="alert"
      className="scroll-my-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
