import { Menu } from "@base-ui/react/menu";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "@class/shared/permissions";
import { useLogout, useMe } from "../lib/auth.ts";
import { ADMIN_NAV, MAIN_NAV } from "../nav.ts";
import { buttonClass } from "./ui/index.ts";

const menuPopup =
  "min-w-48 rounded-xl border border-line bg-surface p-1 shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 transition-opacity";
const menuItem =
  "flex cursor-default items-center rounded-lg px-3 py-2 text-sm outline-none select-none data-highlighted:bg-surface-muted";

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const adminItems =
    me?.status === "approved" ? ADMIN_NAV.filter((i) => i.roles.includes(me.role)) : [];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="font-semibold tracking-tight whitespace-nowrap">
            管院空間系統
          </Link>
          <nav className="hidden gap-1 md:flex">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
                activeProps={{
                  className: "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {adminItems.length > 0 && (
              <Menu.Root>
                <Menu.Trigger className={buttonClass("ghost", "sm")}>管理</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner sideOffset={6} align="end" className="z-50">
                    <Menu.Popup className={menuPopup}>
                      {adminItems.map((i) => (
                        <Menu.Item
                          key={i.to}
                          className={menuItem}
                          onClick={() => void navigate({ to: i.to })}
                        >
                          {i.label}
                        </Menu.Item>
                      ))}
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            )}
            {me ? (
              <Menu.Root>
                <Menu.Trigger className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-surface-muted">
                  {me.pictureUrl ? (
                    <img src={me.pictureUrl} alt="" className="size-8 rounded-full" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-sm text-accent">
                      {(me.name ?? me.displayName).slice(0, 1)}
                    </span>
                  )}
                  <span className="hidden max-w-32 truncate text-sm sm:inline">
                    {me.name ?? me.displayName}
                  </span>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner sideOffset={6} align="end" className="z-50">
                    <Menu.Popup className={menuPopup}>
                      <div className="px-3 py-2 text-xs text-ink-muted">
                        {ROLE_LABELS[me.role]}
                        {me.status !== "approved" && "（尚未審核通過）"}
                      </div>
                      {me.status !== "approved" && (
                        <Menu.Item
                          className={menuItem}
                          onClick={() => void navigate({ to: "/register" })}
                        >
                          註冊資料
                        </Menu.Item>
                      )}
                      <Menu.Item className={menuItem} onClick={() => void logout()}>
                        登出
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            ) : (
              <Link to="/login" className={buttonClass("primary", "sm")}>
                登入
              </Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 md:hidden">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-ink-muted"
              activeProps={{ className: "bg-accent-soft text-accent" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
