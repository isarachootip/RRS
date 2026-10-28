"use client";

import { LogOut, Menu, UserCircle2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { t } from "@/i18n/th";
import { useAuth } from "@/lib/auth";
import { ApiStatus } from "./api-status";
import { GlobalSearchBar } from "./global-search-bar";
import { NAV, canSeeNavItem, isActive } from "./nav";

const STATUS_DOTS = [
  { key: "status.AVAILABLE", className: "bg-status-available" },
  { key: "status.BOOKED", className: "bg-status-booked" },
  { key: "status.CONTRACTED", className: "bg-status-contracted" },
  { key: "status.UNAVAILABLE", className: "bg-status-unavailable" },
] as const;

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { user } = useAuth();
  const visibleNav = NAV.filter((item) => canSeeNavItem(user, item));
  return (
    <div className="flex h-full flex-col bg-lagoon text-white">
      <div className="px-5 pt-6 pb-5">
        <p className="text-xl font-semibold tracking-tight">{t("app.name")}</p>
        <p className="text-sm text-lagoon-soft/80">{t("app.tagline")}</p>
      </div>
      <nav aria-label={t("nav.main")} className="flex-1 px-3">
        <ul className="space-y-0.5">
          {visibleNav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors ${
                    active ? "bg-white text-lagoon-deep font-medium" : "text-white/90 hover:bg-lagoon-deep"
                  }`}
                >
                  <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/15 px-5 py-4">
        <p className="mb-2 text-sm text-lagoon-soft/80">{t("status.legend")}</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          {STATUS_DOTS.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className={`size-2.5 rounded-full ring-2 ring-white/70 ${s.className}`} />
              {t(s.key)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("topbar.user")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-1 text-ink-muted hover:bg-paper"
      >
        <UserCircle2 className="size-7" strokeWidth={1.5} />
        <span className="hidden max-w-40 truncate text-sm text-ink md:inline">{user?.fullName}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-line bg-surface p-2 shadow-lg" role="menu">
          <div className="px-2 py-1.5">
            <p className="truncate font-medium">{user?.fullName}</p>
            <p className="truncate text-sm text-ink-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="mt-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-paper"
          >
            <LogOut aria-hidden className="size-4" />
            {t("auth.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh" data-testid="sidebar-desktop">
        <Sidebar pathname={pathname} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.main")}>
          <button
            type="button"
            aria-label={t("nav.close")}
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(80vw,280px)] shadow-xl" data-testid="sidebar-drawer">
            <button
              type="button"
              aria-label={t("nav.close")}
              className="absolute top-4 right-3 rounded p-1.5 text-white hover:bg-lagoon-deep"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="size-5" />
            </button>
            <Sidebar pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            aria-label={t("nav.open")}
            aria-expanded={drawerOpen}
            className="-ml-1 rounded p-1.5 hover:bg-paper lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <GlobalSearchBar />
          <div className="ml-auto flex items-center gap-3">
            <ApiStatus />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
