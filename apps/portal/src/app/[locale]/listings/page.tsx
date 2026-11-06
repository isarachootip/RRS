import type { Metadata } from "next";
import { ListingCard } from "@/components/listing-card";
import { OsmMapEmbed } from "@/components/osm-map";
import { buildLocaleAlternates, dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";
import { fetchPublicListings } from "@/lib/public-api";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const d = dictionaries[isLocale(locale) ? locale : "th"];
  return {
    title: `${d.navSearch} | ${d.brand}`,
    description: d.intro,
    alternates: { languages: buildLocaleAlternates("/listings") },
  };
}

function firstStr(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function ListingsSearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];

  const query = {
    type: firstStr(sp.type),
    category: firstStr(sp.category),
    q: firstStr(sp.q),
    minPrice: firstStr(sp.minPrice),
    maxPrice: firstStr(sp.maxPrice),
    bedrooms: firstStr(sp.bedrooms),
    petAllowed: firstStr(sp.petAllowed),
    nearTransit: firstStr(sp.nearTransit),
    sort: firstStr(sp.sort),
  };

  const { items } = await fetchPublicListings(query);
  const firstWithCoords = items.find((i) => i.asset.location.latitude !== null);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8" data-testid="portal-listings-page">
      <h1 className="text-2xl font-bold text-slate-900">{d.navSearch}</h1>

      <form
        action={`/${l}/listings`}
        method="get"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-4"
      >
        <select
          name="type"
          defaultValue={query.type ?? ""}
          aria-label={d.txAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">{d.txAll}</option>
          <option value="RENT">{d.txRent}</option>
          <option value="SALE">{d.txSale}</option>
        </select>

        <select
          name="category"
          defaultValue={query.category ?? ""}
          aria-label={d.catAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">{d.catAll}</option>
          <option value="CONDO">{d.catCONDO}</option>
          <option value="HOUSE">{d.catHOUSE}</option>
          <option value="TOWNHOME">{d.catTOWNHOME}</option>
          <option value="APARTMENT_UNIT">{d.catAPARTMENT_UNIT}</option>
          <option value="FACTORY">{d.catFACTORY}</option>
          <option value="WAREHOUSE">{d.catWAREHOUSE}</option>
          <option value="LAND">{d.catLAND}</option>
          <option value="COMMERCIAL">{d.catCOMMERCIAL}</option>
        </select>

        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder={d.searchPlaceholder}
          aria-label={d.searchPlaceholder}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <select
          name="sort"
          defaultValue={query.sort ?? "newest"}
          aria-label={d.sortNewest}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="newest">{d.sortNewest}</option>
          <option value="price_asc">{d.sortPriceAsc}</option>
          <option value="price_desc">{d.sortPriceDesc}</option>
          <option value="popular">{d.sortPopular}</option>
        </select>

        <input
          name="minPrice"
          type="number"
          defaultValue={query.minPrice ?? ""}
          placeholder={d.filterMinPrice}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="maxPrice"
          type="number"
          defaultValue={query.maxPrice ?? ""}
          placeholder={d.filterMaxPrice}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="petAllowed" value="true" defaultChecked={query.petAllowed === "true"} />
          {d.filterPetAllowed}
        </label>
        <button
          type="submit"
          className="rounded-lg bg-lagoon px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {d.searchButton}
        </button>
      </form>

      <OsmMapEmbed
        locale={l}
        latitude={firstWithCoords?.asset.location.latitude ?? 13.7367}
        longitude={firstWithCoords?.asset.location.longitude ?? 100.5632}
        approximateLocation={firstWithCoords?.asset.location.approximateLocation}
      />

      {items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">{d.featuredEmpty}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} locale={l} />
          ))}
        </div>
      )}
    </main>
  );
}
