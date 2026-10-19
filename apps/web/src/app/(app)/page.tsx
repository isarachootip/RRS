import { PageHeader } from "@/components/coming-soon";
import { t } from "@/i18n/th";

export default function DashboardPage() {
  return <PageHeader title="dashboard.title" description={t("dashboard.intro")} />;
}
