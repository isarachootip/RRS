import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "../globals.css";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CookieBanner, PortalHeader } from "@/components/portal-header";
import { LOCALES, isLocale, isRtlLocale } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={isRtlLocale(locale) ? "rtl" : "ltr"}>
      <body className="min-h-screen bg-paper text-ink">
        <PortalHeader locale={locale} />
        {children}
        <CookieBanner locale={locale} />
      </body>
    </html>
  );
}
