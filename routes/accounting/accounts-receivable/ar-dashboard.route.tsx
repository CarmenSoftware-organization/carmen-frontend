import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useBuCode } from "@/hooks/use-bu-code";
import type { DashboardMetric } from "@/types/accounting-dashboard";
import { AccountingDashboardPage } from "../dashboard/accounting-dashboard-page";
import { getAccountingDashboardSnapshot } from "../dashboard/dashboard-mock-data";
import { folioSummary, readFolioSamples } from "./ar-folio-model";

export function Component() {
  const bu = useBuCode();
  return bu ? <ArDashboard key={bu} bu={bu} /> : null;
}

function ArDashboard({ bu }: { readonly bu: string }) {
  const t = useTranslations("accounting.arFolio");
  const [folios, setFolios] = useState(() => readFolioSamples(bu));
  const snapshot = getAccountingDashboardSnapshot("accountsReceivable");
  const summary = folioSummary(folios);
  const scope = t("summary.scope");
  const metrics = (["count", "total", "unbilled", "billed"] as const).map(
    (key): DashboardMetric => {
      const label = t(`summary.${key}`);
      return {
        id: `folio-${key}`,
        label: { en: label, th: label },
        value: summary[key],
        format: key === "count" ? "number" : "currency",
        detail: { en: scope, th: scope },
        href: "/accounting/accounts-receivable/folio?status=all",
      };
    },
  );
  return (
    <AccountingDashboardPage
      mock
      snapshot={{
        ...snapshot,
        operational: {
          ...snapshot.operational,
          metrics: [...snapshot.operational.metrics, ...metrics],
        },
      }}
      onRefresh={() => {
        try {
          setFolios(readFolioSamples(bu));
        } catch {
          toast.error(t("loadError"));
        }
      }}
    />
  );
}
