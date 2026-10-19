"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Field, FormError, FormNotice, Submit } from "@/components/auth/form-parts";
import { t } from "@/i18n/th";
import { ApiError, publicApi } from "@/lib/api";

function ResetForm() {
  const token = useSearchParams().get("token");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : t("auth.reset.missing"));
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError(t("auth.reset.mismatch"));
    setBusy(true);
    setError(null);
    try {
      const r = await publicApi<{ message: string }>("/api/v1/auth/password/reset", {
        token,
        password: f.get("password"),
      });
      setDone(r.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.reset.title")}</h1>
      <p className="text-ink-muted">{t("auth.reset.body")}</p>
      <FormError message={error} />
      <FormNotice message={done} />
      {token && !done && (
        <>
          <Field
            id="password"
            name="password"
            type="password"
            label={t("auth.reset.new")}
            autoComplete="new-password"
            required
            autoFocus
          />
          <Field
            id="confirm"
            name="confirm"
            type="password"
            label={t("auth.reset.confirm")}
            autoComplete="new-password"
            required
          />
          <Submit busy={busy}>{t("auth.reset.submit")}</Submit>
        </>
      )}
      <p className="text-center text-sm">
        <Link href={done ? "/login" : "/forgot-password"} className="text-lagoon underline-offset-4 hover:underline">
          {done ? t("auth.toLogin") : t("auth.forgot.submit")}
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
