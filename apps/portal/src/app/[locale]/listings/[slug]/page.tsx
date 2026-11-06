import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/listing-card";
import { OsmMapEmbed } from "@/components/osm-map";
import { dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";
import { buildListingJsonLd, fetchPublicListingBySlug } from "@/lib/public-api";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const data = await fetchPublicListingBySlug(slug);
  if (!data) return { title: d.brand };
  const title = l === "en" ? data.listing.titleEn || data.listing.titleTh : data.listing.titleTh;
  const desc = l === "en" ? data.listing.descriptionEn || data.listing.descriptionTh : data.listing.descriptionTh;
  return {
    title: `${title} | ${d.brand}`,
    description: desc ?? title,
    alternates: {
      languages: {
        th: `/th/listings/${slug}`,
        en: `/en/listings/${slug}`,
      },
    },
    openGraph: { title, description: desc ?? title, type: "article" },
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const data = await fetchPublicListingBySlug(slug);
  if (!data) notFound();

  const { listing, nearby } = data;
  const title = l === "en" ? listing.titleEn || listing.titleTh : listing.titleTh;
  const description = l === "en" ? listing.descriptionEn || listing.descriptionTh : listing.descriptionTh;
  const priceSuffix = listing.type === "RENT" ? d.priceSuffixRent : d.priceSuffixSale;
  const jsonLd = buildListingJsonLd(listing, l);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8" data-testid="listing-detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-lagoon">
            {listing.type === "RENT" ? d.txRent : d.txSale} · {listing.asset.category}
          </span>
          <span className="font-mono text-xs text-slate-500">{listing.asset.code}</span>
        </div>

        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>

        <p className="mt-1 text-sm text-slate-600">
          {[listing.asset.project?.name, listing.asset.district, listing.asset.province].filter(Boolean).join(" · ")}
        </p>

        <p className="mt-4 text-2xl font-bold text-lagoon">
          {listing.price.toLocaleString()} <span className="text-sm font-normal text-slate-600">{priceSuffix}</span>
        </p>

        {description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{description}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
          {listing.asset.areaSqm !== null && (
            <div>
              <dt className="text-xs text-slate-500">{d.specArea}</dt>
              <dd className="font-semibold text-slate-900">{listing.asset.areaSqm} sqm</dd>
            </div>
          )}
          {listing.asset.bedrooms !== null && (
            <div>
              <dt className="text-xs text-slate-500">{d.specBedrooms}</dt>
              <dd className="font-semibold text-slate-900">{listing.asset.bedrooms}</dd>
            </div>
          )}
          {listing.asset.bathrooms !== null && (
            <div>
              <dt className="text-xs text-slate-500">{d.specBathrooms}</dt>
              <dd className="font-semibold text-slate-900">{listing.asset.bathrooms}</dd>
            </div>
          )}
          {listing.asset.floor !== null && (
            <div>
              <dt className="text-xs text-slate-500">{d.specFloor}</dt>
              <dd className="font-semibold text-slate-900">{listing.asset.floor}</dd>
            </div>
          )}
        </dl>

        {Object.keys(listing.asset.attributes).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {Object.entries(listing.asset.attributes).map(([k, v]) => (
              <span key={k} className="rounded-lg border border-slate-200 px-2.5 py-1">
                {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      <OsmMapEmbed
        locale={l}
        latitude={listing.asset.location.latitude}
        longitude={listing.asset.location.longitude}
        approximateLocation={listing.asset.location.approximateLocation}
        label={title}
      />

      {nearby.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{d.nearbyTitle}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((item) => (
              <ListingCard key={item.id} item={item} locale={l} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
