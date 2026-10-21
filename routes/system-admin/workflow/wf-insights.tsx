import { Activity, Clock, EyeOff, Users } from "lucide-react";
import { useTranslations } from "use-intl";
import { EyeBrow } from "@/components/ui/eye-brow";
import type { Stage } from "@/types/workflows";
import { ROLE_LABEL } from "./wf-role-colors";
import { formatCycleTime } from "./wf-sla-utils";
import {
  computeWorkflowInsights,
  type ActionKey,
  type RecipientKey,
  type WorkflowInsights,
} from "./wf-insights-utils";

interface WfInsightsProps {
  readonly stages: Stage[];
  readonly productCount?: number;
  readonly routingCount?: number;
}

const ACTION_LABEL: Record<ActionKey, string> = {
  submit: "actionSubmit",
  approve: "actionApprove",
  reject: "actionReject",
  sendback: "actionSendBack",
};

const RECIPIENT_LABEL: Record<RecipientKey, string> = {
  requestor: "recipientRequestor",
  current_approve: "recipientCurrentApprove",
  next_step: "recipientNextStep",
};

export default function WfInsights({
  stages,
  productCount = 0,
  routingCount = 0,
}: WfInsightsProps) {
  const t = useTranslations("systemAdmin.workflow");

  if (!stages || stages.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {t("noStages")}
      </p>
    );
  }

  const insights = computeWorkflowInsights(stages);

  return (
    <div className="space-y-6 pt-4">
      <QuickStats
        insights={insights}
        productCount={productCount}
        routingCount={routingCount}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SlaBreakdown insights={insights} />
        <RoleDistribution insights={insights} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionCoverage insights={insights} />
        <RecipientCoverage insights={insights} />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  empty,
}: {
  readonly title: string;
  readonly icon: typeof Clock;
  readonly children?: React.ReactNode;
  readonly empty?: boolean;
}) {
  return (
    <section className="bg-card rounded-xl border p-4">
      <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-muted-foreground size-4" aria-hidden="true" />
        {title}
      </h3>
      {empty ? <p className="text-muted-foreground text-xs">—</p> : children}
    </section>
  );
}

function StatTile({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) {
  return (
    <div className="min-w-0">
      <EyeBrow className="truncate">{label}</EyeBrow>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickStats({
  insights,
  productCount,
  routingCount,
}: {
  readonly insights: WorkflowInsights;
  readonly productCount: number;
  readonly routingCount: number;
}) {
  const t = useTranslations("systemAdmin.workflow");
  const { stats, totalCycleMinutes } = insights;
  const cycle = formatCycleTime(totalCycleMinutes) || "—";

  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-3 border-b pb-4 sm:grid-cols-6">
      <StatTile label={t("statCycleTime")} value={cycle} />
      <StatTile label={t("statApprovers")} value={stats.approverStages} />
      <StatTile label={t("statHod")} value={stats.hodStages} />
      <StatTile label={t("statTotalUsers")} value={stats.totalUsers} />
      <StatTile label={t("statRoutingRules")} value={routingCount} />
      <StatTile label={t("statProducts")} value={productCount} />
    </div>
  );
}

function SlaBreakdown({ insights }: { readonly insights: WorkflowInsights }) {
  const t = useTranslations("systemAdmin.workflow");
  const { stageSla, maxStageMinutes } = insights;
  const middleRows = stageSla.filter((r) => !r.isLast);

  if (middleRows.length === 0 || maxStageMinutes === 0) {
    return <SectionCard title={t("insightsSlaTitle")} icon={Clock} empty />;
  }

  return (
    <SectionCard title={t("insightsSlaTitle")} icon={Clock}>
      <ul className="space-y-3">
        {middleRows.map((row) => {
          const pct = maxStageMinutes
            ? Math.max(4, Math.round((row.minutes / maxStageMinutes) * 100))
            : 0;
          const cycle = formatCycleTime(row.minutes) || "0";
          return (
            <li key={`sla-${row.index}-${row.name}`} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate" title={row.name}>
                  {row.name}
                </span>
                <span className="text-muted-foreground shrink-0 font-medium tabular-nums">
                  {cycle}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={row.minutes}
                  aria-valuemax={maxStageMinutes}
                  aria-label={`${row.name} SLA`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function RoleDistribution({
  insights,
}: {
  readonly insights: WorkflowInsights;
}) {
  const t = useTranslations("systemAdmin.workflow");
  const { roleDistribution } = insights;
  const total = roleDistribution.reduce((sum, r) => sum + r.count, 0);

  return (
    <SectionCard
      title={t("insightsRoleTitle")}
      icon={Users}
      empty={total === 0}
    >
      <ul className="space-y-3">
        {roleDistribution.map((row) => {
          const pct = total ? Math.round((row.count / total) * 100) : 0;
          return (
            <li key={row.role} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="capitalize">{t(ROLE_LABEL[row.role])}</span>
                <span className="text-muted-foreground shrink-0 font-medium tabular-nums">
                  {row.count} ({pct}%)
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={row.count}
                  aria-valuemax={total}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function ActionCoverage({ insights }: { readonly insights: WorkflowInsights }) {
  const t = useTranslations("systemAdmin.workflow");
  const { actionCoverage } = insights;
  const empty = actionCoverage.every((r) => r.totalStages === 0);

  return (
    <SectionCard title={t("insightsActionTitle")} icon={Activity} empty={empty}>
      <ul className="space-y-3">
        {actionCoverage.map((row) => {
          const pct = row.totalStages
            ? Math.round((row.activeCount / row.totalStages) * 100)
            : 0;
          return (
            <li key={row.action} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span>{t(ACTION_LABEL[row.action])}</span>
                <span className="text-muted-foreground shrink-0 font-medium tabular-nums">
                  {row.activeCount}/{row.totalStages}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className={"bg-primary h-full rounded-full"}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={row.activeCount}
                  aria-valuemax={row.totalStages}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function RecipientCoverage({
  insights,
}: {
  readonly insights: WorkflowInsights;
}) {
  const t = useTranslations("systemAdmin.workflow");
  const { recipientCoverage } = insights;
  const empty = recipientCoverage.every((r) => r.totalActiveActions === 0);

  return (
    <SectionCard
      title={t("insightsRecipientTitle")}
      icon={EyeOff}
      empty={empty}
    >
      <ul className="space-y-3">
        {recipientCoverage.map((row) => {
          const pct = row.totalActiveActions
            ? Math.round((row.count / row.totalActiveActions) * 100)
            : 0;
          return (
            <li key={row.recipient} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span>{t(RECIPIENT_LABEL[row.recipient])}</span>
                <span className="text-muted-foreground shrink-0 font-medium tabular-nums">
                  {row.count}/{row.totalActiveActions}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={row.count}
                  aria-valuemax={row.totalActiveActions}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
