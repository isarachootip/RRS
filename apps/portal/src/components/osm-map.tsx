import { dictionaries, type Locale } from "@/i18n/dictionaries";

export function OsmMapEmbed({
  locale,
  latitude,
  longitude,
  approximateLocation,
  label,
}: {
  locale: Locale;
  latitude: number | null;
  longitude: number | null;
  approximateLocation?: boolean;
  label?: string;
}) {
  const d = dictionaries[locale];
  const lat = latitude ?? 13.7367;
  const lng = longitude ?? 100.5632;
  const delta = approximateLocation ? 0.02 : 0.008;
  const bbox = `${(lng - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lng + delta).toFixed(4)},${(lat + delta).toFixed(4)}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="osm-map">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {d.mapTitle} {label ? `· ${label}` : ""}
        </h3>
        <span className="font-mono text-xs text-slate-500">
          {lat.toFixed(approximateLocation ? 2 : 4)}, {lng.toFixed(approximateLocation ? 2 : 4)}
        </span>
      </div>
      {approximateLocation && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{d.mapApproximateNote}</p>
      )}
      <div className="h-56 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <iframe
          title={label ?? d.mapTitle}
          src={osmUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}
