import { t, type MessageKey } from "@/i18n/th";
import { NAV } from "./nav";

export function ComingSoon({ href }: { href: string }) {
  const item = NAV.find((n) => n.href === href);
  if (!item) return null;
  return <PageHeader title={item.label} description={t("page.comingIn", { phase: item.phase })} />;
}

export function PageHeader({ title, description }: { title: MessageKey; description?: string }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t(title)}</h1>
      {description && <p className="mt-1 text-ink-muted">{description}</p>}
    </div>
  );
}
