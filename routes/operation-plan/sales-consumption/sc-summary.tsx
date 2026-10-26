import { useTranslations } from "use-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSalesConsumptionCalendar } from "./use-sales-consumption";

interface SummaryCardProps {
  readonly label: string;
  readonly value: number | undefined;
  readonly tone?: "warning" | "destructive";
}

function SummaryCard({ label, value, tone }: SummaryCardProps) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            value && tone === "warning" && "text-warning-ink",
            value && tone === "destructive" && "text-destructive",
          )}
        >
          {value ?? "–"}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * การ์ดสรุป 4 ใบของเดือน — คำนวณจากปฏิทินของเดือนนั้น
 *
 * @param month เดือน `YYYY-MM`
 * @returns React element ของการ์ดสรุป
 */
export function ScSummary({ month }: { month: string }) {
  const t = useTranslations("operationPlan.salesConsumption.list.summary");
  const { data } = useSalesConsumptionCalendar(month);
  const count = (status: string) =>
    data?.filter((d) => d.status === status).length;
  const unresolved = data?.reduce((n, d) => n + d.unresolved_count, 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        label={t("pendingPost")}
        value={count("pending")}
        tone="warning"
      />
      <SummaryCard label={t("needMapping")} value={unresolved} tone="warning" />
      <SummaryCard label={t("posted")} value={count("posted")} />
      <SummaryCard
        label={t("daysNoFile")}
        value={count("no_file")}
        tone="destructive"
      />
    </div>
  );
}
