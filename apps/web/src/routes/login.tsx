import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import type { DevLoginInput } from "@class/shared/core";
import { Button, Card, ErrorBlock, InlineError } from "../components/ui/index.ts";
import { api, unwrap } from "../lib/api.ts";
import { authConfigQuery, lineLoginUrl, meQuery } from "../lib/auth.ts";

const ERRORS: Record<string, string> = {
  cancelled: "你取消了 LINE 登入。",
  state: "登入逾時或連結失效，請再試一次。",
  line: "LINE 登入失敗，請稍後再試。",
};

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
    error: z.string().optional(),
  }),
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.status === "approved") throw redirect({ href: search.redirect ?? "/" });
    if (me) throw redirect({ to: "/register" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo = "/", error } = Route.useSearch();
  const config = useQuery(authConfigQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [devBusy, setDevBusy] = useState<string | null>(null);
  const [devError, setDevError] = useState<unknown>(null);

  async function devLogin(as: DevLoginInput["as"]) {
    setDevBusy(as);
    setDevError(null);
    try {
      await unwrap(api.auth["dev-login"].$post({ json: { as } }));
      await qc.invalidateQueries({ queryKey: ["auth"] });
      await navigate({ href: as === "pending" ? "/register" : redirectTo });
    } catch (err) {
      setDevError(err);
    } finally {
      setDevBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold">登入</h1>
          <p className="mt-1 text-sm text-ink-muted">
            使用 LINE 帳號登入。第一次登入需要填寫註冊資料，管理員核准後即可使用。
          </p>
        </div>
        {error && <ErrorBlock error={new Error(ERRORS[error] ?? "登入失敗")} />}
        {config.data?.lineEnabled === false && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            伺服器尚未設定 LINE 登入。
          </p>
        )}
        <a
          href={lineLoginUrl(redirectTo)}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-[#06c755] font-medium text-white hover:bg-[#05b34c]"
        >
          使用 LINE 登入
        </a>
        {config.data?.devLogin && (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-xs text-ink-muted">開發用登入（正式環境不會出現）</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["admin", "管理員"],
                  ["teacher", "教師"],
                  ["user", "一般使用者"],
                  ["pending", "待審核者"],
                ] as const
              ).map(([as, label]) => (
                <Button
                  key={as}
                  variant="secondary"
                  size="sm"
                  loading={devBusy === as}
                  onClick={() => void devLogin(as)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <InlineError error={devError} />
          </div>
        )}
      </Card>
    </div>
  );
}
