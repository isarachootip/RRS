"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Field, FormError, FormNotice, Submit } from "@/components/auth/form-parts";
import { t } from "@/i18n/th";
import { ApiError, publicApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await publicApi<{ message: string }>("/api/v1/auth/password/forgot", {
        email: new FormData(e.currentTarget).get("email"),
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
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.forgot.title")}</h1>
      <p className="text-ink-muted">{t("auth.forgot.body")}</p>
      <FormError message={error} />
      <FormNotice message={done} />
      {!done && (
        <>
          <Field
            id="email"
            name="email"
            type="email"
            label={t("auth.email")}
            autoComplete="username"
            required
            autoFocus
          />
          <Submit busy={busy}>{t("auth.forgot.submit")}</Submit>
        </>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-lagoon underline-offset-4 hover:underline">
          {t("auth.toLogin")}
        </Link>
      </p>
    </form>
  );
}
