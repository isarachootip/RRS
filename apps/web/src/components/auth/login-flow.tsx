"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { t } from "@/i18n/th";
import { ApiError, type SessionPayload, publicApi } from "@/lib/api";
import { Field, FormError, Submit } from "./form-parts";

type LoginResponse =
  | ({ status: "OK" } & SessionPayload)
  | { status: "MFA_REQUIRED" | "MFA_SETUP_REQUIRED"; challengeToken: string };

interface MfaSetup {
  secret: string;
  qrDataUrl: string;
}

type Step =
  | { kind: "credentials" }
  | { kind: "mfa"; challengeToken: string }
  | { kind: "setup"; challengeToken: string; setup: MfaSetup | null };

const message = (e: unknown) => (e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");

/** ล็อกอิน 3 ขั้น: รหัสผ่าน → (ถ้าต้องใช้) รหัส 2FA หรือ ตั้งค่า 2FA ครั้งแรก */
export function LoginFlow({ onSuccess }: { onSuccess: (s: SessionPayload) => void }) {
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function handle(res: LoginResponse) {
    if (res.status === "OK") return onSuccess(res);
    if (res.status === "MFA_REQUIRED") return setStep({ kind: "mfa", challengeToken: res.challengeToken });
    setStep({ kind: "setup", challengeToken: res.challengeToken, setup: null });
    void publicApi<MfaSetup>("/api/v1/auth/mfa/setup", { challengeToken: res.challengeToken })
      .then((setup) => setStep({ kind: "setup", challengeToken: res.challengeToken, setup }))
      .catch((e) => setError(message(e)));
  }

  const onCredentials = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () =>
      handle(
        await publicApi<LoginResponse>("/api/v1/auth/login", { email: f.get("email"), password: f.get("password") }),
      ),
    );
  };

  const onCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind === "credentials") return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    const path = step.kind === "mfa" ? "/api/v1/auth/mfa/verify" : "/api/v1/auth/mfa/enable";
    void run(async () => handle(await publicApi<LoginResponse>(path, { challengeToken: step.challengeToken, code })));
  };

  if (step.kind === "credentials") {
    return (
      <form onSubmit={onCredentials} className="space-y-4" noValidate>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.login.title")}</h1>
        <FormError message={error} />
        <Field
          id="email"
          name="email"
          type="email"
          label={t("auth.email")}
          autoComplete="username"
          required
          autoFocus
        />
        <Field
          id="password"
          name="password"
          type="password"
          label={t("auth.password")}
          autoComplete="current-password"
          required
        />
        <Submit busy={busy}>{busy ? t("auth.working") : t("auth.login.submit")}</Submit>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-lagoon underline-offset-4 hover:underline">
            {t("auth.login.forgot")}
          </Link>
        </p>
      </form>
    );
  }

  const isSetup = step.kind === "setup";
  return (
    <form onSubmit={onCode} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold tracking-tight">{isSetup ? t("auth.setup.title") : t("auth.mfa.title")}</h1>
      <p className="text-ink-muted">{isSetup ? t("auth.setup.body") : t("auth.mfa.body")}</p>
      {isSetup && step.setup && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-line bg-surface p-4">
          <img src={step.setup.qrDataUrl} alt={t("auth.setup.qrAlt")} width={180} height={180} />
          <p className="text-center text-sm text-ink-muted">{t("auth.setup.manual")}</p>
          <code className="rounded bg-paper px-2 py-1 text-sm tracking-wider break-all select-all">
            {step.setup.secret}
          </code>
        </div>
      )}
      <FormError message={error} />
      <Field
        id="code"
        name="code"
        label={t("auth.mfa.code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={7}
        required
        autoFocus
      />
      <Submit busy={busy}>{busy ? t("auth.working") : isSetup ? t("auth.setup.submit") : t("auth.mfa.submit")}</Submit>
      <p className="text-center text-sm">
        <button
          type="button"
          onClick={() => setStep({ kind: "credentials" })}
          className="text-lagoon underline-offset-4 hover:underline"
        >
          {t("auth.mfa.back")}
        </button>
      </p>
    </form>
  );
}
