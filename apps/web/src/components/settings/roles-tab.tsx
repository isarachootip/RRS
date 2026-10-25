"use client";

import type { PermissionCode, Scope } from "@rrs/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";
import type { AdminRoleItem, PermissionCatalogItem } from "./types";

interface RolesTabProps {
  roles: AdminRoleItem[];
  catalog: PermissionCatalogItem[];
}

const SCOPES: Scope[] = ["ALL", "TEAM", "OWN"];

export function RolesTab({ roles, catalog }: RolesTabProps) {
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id ?? "");
  const [permState, setPermState] = useState<Partial<Record<PermissionCode, Scope>>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];

  useEffect(() => {
    if (!selectedRole) return;
    setSelectedRoleId(selectedRole.id);
    const map: Partial<Record<PermissionCode, Scope>> = {};
    for (const p of selectedRole.permissions) {
      map[p.code] = p.scope;
    }
    setPermState(map);
    setSavedNotice(false);
  }, [selectedRole]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedRole) return Promise.resolve({ ok: false });
      const permissions = Object.entries(permState)
        .filter(([, scope]) => Boolean(scope))
        .map(([code, scope]) => ({ code: code as PermissionCode, scope: scope as Scope }));
      return api(`/api/v1/roles/${selectedRole.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions }),
      });
    },
    onSuccess: () => {
      setSavedNotice(true);
      void qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
  });

  const togglePermission = (code: PermissionCode, checked: boolean) => {
    setSavedNotice(false);
    setPermState((prev) => {
      const next = { ...prev };
      if (checked) next[code] = next[code] ?? "OWN";
      else delete next[code];
      return next;
    });
  };

  const changeScope = (code: PermissionCode, scope: Scope) => {
    setSavedNotice(false);
    setPermState((prev) => ({ ...prev, [code]: scope }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <label htmlFor="role-select" className="text-sm font-medium text-ink">
            บทบาท:
          </label>
          <select
            id="role-select"
            value={selectedRole?.id ?? ""}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="h-9 rounded border border-line px-3 text-sm"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {savedNotice && <span className="text-sm text-lagoon-deep">บันทึกสิทธิ์แล้ว</span>}
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !selectedRole}
            className="h-9 rounded bg-lagoon px-4 text-sm font-medium text-white hover:bg-lagoon-deep"
          >
            บันทึกสิทธิ์
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-paper text-left font-medium text-ink-muted">
            <tr>
              <th className="px-4 py-3">เปิดใช้</th>
              <th className="px-4 py-3">รหัสสิทธิ์</th>
              <th className="px-4 py-3">คำอธิบาย</th>
              <th className="px-4 py-3">ขอบเขตข้อมูล (Scope)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {catalog.map((item) => {
              const currentScope = permState[item.code];
              const checked = Boolean(currentScope);
              return (
                <tr key={item.code}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`${item.description} (${item.code})`}
                      checked={checked}
                      onChange={(e) => togglePermission(item.code, e.target.checked)}
                      className="size-4 accent-lagoon"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{item.code}</td>
                  <td className="px-4 py-2.5 text-ink">{item.description}</td>
                  <td className="px-4 py-2.5">
                    <select
                      aria-label={`ขอบเขตของ ${item.code}`}
                      disabled={!checked}
                      value={currentScope ?? "OWN"}
                      onChange={(e) => changeScope(item.code, e.target.value as Scope)}
                      className="h-8 rounded border border-line px-2 text-xs disabled:opacity-40"
                    >
                      {SCOPES.map((sc) => (
                        <option key={sc} value={sc}>
                          {t(`settings.scope.${sc}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
