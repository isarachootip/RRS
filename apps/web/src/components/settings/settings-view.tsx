"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ForbiddenState } from "@/components/forbidden-state";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RolesTab } from "./roles-tab";
import { TeamsTab } from "./teams-tab";
import type { AdminRoleItem, AdminTeamItem, AdminUserItem, PermissionCatalogItem } from "./types";
import { UsersTab } from "./users-tab";

type TabId = "users" | "teams" | "roles";

export function SettingsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("users");

  const isAdmin =
    Boolean(user?.roles.includes("ADMIN")) ||
    Boolean(user?.permissions?.["user.manage"]) ||
    Boolean(user?.permissions?.["role.manage"]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<{ items: AdminUserItem[] }>("/api/v1/users"),
    enabled: isAdmin,
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => api<{ items: AdminTeamItem[] }>("/api/v1/teams"),
    enabled: isAdmin,
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api<{ roles: AdminRoleItem[]; catalog: PermissionCatalogItem[] }>("/api/v1/roles"),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <ForbiddenState />;
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "users", label: t("settings.tab.users") },
    { id: "teams", label: t("settings.tab.teams") },
    { id: "roles", label: t("settings.tab.roles") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("settings.subtitle")}</p>
      </div>

      <div role="tablist" aria-label={t("settings.title")} className="flex gap-2 border-b border-line">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected ? "border-lagoon text-lagoon-deep" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "users" && (
        <UsersTab
          users={usersQuery.data?.items ?? []}
          teams={teamsQuery.data?.items ?? []}
          roles={rolesQuery.data?.roles ?? []}
        />
      )}
      {activeTab === "teams" && <TeamsTab teams={teamsQuery.data?.items ?? []} users={usersQuery.data?.items ?? []} />}
      {activeTab === "roles" && (
        <RolesTab roles={rolesQuery.data?.roles ?? []} catalog={rolesQuery.data?.catalog ?? []} />
      )}
    </div>
  );
}
