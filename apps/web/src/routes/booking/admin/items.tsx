/** 物品管理（B1）：鑰匙綁教室，共用物品設定總數量，可以停用。 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  type ItemDto,
  type ItemInput,
} from "@class/shared/booking";
import type { RoomOptionDto } from "@class/shared/core";
import {
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  fieldErrors,
  InlineError,
  Input,
  LoadingBlock,
  PageHeader,
  revealFirstError,
  Select,
} from "../../../components/ui/index.ts";
import { api, ApiError, unwrap } from "../../../lib/api.ts";
import { requireRole } from "../../../lib/auth.ts";
import {
  adminItemsQuery,
  allRoomsQuery,
  bookableRoomsQuery,
  bookingKeys,
} from "../../../modules/booking/queries.ts";
import { RoomOptions } from "../../../modules/booking/RoomOptions.tsx";

export const Route = createFileRoute("/booking/admin/items")({
  beforeLoad: requireRole(["admin"]),
  component: ItemsPage,
});

function ItemsPage() {
  const items = useQuery(adminItemsQuery);
  const allRooms = useQuery(allRoomsQuery);
  const [editing, setEditing] = useState<ItemDto | "new" | null>(null);
  const roomCode = (id: string | null) => allRooms.data?.find((r) => r.id === id)?.code ?? "";

  return (
    <div>
      <PageHeader
        title="物品管理"
        description="鑰匙綁定教室；投影筆、筆電等共用物品設定總數量。停用的物品不能再借。"
        actions={
          <>
            <ButtonLink to="/booking/admin" variant="secondary">
              回預約審核
            </ButtonLink>
            <Button onClick={() => setEditing("new")}>新增物品</Button>
          </>
        }
      />
      {items.isPending ? (
        <LoadingBlock />
      ) : items.isError ? (
        <ErrorBlock error={items.error} />
      ) : items.data.length === 0 ? (
        <EmptyState title="還沒有物品" description="按「新增物品」建立第一個。" />
      ) : (
        <DataTable
          rows={items.data}
          rowKey={(i) => i.id}
          columns={[
            {
              header: "名稱",
              mobile: "title",
              cell: (i) => (
                <>
                  <div className="font-medium">{i.name}</div>
                  {i.description && <div className="text-xs text-ink-muted">{i.description}</div>}
                </>
              ),
            },
            { header: "類別", cell: (i) => ITEM_CATEGORY_LABELS[i.category] },
            {
              header: "所屬教室",
              cell: (i) => (i.category === "key" ? roomCode(i.roomId) || "—" : "共用"),
            },
            { header: "數量", cell: (i) => i.quantity },
            {
              header: "狀態",
              mobile: "badge",
              cell: (i) => (i.isActive ? <Badge tone="success">啟用</Badge> : <Badge>停用</Badge>),
            },
          ]}
          actions={(i) => (
            <Button size="sm" variant="secondary" onClick={() => setEditing(i)}>
              編輯
            </Button>
          )}
        />
      )}
      {editing && (
        <ItemDialog
          item={editing === "new" ? null : editing}
          allRooms={allRooms.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ItemDialog({
  item,
  allRooms,
  onClose,
}: {
  item: ItemDto | null;
  allRooms: RoomOptionDto[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const bookable = useQuery(bookableRoomsQuery);
  const [form, setForm] = useState<ItemInput>({
    name: item?.name ?? "",
    category: item?.category ?? "key",
    roomId: item?.roomId ?? null,
    quantity: item?.quantity ?? 1,
    description: item?.description ?? "",
    isActive: item?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // 選項只有開放預約的教室；編輯中的鑰匙若綁在其他教室，也放進選項，免得被清掉
  const roomOptions = bookable.data ?? [];
  const current = allRooms.find((r) => r.id === form.roomId);
  const options =
    current && !roomOptions.some((r) => r.id === current.id)
      ? [current, ...roomOptions]
      : roomOptions;

  const save = useMutation({
    mutationFn: (input: ItemInput) =>
      item
        ? unwrap(api.booking.admin.items[":id"].$patch({ param: { id: item.id }, json: input }))
        : unwrap(api.booking.admin.items.$post({ json: input })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: bookingKeys.all });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "VALIDATION") {
        setErrors(fieldErrors(err.details));
        revealFirstError(formRef.current);
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    save.mutate({ ...form, roomId: form.category === "key" ? form.roomId : null });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={item ? "編輯物品" : "新增物品"}>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <Field label="名稱" required error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={form.name}
              placeholder={form.category === "key" ? "例：管101 鑰匙" : "例：投影筆"}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="類別" required error={errors.category}>
            {(p) => (
              <Select
                {...p}
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: ITEM_CATEGORIES.find((c) => c === e.target.value) ?? "other",
                  })
                }
              >
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ITEM_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="數量" required error={errors.quantity}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            )}
          </Field>
        </div>
        {form.category === "key" && (
          <Field label="所屬教室" required error={errors.roomId}>
            {(p) => (
              <Select
                {...p}
                value={form.roomId ?? ""}
                onChange={(e) => setForm({ ...form, roomId: e.target.value || null })}
              >
                <option value="">請選擇</option>
                <RoomOptions rooms={options} />
              </Select>
            )}
          </Field>
        )}
        <Field label="說明" hint="例：放在哪裡、注意事項" error={errors.description}>
          {(p) => (
            <Input
              {...p}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          )}
        </Field>
        <Checkbox
          label="啟用（可以借）"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        {/* 欄位錯誤顯示在欄位下方，其他錯誤顯示在按鈕上方 */}
        {!(save.error instanceof ApiError && save.error.code === "VALIDATION") && (
          <InlineError error={save.error} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={save.isPending}>
            儲存
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
