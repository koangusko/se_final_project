/** 預約詳細（B5）：教室、時間、用途、人數、物品、審核意見、歷程。取消在 B8。 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatDateTime } from "@class/shared/time";
import {
  ButtonLink,
  Card,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/index.ts";
import { ApiError } from "../../lib/api.ts";
import { requireApproved, useMe } from "../../lib/auth.ts";
import {
  BookingStatusBadge,
  bookingWhen,
  EventTimeline,
  itemsText,
  roomLabel,
} from "../../modules/booking/parts.tsx";
import { bookingDetailQuery } from "../../modules/booking/queries.ts";

export const Route = createFileRoute("/booking/$bookingId")({
  beforeLoad: requireApproved,
  component: BookingDetailPage,
});

function BookingDetailPage() {
  const { bookingId } = Route.useParams();
  const me = useMe();
  const detail = useQuery(bookingDetailQuery(bookingId));

  if (detail.isPending) return <LoadingBlock />;
  if (detail.isError) {
    return (
      <div className="space-y-4">
        {detail.error instanceof ApiError && detail.error.code === "NOT_FOUND" ? (
          <ErrorBlock error={detail.error} />
        ) : (
          <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} />
        )}
        <ButtonLink to="/booking" variant="secondary">
          回我的預約
        </ButtonLink>
      </div>
    );
  }
  const b = detail.data;
  // 管理員看別人的預約時，回到審核頁
  const isMine = me?.id === b.user.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={roomLabel(b.room)}
        description={bookingWhen(b)}
        actions={
          isMine ? (
            <ButtonLink to="/booking" variant="secondary">
              回我的預約
            </ButtonLink>
          ) : (
            <ButtonLink to="/booking/admin" variant="secondary">
              回預約審核
            </ButtonLink>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-[3fr_2fr] md:items-start">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <BookingStatusBadge status={b.status} />
            {b.status === "pending" && (
              <span className="text-sm text-ink-muted">等待管理員審核</span>
            )}
          </div>
          <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
            <Row label="借用人">{b.user.name}</Row>
            <Row label="用途">{b.purpose}</Row>
            <Row label="人數">{b.attendeeCount ?? "—"}</Row>
            <Row label="借用物品">{itemsText(b)}</Row>
            <Row label="申請時間">{formatDateTime(b.createdAt)}</Row>
            {b.reviewedAt && <Row label="審核時間">{formatDateTime(b.reviewedAt)}</Row>}
            {b.reviewNote && <Row label="審核意見">{b.reviewNote}</Row>}
            {b.checkedOutAt && <Row label="借出時間">{formatDateTime(b.checkedOutAt)}</Row>}
            {b.returnedAt && <Row label="歸還時間">{formatDateTime(b.returnedAt)}</Row>}
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">歷程</h2>
          <EventTimeline events={b.events} />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}
