import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/listing-card";
import { ListingInquiryForms } from "@/components/listing-inquiry-forms";
import { OsmMapEmbed } from "@/components/osm-map";
import { buildLocaleAlternates, dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";
import { buildListingJsonLd, fetchPublicListingBySlug } from "@/lib/public-api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const ATTR_LABELS_TH: Record<string, string> = {
  land: "ขนาดที่ดิน",
  buildingAreaSqm: "พื้นที่อาคาร (ตร.ม.)",
  powerKva: "หม้อแปลงไฟฟ้า (kVA)",
  ceilingHeightM: "ความสูงเพดาน (ม.)",
  floorLoadKgSqm: "รับน้ำหนักพื้น (กก./ตร.ม.)",
  hasFactoryLicense: "ใบอนุญาตโรงงาน (รง.4)",
  commonFeePerSqm: "ค่าส่วนกลาง (บาท/ตร.ม.)",
  parkingSlots: "ที่จอดรถ (คัน)",
  facing: "ทิศ",
  stories: "จำนวนชั้น",
  frontageM: "หน้ากว้าง (ม.)",
  depthM: "ความลึก (ม.)",
  zoningColor: "ผังเมือง",
};

function formatAttributePair(key: string, val: unknown, locale: Locale): string {
  const label = locale === "th" ? (ATTR_LABELS_TH[key] ?? key) : key;
  if (key === "land" && val && typeof val === "object") {
    const land = val as { rai?: number; ngan?: number; sqWah?: number };
    return locale === "th"
      ? `${label}: ${land.rai ?? 0} ไร่ ${land.ngan ?? 0} งาน ${land.sqWah ?? 0} ตร.วา`
      : `${label}: ${land.rai ?? 0}-${land.ngan ?? 0}-${land.sqWah ?? 0} Rai-Ngan-SqWah`;
  }
  if (typeof val === "boolean") {
    return `${label}: ${locale === "th" ? (val ? "มี / รองรับ" : "ไม่มี") : val ? "Yes" : "No"}`;
  }
  return `${label}: ${typeof val === "object" ? JSON.stringify(val) : String(val)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const data = await fetchPublicListingBySlug(slug);
  if (!data) return { title: d.brand };
  const title = l === "th" ? data.listing.titleTh : data.listing.titleEn || data.listing.titleTh;
  const desc = l === "th" ? data.listing.descriptionTh : data.listing.descriptionEn || data.listing.descriptionTh;
  return {
    title: `${title} | ${d.brand}`,
    description: desc ?? title,
    alternates: { languages: buildLocaleAlternates(`/listings/${slug}`) },
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
  const title = l === "th" ? listing.titleTh : listing.titleEn || listing.titleTh;
  const description = l === "th" ? listing.descriptionTh : listing.descriptionEn || listing.descriptionTh;
  const priceSuffix = listing.type === "RENT" ? d.priceSuffixRent : d.priceSuffixSale;
  const jsonLd = buildListingJsonLd(listing, l);
  const mediaList = listing.asset.media ?? [];
  const hasCoords = listing.asset.location.latitude !== null && listing.asset.location.longitude !== null;

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

        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>{[listing.asset.project?.name, listing.asset.district, listing.asset.province].filter(Boolean).join(" · ")}</span>
          {hasCoords && (
            <a
              href={`https://www.google.com/maps?q=${encodeURIComponent(`${listing.asset.location.latitude},${listing.asset.location.longitude}`)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-lagoon hover:underline"
            >
              📍 เปิดดูพิกัดบน Google Maps ↗
            </a>
          )}
        </div>

        <p className="mt-4 text-2xl font-bold text-lagoon">
          {listing.price.toLocaleString()} <span className="text-sm font-normal text-slate-600">{priceSuffix}</span>
        </p>

        {mediaList.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {mediaList.map((m, idx) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${idx === 0 && mediaList.length > 1 ? "sm:col-span-2 sm:row-span-2" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.caption ?? `${title} #${idx + 1}`}
                  className={`w-full object-cover transition hover:scale-105 ${idx === 0 && mediaList.length > 1 ? "h-64 sm:h-80" : "h-44"}`}
                />
              </a>
            ))}
          </div>
        )}

        {description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{description}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
          {listing.asset.areaSqm !== null && (
            <div><dt className="text-xs text-slate-500">{d.specArea}</dt><dd className="font-semibold text-slate-900">{listing.asset.areaSqm} sqm</dd></div>
          )}
          {listing.asset.bedrooms !== null && (
            <div><dt className="text-xs text-slate-500">{d.specBedrooms}</dt><dd className="font-semibold text-slate-900">{listing.asset.bedrooms}</dd></div>
          )}
          {listing.asset.bathrooms !== null && (
            <div><dt className="text-xs text-slate-500">{d.specBathrooms}</dt><dd className="font-semibold text-slate-900">{listing.asset.bathrooms}</dd></div>
          )}
          {listing.asset.floor !== null && (
            <div><dt className="text-xs text-slate-500">{d.specFloor}</dt><dd className="font-semibold text-slate-900">{listing.asset.floor}</dd></div>
          )}
        </dl>

        {Object.keys(listing.asset.attributes).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
            {Object.entries(listing.asset.attributes).map(([k, v]) => (
              <span key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
                {formatAttributePair(k, v, l)}
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

      <ListingInquiryForms listingId={listing.id} assetCode={listing.asset.code} locale={l} />

      {nearby.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{d.nearbyTitle}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((item) => <ListingCard key={item.id} item={item} locale={l} />)}
          </div>
        </section>
      )}
    </main>
  );
}
