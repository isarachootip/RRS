"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dictionaries, type Locale } from "@/i18n/dictionaries";
import type { PublicListingItem } from "@/lib/public-api";

export const FAVORITES_STORAGE_KEY = "rrs_portal_favorites_v1";
export const COMPARE_STORAGE_KEY = "rrs_portal_compare_v1";

function readStoredList(key: string): PublicListingItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PublicListingItem[]) : [];
  } catch {
    return [];
  }
}

function writeStoredList(key: string, items: PublicListingItem[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event("rrs-storage-change"));
  } catch {
    // ignore storage errors
  }
}

export function ListingCard({ item, locale }: { item: PublicListingItem; locale: Locale }) {
  const d = dictionaries[locale];
  const title = locale === "th" ? item.titleTh : item.titleEn || item.titleTh;
  const priceSuffix = item.type === "RENT" ? d.priceSuffixRent : d.priceSuffixSale;
  const [isFav, setIsFav] = useState(false);
  const [isCompared, setIsCompared] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIsFav(readStoredList(FAVORITES_STORAGE_KEY).some((x) => x.id === item.id));
      setIsCompared(readStoredList(COMPARE_STORAGE_KEY).some((x) => x.id === item.id));
    };
    sync();
    window.addEventListener("rrs-storage-change", sync);
    return () => window.removeEventListener("rrs-storage-change", sync);
  }, [item.id]);

  const toggleFav = () => {
    const current = readStoredList(FAVORITES_STORAGE_KEY);
    const exists = current.some((x) => x.id === item.id);
    writeStoredList(FAVORITES_STORAGE_KEY, exists ? current.filter((x) => x.id !== item.id) : [...current, item]);
  };

  const toggleCompare = () => {
    const current = readStoredList(COMPARE_STORAGE_KEY);
    const exists = current.some((x) => x.id === item.id);
    if (exists) {
      writeStoredList(
        COMPARE_STORAGE_KEY,
        current.filter((x) => x.id !== item.id),
      );
      return;
    }
    writeStoredList(COMPARE_STORAGE_KEY, [...current.slice(-3), item]);
  };

  return (
    <article
      data-testid="listing-card"
      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-lagoon">
            {item.type === "RENT" ? d.txRent : d.txSale} · {item.asset.category}
          </span>
          <span className="font-mono text-slate-500">{item.asset.code}</span>
        </div>

        <h3 className="text-base font-semibold text-slate-900">
          <Link href={`/${locale}/listings/${item.slug}`} className="hover:text-lagoon">
            {title}
          </Link>
        </h3>

        <p className="mt-1 text-xs text-slate-600">
          {[item.asset.project?.name, item.asset.district, item.asset.province].filter(Boolean).join(" · ")}
        </p>

        <p className="mt-3 text-lg font-bold text-lagoon">
          {item.price.toLocaleString()} <span className="text-xs font-normal text-slate-600">{priceSuffix}</span>
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          {item.asset.areaSqm !== null && <span>{item.asset.areaSqm} sqm</span>}
          {item.asset.bedrooms !== null && (
            <span>
              {item.asset.bedrooms} {d.specBedrooms}
            </span>
          )}
          {item.asset.petAllowed && <span className="text-emerald-700">✓ {d.specPet}</span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleFav}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {isFav ? `♥ ${d.favSaved}` : `♡ ${d.favSave}`}
          </button>
          <button
            type="button"
            onClick={toggleCompare}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {isCompared ? `✓ ${d.compareAdded}` : `⇄ ${d.compareAdd}`}
          </button>
        </div>
        <Link
          href={`/${locale}/listings/${item.slug}`}
          className="rounded-lg bg-lagoon px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          {d.viewDetail}
        </Link>
      </div>
    </article>
  );
}
