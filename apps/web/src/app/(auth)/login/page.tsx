"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { LoginFlow } from "@/components/auth/login-flow";
import { useAuth } from "@/lib/auth";

/** กลับไปหน้าที่ตั้งใจจะเปิด — รับเฉพาะ path ในเว็บนี้ กัน open redirect */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, signedIn } = useAuth();
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  return <LoginFlow onSuccess={signedIn} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
