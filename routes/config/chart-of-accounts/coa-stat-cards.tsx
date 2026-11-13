import { ListTree, CheckCircle2, PauseCircle, Building2, Layers } from "lucide-react";
import { useTranslations } from "use-intl";
import type { ChartOfAccount } from "@/types/chart-of-accounts";

interface CoaStatCardsProps {
  readonly accounts: ChartOfAccount[];
  readonly totalRecords?: number;
}

export function CoaStatCards({ accounts, totalRecords }: CoaStatCardsProps) {
  const t = useTranslations("config.chartOfAccounts.kpi");

  const total = totalRecords ?? accounts.length;
  const activeCount = accounts.filter((a) => a.is_active).length;
  const inactiveCount = accounts.filter((a) => !a.is_active).length;
  const reqCostCenterCount = accounts.filter(
    (a) => a.is_require_cost_center,
  ).length;
  const reqDimCount = accounts.filter(
    (a) => a.dimension_required || (a.allowed_dimensions && a.allowed_dimensions.length > 0),
  ).length;

  const cards = [
    {
      label: t("total"),
      value: total,
      icon: ListTree,
      iconColor: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    },
    {
      label: t("active"),
      value: activeCount,
      icon: CheckCircle2,
      iconColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    },
    {
      label: t("inactive"),
      value: inactiveCount,
      icon: PauseCircle,
      iconColor: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    },
    {
      label: t("reqCostCenter"),
      value: reqCostCenterCount,
      icon: Building2,
      iconColor: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
    },
    {
      label: t("reqDim"),
      value: reqDimCount,
      icon: Layers,
      iconColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 shadow-sm transition hover:bg-secondary/20"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-micro font-medium text-muted-foreground truncate">
                {card.label}
              </div>
              <div className="font-mono text-xl font-bold tracking-tight text-foreground">
                {card.value}
              </div>
            </div>
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${card.iconColor}`}>
              <Icon className="size-4.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
