import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { buildLocaleAlternates, dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";
import { fetchPublicListings } from "@/lib/public-api";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const d = dictionaries[isLocale(locale) ? locale : "th"];
  return {
    title: `${d.title} | ${d.brand}`,
    description: d.intro,
    alternates: { languages: buildLocaleAlternates("") },
    openGraph: { title: d.title, description: d.intro, type: "website" },
  };
}

const QUICK_CATEGORIES = [
  { code: "CONDO", labelKey: "catCONDO" as const },
  { code: "HOUSE", labelKey: "catHOUSE" as const },
  { code: "TOWNHOME", labelKey: "catTOWNHOME" as const },
  { code: "APARTMENT_UNIT", labelKey: "catAPARTMENT_UNIT" as const },
  { code: "FACTORY", labelKey: "catFACTORY" as const },
  { code: "WAREHOUSE", labelKey: "catWAREHOUSE" as const },
  { code: "LAND", labelKey: "catLAND" as const },
  { code: "COMMERCIAL", labelKey: "catCOMMERCIAL" as const },
];

export default async function Home({ params }: Props) {
  const { locale } = await params;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const { items } = await fetchPublicListings({ pageSize: "6" });

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:py-16">
      <section className="rounded-3xl bg-lagoon p-6 text-white shadow-lg sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{d.title}</h1>
        <p className="mt-3 max-w-2xl text-base text-teal-100 sm:text-lg">{d.intro}</p>

        <form
          action={`/${l}/listings`}
          method="get"
          className="mt-6 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 shadow sm:grid-cols-4"
        >
          <select name="type" aria-label={d.txAll} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">{d.txAll}</option>
            <option value="RENT">{d.txRent}</option>
            <option value="SALE">{d.txSale}</option>
          </select>
          <select
            name="category"
            aria-label={d.catAll}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{d.catAll}</option>
            {QUICK_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {d[c.labelKey]}
              </option>
            ))}
          </select>
          <input
            name="q"
            placeholder={d.searchPlaceholder}
            aria-label={d.searchPlaceholder}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-lagoon px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {d.searchButton}
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_CATEGORIES.map((c) => (
          <Link
            key={c.code}
            href={`/${l}/listings?category=${c.code}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-xs transition hover:border-lagoon hover:text-lagoon"
          >
            {d[c.labelKey]}
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{d.featuredTitle}</h2>
          <Link href={`/${l}/listings`} className="text-sm font-semibold text-lagoon hover:underline">
            {d.navSearch} →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} locale={l} />
          ))}
        </div>
      </section>
    </main>
  );
}
