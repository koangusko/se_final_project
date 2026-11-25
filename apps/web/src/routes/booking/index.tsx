/** 我的預約（B5）：依狀態分頁籤，點一筆看詳細。 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BOOKING_STATUS_LABELS, BOOKING_STATUSES, type BookingStatus } from "@class/shared/booking";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/index.ts";
import { requireApproved } from "../../lib/auth.ts";
import {
  BookingStatusBadge,
  bookingWhen,
  itemsText,
  roomLabel,
} from "../../modules/booking/parts.tsx";
import { myBookingsQuery } from "../../modules/booking/queries.ts";
import { TabBar } from "../../modules/booking/TabBar.tsx";

const TAB_VALUES = ["all", ...BOOKING_STATUSES] as const;
type TabValue = (typeof TAB_VALUES)[number];

export const Route = createFileRoute("/booking/")({
  validateSearch: z.object({ tab: z.enum(TAB_VALUES).optional().catch(undefined) }),
  beforeLoad: requireApproved,
  component: MyBookingsPage,
});

/** 頁籤順序：依流程 */
const TAB_ORDER: BookingStatus[] = [
  "pending",
  "approved",
  "checked_out",
  "returned",
  "rejected",
  "cancelled",
];

function MyBookingsPage() {
  const tab = Route.useSearch().tab ?? "all";
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useQuery(myBookingsQuery);

  const all = list.data ?? [];
  const rows = tab === "all" ? all : all.filter((b) => b.status === tab);
  const tabs = [
    { value: "all" as TabValue, label: "全部" },
    ...TAB_ORDER.map((s) => ({
      value: s as TabValue,
      label: BOOKING_STATUS_LABELS[s],
      count: all.filter((b) => b.status === s).length,
    })),
  ];
  const newButton = <ButtonLink to="/booking/new">新增預約</ButtonLink>;

  return (
    <div>
      <PageHeader
        title="我的預約"
        description="預約教室與借用鑰匙、投影筆、筆電，送出後由管理員審核。"
        actions={newButton}
      />
      <TabBar
        label="預約狀態"
        tabs={tabs}
        value={tab}
        onChange={(t) => void navigate({ search: t === "all" ? {} : { tab: t } })}
      />
      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === "all" ? "還沒有預約紀錄" : `沒有${BOOKING_STATUS_LABELS[tab]}的預約`}
          {...(tab === "all" ? { action: newButton } : {})}
        />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(b) => b.id}
          onRowClick={(b) =>
            void navigate({ to: "/booking/$bookingId", params: { bookingId: b.id } })
          }
          columns={[
            { header: "教室", mobile: "title", cell: (b) => roomLabel(b.room) },
            { header: "時間", mobile: "subtitle", cell: (b) => bookingWhen(b) },
            {
              header: "狀態",
              mobile: "badge",
              cell: (b) => <BookingStatusBadge status={b.status} />,
            },
            { header: "用途", cell: (b) => b.purpose, className: "max-w-60 truncate" },
            { header: "物品", cell: (b) => itemsText(b) },
          ]}
        />
      )}
    </div>
  );
}
