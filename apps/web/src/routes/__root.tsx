import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell.tsx";
import { ErrorBlock, buttonClass } from "../components/ui/index.ts";
import type { RouterContext } from "../lib/router-context.ts";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="py-20 text-center">
        <p className="text-lg font-medium">找不到這個頁面</p>
        <Link to="/" className={buttonClass("secondary", "md", "mt-4")}>
          回首頁
        </Link>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <ErrorBlock error={error} onRetry={reset} />
    </AppShell>
  ),
});
