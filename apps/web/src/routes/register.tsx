import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { AFFILIATION_GROUPS, AFFILIATION_OPTIONS, type RegisterInput } from "@class/shared/core";

const OTHER = "__other__";
import {
  Button,
  Card,
  Field,
  fieldErrors,
  InlineError,
  Input,
  revealFirstError,
  Select,
} from "../components/ui/index.ts";
import { api, ApiError, unwrap } from "../lib/api.ts";
import { meQuery, useMe } from "../lib/auth.ts";

export const Route = createFileRoute("/register")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: "/login", search: { redirect: "/register" } });
    if (me.status === "approved") throw redirect({ to: "/" });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RegisterInput>({
    // 第一次註冊先帶入 LINE 名稱，使用者可以改成真實姓名
    name: me?.name ?? me?.displayName ?? "",
    affiliation: me?.affiliation ?? "",
    phone: "",
    requestedRole: "user",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  // 「其他」：不在管院清單裡的單位，自行填寫
  const [otherAffiliation, setOtherAffiliation] = useState(
    form.affiliation !== "" && !AFFILIATION_OPTIONS.includes(form.affiliation),
  );

  const submit = useMutation({
    mutationFn: (input: RegisterInput) => unwrap(api.auth.register.$post({ json: input })),
    onSuccess: async () => {
      setErrors({});
      setEditing(false);
      // 頁面會切到「等待審核」，不用另外提示
      await qc.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "VALIDATION") {
        setErrors(fieldErrors(err.details));
        revealFirstError(formRef.current);
      }
    },
  });

  if (!me) return null;

  if (me.status === "pending" && !editing) {
    return (
      <div className="mx-auto max-w-md py-8">
        <Card className="space-y-3 p-6">
          <h1 className="text-xl font-semibold">等待審核</h1>
          <p className="text-sm text-ink-muted">
            已收到你的註冊資料（{me.name}，{me.affiliation}
            ）。管理員核准後就可以使用預約借用；空間查詢不需要等待審核。
          </p>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            修改註冊資料
          </Button>
        </Card>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate({ ...form, ...(form.phone ? {} : { phone: undefined }) });
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card className="p-6">
        <h1 className="text-xl font-semibold">註冊資料</h1>
        {me.status === "rejected" && (
          <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            上次的申請沒有通過，可以修改後重新送出。
          </p>
        )}
        <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="姓名" required error={errors.name}>
            {(p) => (
              <Input
                {...p}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="系所或單位" required error={errors.affiliation}>
            {(p) => (
              <Select
                {...p}
                value={otherAffiliation ? OTHER : form.affiliation}
                onChange={(e) => {
                  const v = e.target.value;
                  setOtherAffiliation(v === OTHER);
                  setForm({ ...form, affiliation: v === OTHER ? "" : v });
                }}
              >
                <option value="">請選擇</option>
                {AFFILIATION_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER}>其他（自行填寫）</option>
              </Select>
            )}
          </Field>
          {otherAffiliation && (
            <Field label="其他系所或單位" required hint="例：外院教師請填所屬系所">
              {(p) => (
                <Input
                  {...p}
                  value={form.affiliation}
                  onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
                />
              )}
            </Field>
          )}
          <Field label="聯絡電話" error={errors.phone}>
            {(p) => (
              <Input
                {...p}
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="身分"
            required
            error={errors.requestedRole}
            hint="教師身分可以登錄自己的課程"
          >
            {(p) => (
              <Select
                {...p}
                value={form.requestedRole}
                onChange={(e) =>
                  setForm({
                    ...form,
                    requestedRole: e.target.value === "teacher" ? "teacher" : "user",
                  })
                }
              >
                <option value="user">學生 / 職員</option>
                <option value="teacher">教師</option>
              </Select>
            )}
          </Field>
          {/* 欄位錯誤顯示在欄位下方，其他錯誤顯示在送出按鈕上方 */}
          {!(submit.error instanceof ApiError && submit.error.code === "VALIDATION") && (
            <InlineError error={submit.error} />
          )}
          <Button type="submit" loading={submit.isPending} className="w-full">
            送出
          </Button>
        </form>
      </Card>
    </div>
  );
}
