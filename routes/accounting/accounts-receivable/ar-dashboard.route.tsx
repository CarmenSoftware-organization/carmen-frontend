import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useBuCode } from "@/hooks/use-bu-code";
import type {
  DashboardMetric,
  DashboardTask,
} from "@/types/accounting-dashboard";
import { AccountingDashboardPage } from "../dashboard/accounting-dashboard-page";
import { getAccountingDashboardSnapshot } from "../dashboard/dashboard-mock-data";
import { folioSummary, readFolioSamples } from "./ar-folio-model";
import {
  chequeSamples,
  outputTaxSamples,
} from "../operations/operations-model";
import {
  advanceDepositSummary,
  readAdvanceDeposits,
} from "./ar-advance-deposit-model";

export function Component() {
  const bu = useBuCode();
  return bu ? <ArDashboard key={bu} bu={bu} /> : null;
}

function ArDashboard({ bu }: { readonly bu: string }) {
  const t = useTranslations("accounting.arFolio");
  const td = useTranslations("accounting.operations.deposit");
  const tg = useTranslations("accounting.operations");
  const [folios, setFolios] = useState(() => readFolioSamples(bu));
  const [deposits, setDeposits] = useState(() => readAdvanceDeposits(bu));
  const depositSummary = advanceDepositSummary(deposits);
  const depositPath = "/accounts-receivable/advance-deposit";
  const depositMetrics = (["received", "applied", "available"] as const).map(
    (key): DashboardMetric => ({
      id: `advance-deposit-${key}`,
      label: {
        en: td(`dashboardLabels.${key}`),
        th: td(`dashboardLabels.${key}`),
      },
      value: depositSummary[key],
      format: "currency",
      detail: { en: td("scope"), th: td("scope") },
      href: depositPath,
    }),
  );
  const depositTask = {
    id: "advance-deposit",
    title: { en: td("dashboardTask"), th: td("dashboardTask") },
    detail: { en: td("dashboardDetail"), th: td("dashboardDetail") },
    count: deposits.filter(
      (row) => row.status === "available" || row.status === "partially_applied",
    ).length,
    tone: "neutral" as const,
    href: depositPath,
  };
  const snapshot = getAccountingDashboardSnapshot("accountsReceivable");
  const governanceTasks: DashboardTask[] = [
    {
      id: "ar-received-cheques",
      title: { en: tg("cheque.dashboardTask"), th: tg("cheque.dashboardTask") },
      detail: {
        en: tg("cheque.dashboardDetail"),
        th: tg("cheque.dashboardDetail"),
      },
      count: chequeSamples.length,
      tone: "neutral",
      href: "/accounts-receivable/cheque-reconciliation",
    },
    {
      id: "ar-output-vat-undue",
      title: { en: tg("tax.dashboardTask"), th: tg("tax.dashboardTask") },
      detail: { en: tg("tax.dashboardDetail"), th: tg("tax.dashboardDetail") },
      count: outputTaxSamples.filter(
        (row) => row.period === "2026-11" && row.taxPoint === "undue",
      ).length,
      tone: "warning",
      href: "/accounts-receivable/output-tax?taxPoint=undue",
    },
  ];
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
        href: "/accounts-receivable/folio?status=all",
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
          metrics: [
            ...snapshot.operational.metrics,
            ...metrics,
            ...depositMetrics,
          ],
          tasks: [
            ...snapshot.operational.tasks,
            depositTask,
            ...governanceTasks,
          ],
        },
        management: {
          ...snapshot.management,
          metrics: [...snapshot.management.metrics, ...depositMetrics],
          tasks: [
            ...snapshot.management.tasks,
            depositTask,
            ...governanceTasks,
          ],
        },
      }}
      onRefresh={() => {
        try {
          setFolios(readFolioSamples(bu));
          setDeposits(readAdvanceDeposits(bu));
        } catch {
          toast.error(t("loadError"));
        }
      }}
    />
  );
}
