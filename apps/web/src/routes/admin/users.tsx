import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import type { ReviewUserInput, UserDto } from "@class/shared/core";
import {
  ROLE_LABELS,
  ROLES,
  USER_STATUS_LABELS,
  USER_STATUSES,
  type Role,
  type UserStatus,
} from "@class/shared/permissions";
import { formatDateTime } from "@class/shared/time";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  toast,
} from "../../components/ui/index.ts";
import { api, unwrap } from "../../lib/api.ts";
import { requireRole } from "../../lib/auth.ts";
import { cn } from "../../lib/cn.ts";

const usersQuery = (status: UserStatus | undefined) =>
  queryOptions({
    queryKey: ["admin", "users", status ?? "all"],
    queryFn: async () =>
      (await unwrap(api.admin.users.$get({ query: status ? { status } : {} }))).users,
  });

export const Route = createFileRoute("/admin/users")({
  validateSearch: z.object({ status: z.enum(USER_STATUSES).optional() }),
  beforeLoad: requireRole(["admin"]),
  component: AdminUsersPage,
});

const statusTone = {
  unregistered: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
} as const;

function AdminUsersPage() {
  const { status = "pending" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const list = useQuery(usersQuery(status));
  const [reviewing, setReviewing] = useState<UserDto | null>(null);

  return (
    <div>
      <PageHeader
        title="帳號審核"
        description="核准註冊並設定角色。教師可以登錄自己的課程，管理員可以管理全部資料。"
      />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {(["pending", "approved", "rejected", "unregistered"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void navigate({ search: { status: s } })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm whitespace-nowrap",
              s === status ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface-muted",
            )}
          >
            {USER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title={`沒有${USER_STATUS_LABELS[status]}的帳號`} />
      ) : (
        <DataTable
          rows={list.data}
          rowKey={(u) => u.id}
          columns={[
            { header: "姓名", cell: (u) => u.name ?? "（未填）", mobile: "title" },
            { header: "LINE 名稱", cell: (u) => u.displayName, mobile: "subtitle" },
            { header: "系所 / 單位", cell: (u) => u.affiliation ?? "—" },
            {
              header: "申請身分",
              cell: (u) => (u.requestedRole ? ROLE_LABELS[u.requestedRole] : "—"),
            },
            { header: "目前角色", cell: (u) => ROLE_LABELS[u.role] },
            {
              header: "狀態",
              mobile: "badge",
              cell: (u) => (
                <Badge tone={statusTone[u.status]}>{USER_STATUS_LABELS[u.status]}</Badge>
              ),
            },
            {
              header: "建立時間",
              mobile: "hide",
              cell: (u) => <span className="text-ink-muted">{formatDateTime(u.createdAt)}</span>,
            },
          ]}
          actions={(u) =>
            u.status === "unregistered" ? null : (
              <Button size="sm" variant="secondary" onClick={() => setReviewing(u)}>
                {u.status === "pending" ? "審核" : "變更"}
              </Button>
            )
          }
        />
      )}
      {reviewing && <ReviewDialog user={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

function ReviewDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>(
    user.status === "approved" ? user.role : (user.requestedRole ?? "user"),
  );
  const [note, setNote] = useState("");

  const review = useMutation({
    mutationFn: (input: ReviewUserInput) =>
      unwrap(api.admin.users[":id"].review.$post({ param: { id: user.id }, json: input })),
    onSuccess: async (_, input) => {
      toast.success(input.decision === "approve" ? "已核准" : "已拒絕");
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err) => toast.error(err),
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`審核：${user.name ?? user.displayName}`}
      description={`${user.affiliation ?? ""}　申請身分：${user.requestedRole ? ROLE_LABELS[user.requestedRole] : "-"}`}
      footer={
        <>
          <Button
            variant="secondary"
            loading={review.isPending && review.variables.decision === "reject"}
            onClick={() => review.mutate({ decision: "reject", ...(note ? { note } : {}) })}
          >
            拒絕
          </Button>
          <Button
            loading={review.isPending && review.variables.decision === "approve"}
            onClick={() => review.mutate({ decision: "approve", role })}
          >
            核准為{ROLE_LABELS[role]}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="角色">
          {(p) => (
            <Select
              {...p}
              value={role}
              onChange={(e) => setRole(ROLES.find((r) => r === e.target.value) ?? "user")}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="拒絕原因（選填）">
          {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}
