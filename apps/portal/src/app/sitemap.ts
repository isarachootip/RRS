import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/dictionaries";
import { fetchPublicListings } from "@/lib/public-api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rrs.co.th";
  const { items } = await fetchPublicListings({ pageSize: "50" });

  const staticRoutes: MetadataRoute.Sitemap = LOCALES.flatMap((locale) => [
    { url: `${baseUrl}/${locale}`, changeFrequency: "daily" as const, priority: 1.0 },
    { url: `${baseUrl}/${locale}/listings`, changeFrequency: "hourly" as const, priority: 0.9 },
    { url: `${baseUrl}/${locale}/privacy`, changeFrequency: "monthly" as const, priority: 0.5 },
  ]);

  const listingRoutes: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    items.map((item) => ({
      url: `${baseUrl}/${locale}/listings/${item.slug}`,
      lastModified: item.publishedAt ? new Date(item.publishedAt) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  );

  return [...staticRoutes, ...listingRoutes];
}
