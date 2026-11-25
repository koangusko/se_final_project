/** 預約審核與借還（B6、B7）：頁籤待審核、待借出、借出中、全部。 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import type { BookingDto, ReviewBookingInput } from "@class/shared/booking";
import { overlaps, taipeiParts, todayInTaipei } from "@class/shared/time";
import {
  Button,
  ButtonLink,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  fieldErrors,
  LoadingBlock,
  PageHeader,
  Textarea,
  toast,
} from "../../../components/ui/index.ts";
import { api, ApiError, errorMessage, unwrap } from "../../../lib/api.ts";
import { requireRole } from "../../../lib/auth.ts";
import {
  BookingStatusBadge,
  bookingWhen,
  itemsText,
  roomLabel,
} from "../../../modules/booking/parts.tsx";
import { adminBookingsQuery, bookingKeys } from "../../../modules/booking/queries.ts";
import { TabBar } from "../../../modules/booking/TabBar.tsx";

const TABS = [
  { value: "pending", label: "待審核" },
  { value: "approved", label: "待借出" },
  { value: "checked_out", label: "借出中" },
  { value: "all", label: "全部" },
] as const;
type TabValue = (typeof TABS)[number]["value"];

export const Route = createFileRoute("/booking/admin/")({
  validateSearch: z.object({
    tab: z.enum(["pending", "approved", "checked_out", "all"]).optional().catch(undefined),
  }),
  beforeLoad: requireRole(["admin"]),
  component: AdminBookingsPage,
});

function AdminBookingsPage() {
  const tab: TabValue = Route.useSearch().tab ?? "pending";
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useQuery(adminBookingsQuery(tab === "all" ? undefined : tab));
  // 待審核的數量顯示在頁籤上，審核時也用來找同時段的其他申請
  const pending = useQuery(adminBookingsQuery("pending"));
  const [reviewing, setReviewing] = useState<BookingDto | null>(null);
  const today = todayInTaipei();
  const label = TABS.find((t) => t.value === tab)?.label ?? "";

  return (
    <div>
      <PageHeader
        title="預約審核與借還"
        description="審核預約申請；借用人來領鑰匙或設備時按「借出」，歸還時按「歸還」。"
        actions={
          <ButtonLink to="/booking/admin/items" variant="secondary">
            物品管理
          </ButtonLink>
        }
      />
      <TabBar
        label="預約狀態"
        tabs={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: t.value === "pending" ? (pending.data?.length ?? 0) : 0,
        }))}
        value={tab}
        onChange={(t) => void navigate({ search: t === "pending" ? {} : { tab: t } })}
      />

      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title={tab === "all" ? "還沒有預約" : `沒有${label}的預約`} />
      ) : (
        <DataTable
          rows={list.data}
          rowKey={(b) => b.id}
          columns={[
            { header: "教室", mobile: "title", cell: (b) => roomLabel(b.room) },
            {
              header: "時間",
              mobile: "subtitle",
              className: "whitespace-nowrap",
              cell: (b) => (
                <>
                  {bookingWhen(b)}
                  {taipeiParts(b.startsAt).date === today && (
                    <span className="ml-1 text-xs font-medium text-accent">今天</span>
                  )}
                </>
              ),
            },
            {
              header: "狀態",
              mobile: "badge",
              cell: (b) => <BookingStatusBadge status={b.status} />,
            },
            { header: "借用人", cell: (b) => b.user.name },
            { header: "用途", cell: (b) => b.purpose, className: "max-w-48 truncate" },
            { header: "物品", cell: (b) => itemsText(b), className: "max-w-40" },
          ]}
          actions={(b) => (
            <>
              <ButtonLink
                to="/booking/$bookingId"
                params={{ bookingId: b.id }}
                size="sm"
                variant="ghost"
              >
                詳細
              </ButtonLink>
              {b.status === "pending" && (
                <Button size="sm" onClick={() => setReviewing(b)}>
                  審核
                </Button>
              )}
            </>
          )}
        />
      )}

      {reviewing && (
        <ReviewDialog
          booking={reviewing}
          others={(pending.data ?? []).filter(
            (o) =>
              o.id !== reviewing.id &&
              o.room.id === reviewing.room.id &&
              overlaps(
                { start: new Date(o.startsAt), end: new Date(o.endsAt) },
                { start: new Date(reviewing.startsAt), end: new Date(reviewing.endsAt) },
              ),
          )}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

function ReviewDialog({
  booking: b,
  others,
  onClose,
}: {
  booking: BookingDto;
  /** 同一間、時段重疊的其他待審核申請 */
  others: BookingDto[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const review = useMutation({
    mutationFn: (input: ReviewBookingInput) => {
      setFailure(undefined);
      return unwrap(
        api.booking.admin.bookings[":id"].review.$post({ param: { id: b.id }, json: input }),
      );
    },
    onSuccess: async (_, input) => {
      toast.success(input.decision === "approve" ? "已核准" : "已退件");
      await qc.invalidateQueries({ queryKey: bookingKeys.all });
      onClose();
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.code === "VALIDATION") {
        setError(fieldErrors(err.details).note ?? err.message);
        return;
      }
      // 顯示在對話框裡（手機上 toast 會蓋住按鈕）
      setFailure(errorMessage(err));
      // 狀態或占用變了：重新抓列表
      await qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
  const deciding = review.isPending ? review.variables.decision : null;
  const trimmed = note.trim();

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`審核：${roomLabel(b.room)}`}
      description={bookingWhen(b)}
      footer={
        <>
          <Button
            variant="secondary"
            loading={deciding === "reject"}
            disabled={review.isPending}
            onClick={() => {
              if (trimmed === "") {
                setError("退件請填寫原因");
                return;
              }
              review.mutate({ decision: "reject", note: trimmed });
            }}
          >
            退件
          </Button>
          <Button
            loading={deciding === "approve"}
            disabled={review.isPending}
            onClick={() =>
              review.mutate({ decision: "approve", ...(trimmed ? { note: trimmed } : {}) })
            }
          >
            核准
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-ink-muted">借用人</dt>
          <dd>{b.user.name}</dd>
          <dt className="text-ink-muted">用途</dt>
          <dd className="break-words">{b.purpose}</dd>
          <dt className="text-ink-muted">人數</dt>
          <dd>{b.attendeeCount ?? "—"}</dd>
          <dt className="text-ink-muted">物品</dt>
          <dd>{itemsText(b)}</dd>
        </dl>
        {others.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
            <p className="font-medium text-warning">同時段還有 {others.length} 筆待審核的申請</p>
            <ul className="mt-1 space-y-0.5 text-ink-muted">
              {others.map((o) => (
                <li key={o.id}>
                  {bookingWhen(o)}　{o.user.name}　{o.purpose}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-ink-muted">核准這筆之後，重疊的申請就不能再核准。</p>
          </div>
        )}
        {failure && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {failure}
          </p>
        )}
        <Field label="審核意見" hint="退件時必填，借用人會看到" error={error}>
          {(p) => (
            <Textarea
              {...p}
              className="min-h-20"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError(undefined);
              }}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
