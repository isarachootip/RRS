"use client";

import { use, useEffect, useState } from "react";
import { COMPARE_STORAGE_KEY, FAVORITES_STORAGE_KEY, ListingCard } from "@/components/listing-card";
import { dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";
import { buildPortalCardBadges, getPortalCategoryLabel } from "@/lib/category-specs";
import type { PublicListingItem } from "@/lib/public-api";

export default function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const [favorites, setFavorites] = useState<PublicListingItem[]>([]);
  const [compared, setCompared] = useState<PublicListingItem[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        const favRaw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
        const cmpRaw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
        setFavorites(favRaw ? (JSON.parse(favRaw) as PublicListingItem[]) : []);
        setCompared(cmpRaw ? (JSON.parse(cmpRaw) as PublicListingItem[]) : []);
      } catch {
        // ignore storage errors
      }
    };
    load();
    window.addEventListener("rrs-storage-change", load);
    return () => window.removeEventListener("rrs-storage-change", load);
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8" data-testid="compare-page">
      <h1 className="text-2xl font-bold text-slate-900">{d.compareTitle}</h1>

      {compared.length === 0 && favorites.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">{d.compareEmpty}</p>
      ) : (
        <>
          {compared.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    {compared.map((item) => (
                      <th key={item.id} className="px-4 py-3 font-semibold text-lagoon">
                        {l === "en" ? item.titleEn || item.titleTh : item.titleTh}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-medium">Category</td>
                    {compared.map((item) => (
                      <td key={item.id} className="px-4 py-3">
                        {getPortalCategoryLabel(item.asset.category, l, d)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Price</td>
                    {compared.map((item) => (
                      <td key={item.id} className="px-4 py-3 font-bold">
                        {item.price.toLocaleString()} THB
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">{d.specArea}</td>
                    {compared.map((item) => (
                      <td key={item.id} className="px-4 py-3">
                        {item.asset.areaSqm ?? "-"} sqm
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Specs</td>
                    {compared.map((item) => (
                      <td key={item.id} className="px-4 py-3 text-xs text-slate-700">
                        {buildPortalCardBadges(item.asset, l).join(" · ") || "-"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {favorites.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((item) => (
                <ListingCard key={item.id} item={item} locale={l} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
