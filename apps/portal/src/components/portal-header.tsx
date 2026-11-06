"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LOCALES, LOCALE_LABELS, dictionaries, type Locale } from "@/i18n/dictionaries";

const COOKIE_CONSENT_KEY = "rrs_cookie_consent_v1";

export function PortalHeader({ locale }: { locale: Locale }) {
  const d = dictionaries[locale];
  const pathname = usePathname() || `/${locale}`;
  const router = useRouter();

  const buildPathForLocale = (targetLocale: Locale): string => {
    const segments = pathname.split("/");
    if (segments.length > 1 && (LOCALES as readonly string[]).includes(segments[1] ?? "")) {
      segments[1] = targetLocale;
      return segments.join("/") || `/${targetLocale}`;
    }
    return `/${targetLocale}`;
  };

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-bold text-lagoon">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-lagoon text-sm font-bold text-white">
            RRS
          </span>
          <span>{d.brand}</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-700">
          <Link href={`/${locale}`} className="hover:text-lagoon">
            {d.navHome}
          </Link>
          <Link href={`/${locale}/listings`} className="hover:text-lagoon">
            {d.navSearch}
          </Link>
          <Link href={`/${locale}/compare`} className="hover:text-lagoon">
            {d.navCompare}
          </Link>
          <Link
            href={`/${locale}/submit-property`}
            className="rounded-lg bg-lagoon px-3 py-1.5 text-white hover:opacity-90"
          >
            {d.navSubmitProperty}
          </Link>

          <select
            aria-label={d.switchTo}
            value={locale}
            onChange={(e) => router.push(buildPathForLocale(e.target.value as Locale))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-lagoon hover:bg-slate-50"
          >
            {LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
        </nav>
      </div>
    </header>
  );
}

export function CookieBanner({ locale }: { locale: Locale }) {
  const d = dictionaries[locale];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!saved) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <aside
      data-testid="cookie-banner"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-700 sm:text-sm">
          {d.cookieMessage}{" "}
          <Link href={`/${locale}/privacy`} className="font-semibold text-lagoon underline">
            {d.cookiePolicy}
          </Link>
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
            } catch {
              // ignore storage errors
            }
            setVisible(false);
          }}
          className="rounded-lg bg-lagoon px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          {d.cookieAccept}
        </button>
      </div>
    </aside>
  );
}
