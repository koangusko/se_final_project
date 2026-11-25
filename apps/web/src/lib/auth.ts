/**
 * 登入狀態。
 *
 * 元件裡：const me = useMe();  // MeDto | null
 * 路由裡：beforeLoad: requireApproved  或  beforeLoad: requireRole(["admin"])
 */
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { redirect, type ParsedLocation } from "@tanstack/react-router";
import type { MeDto } from "@class/shared/core";
import type { Role } from "@class/shared/permissions";
import { api, unwrap } from "./api.ts";
import type { RouterContext } from "./router-context.ts";

export const meQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async (): Promise<MeDto | null> => (await unwrap(api.auth.me.$get())).user,
  staleTime: 60_000,
});

export const authConfigQuery = queryOptions({
  queryKey: ["auth", "config"],
  queryFn: () => unwrap(api.auth.config.$get()),
  staleTime: Infinity,
});

export function useMe(): MeDto | null {
  return useQuery(meQuery).data ?? null;
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await unwrap(api.auth.logout.$post());
    qc.clear();
    window.location.href = "/";
  };
}

/** 導向 LINE 登入，登入後回到 redirect */
export function lineLoginUrl(redirectTo: string) {
  return `/api/auth/line/login?redirect=${encodeURIComponent(redirectTo)}`;
}

interface GuardArgs {
  context: RouterContext;
  location: ParsedLocation;
}

/** 路由 beforeLoad：要登入且審核通過 */
export async function requireApproved({ context, location }: GuardArgs) {
  const me = await context.queryClient.ensureQueryData(meQuery);
  if (!me) throw redirect({ to: "/login", search: { redirect: location.href } });
  if (me.status !== "approved") throw redirect({ to: "/register" });
  return { me };
}

/** 路由 beforeLoad：要特定角色 */
export function requireRole(roles: Role[]) {
  return async (args: GuardArgs) => {
    const { me } = await requireApproved(args);
    if (!roles.includes(me.role)) throw redirect({ to: "/" });
    return { me };
  };
}
