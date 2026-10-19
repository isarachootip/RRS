"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { t } from "@/i18n/th";
import { useAuth } from "@/lib/auth";

/** หน้าหลังบ้านทุกหน้าต้องล็อกอิน — ยังไม่ล็อกอินพาไปหน้า /login แล้วกลับมาหน้าเดิม */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-muted" role="status">
        {t("auth.checking")}
      </div>
    );
  }
  return <>{children}</>;
}
