import type { ReactNode } from "react";
import { t } from "@/i18n/th";

/** หน้าเข้าสู่ระบบ: แถบสีลากูนเดียวกับเมนูหลังบ้าน + ฟอร์มด้านขวา */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(320px,2fr)_3fr]">
      <aside className="hidden flex-col justify-between bg-lagoon p-10 text-white lg:flex">
        <p className="text-xl font-semibold tracking-tight">{t("app.name")}</p>
        <div className="max-w-sm">
          <p className="text-3xl leading-snug font-semibold">{t("auth.panel.title")}</p>
          <p className="mt-3 text-lagoon-soft">{t("auth.panel.body")}</p>
        </div>
        <p className="text-sm text-lagoon-soft/80">{t("app.tagline")}</p>
      </aside>
      <main className="flex min-h-dvh items-center justify-center px-4 py-10 lg:min-h-0">
        <div className="w-full max-w-sm">
          <p className="mb-8 text-xl font-semibold text-lagoon lg:hidden">{t("app.name")}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
