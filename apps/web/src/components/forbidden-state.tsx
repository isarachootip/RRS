"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n/th";

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-lg rounded-lg border border-line bg-surface p-8 text-center shadow-sm"
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-paper text-lagoon-deep">
        <ShieldAlert className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-ink">{t("rbac.forbidden.title")}</h1>
      <p className="mt-2 text-sm text-ink-muted">{message ?? t("rbac.forbidden.body")}</p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-lagoon px-4 py-2 text-sm font-medium text-white hover:bg-lagoon-deep"
        >
          {t("rbac.forbidden.back")}
        </Link>
      </div>
    </section>
  );
}
