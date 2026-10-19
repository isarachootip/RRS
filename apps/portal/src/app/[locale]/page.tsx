import type { Metadata } from "next";
import Link from "next/link";
import { dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const d = dictionaries[isLocale(locale) ? locale : "th"];
  return { title: d.title, description: d.intro, alternates: { languages: { th: "/th", en: "/en" } } };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const other: Locale = l === "th" ? "en" : "th";
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <nav className="mb-12 flex justify-end">
        <Link href={`/${other}`} hrefLang={other} className="text-sm text-lagoon underline-offset-4 hover:underline">
          {d.switchTo}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-tight">{d.title}</h1>
      <p className="mt-4 max-w-prose text-lg text-ink-muted">{d.intro}</p>
      <p className="mt-10 border-l-4 border-lagoon pl-4">{d.soon}</p>
    </main>
  );
}
