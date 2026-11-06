import { dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12" data-testid="privacy-page">
      <h1 className="text-3xl font-bold text-slate-900">{d.privacyTitle}</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-xs">
        <p>{d.privacyBody}</p>
      </div>
    </main>
  );
}
