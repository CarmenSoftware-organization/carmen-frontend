import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  CircleAlert,
  CircleCheck,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "use-intl";
import type { Stage } from "@/types/workflows";
import { cn } from "@/lib/utils";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { ROLE_ICON, ROLE_LABEL } from "./wf-role-colors";
import { formatCycleTime } from "./wf-sla-utils";
import { validateWorkflow } from "./wf-validate";
import { ROUTING_ISSUE_KEY, routingRuleIssue } from "./wf-routing-utils";
import {
  ACTIONS,
  computeWorkflowInsights,
  type ActionKey,
  type StageRow,
} from "./wf-insights-utils";

type RoutingRule = WorkflowCreateModel["data"]["routing_rules"][number];

/** ปลายทางเมื่อกดรายการใน Checks — แท็บ หรือ stage ที่มีปัญหา */
export type InsightsTarget =
  | { readonly tab: "stages"; readonly stageIndex?: number }
  | { readonly tab: "routing" | "products" };

interface WfInsightsProps {
  readonly stages: Stage[];
  readonly routingRules?: RoutingRule[];
  readonly productCount?: number;
  readonly workflowType?: string;
  readonly onNavigate?: (target: InsightsTarget) => void;
}

interface Check {
  readonly key: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly target: InsightsTarget;
}

const ACTION_LABEL: Record<ActionKey, string> = {
  submit: "actionSubmit",
  approve: "actionApprove",
  reject: "actionReject",
  sendback: "actionSendBack",
};

const TARGET_LABEL: Record<InsightsTarget["tab"], string> = {
  stages: "stages",
  routing: "routing",
  products: "statProducts",
};

export default function WfInsights({
  stages,
  routingRules = [],
  productCount = 0,
  workflowType,
  onNavigate,
}: WfInsightsProps) {
  const t = useTranslations("systemAdmin.workflow");

  if (!stages || stages.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {t("noStages")}
      </p>
    );
  }

  const insights = computeWorkflowInsights(stages, workflowType);
  const validation = validateWorkflow(stages, workflowType);
  const stageNames = stages.map((s) => s.name);

  // จุดตรวจเดียวก่อนกด Save — รางด้านซ้ายบอกได้แค่ปัญหาของแต่ละ stage ส่วนกฎ routing ที่ไม่มีวันตรง
  // กับ workflow ที่ยังไม่เลือกสินค้า (backend ตอบรายการสินค้าว่าง) ไม่มีที่ไหนรวมให้เห็น
  const checks: Check[] = [
    ...validation.issues
      .filter((i) => i.severity !== "info")
      .map((issue, n) => ({
        key: `stage-${n}-${issue.code}`,
        severity: issue.severity as Check["severity"],
        message: t(issue.translationKey, issue.translationValues),
        target: { tab: "stages", stageIndex: issue.stageIndex } as const,
      })),
    ...routingRules.flatMap((rule, n) => {
      const issue = routingRuleIssue(rule, stageNames);
      if (!issue) return [];
      return [
        {
          key: `rule-${n}`,
          severity: "warning" as const,
          message: t("insightsRuleIssue", {
            rule: rule.name || t("newRule", { n: n + 1 }),
            issue: t(ROUTING_ISSUE_KEY[issue]),
          }),
          target: { tab: "routing" } as const,
        },
      ];
    }),
    ...(productCount === 0
      ? [
          {
            key: "products",
            severity: "warning" as const,
            message: t("productsNoneSelectedWarning"),
            target: { tab: "products" } as const,
          },
        ]
      : []),
  ].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
  );

  const lastStageName = stages[stages.length - 1]?.name ?? "";
  const noUsersStages = new Set(
    validation.issues
      .filter((i) => i.code === "no_users_assigned")
      .map((i) => i.stageIndex),
  );

  return (
    <div className="space-y-8 pt-4">
      <Section
        title={t("insightsChecks")}
        aside={
          checks.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {[
                validation.errorCount > 0 &&
                  t("issueCountError", { count: validation.errorCount }),
                checks.length - validation.errorCount > 0 &&
                  t("issueCountWarning", {
                    count: checks.length - validation.errorCount,
                  }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )
        }
      >
        {checks.length === 0 ? (
          <p className="text-success-ink flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 shrink-0" />
            {t("insightsNoProblems")}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {checks.map((check) => (
              <CheckRow
                key={check.key}
                check={check}
                targetLabel={t(TARGET_LABEL[check.target.tab])}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("insightsJourney")}
        aside={
          <span className="text-muted-foreground text-xs">
            {t("statCycleTime")}{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatCycleTime(insights.totalCycleMinutes) || "—"}
            </span>
          </span>
        }
      >
        <Journey
          rows={insights.stageRows}
          totalMinutes={insights.totalCycleMinutes}
          endLabel={lastStageName}
        />
      </Section>

      <Section title={t("insightsMatrix")}>
        <StageMatrix
          rows={insights.stageRows}
          noUsersStages={noUsersStages}
          onSelectStage={
            onNavigate
              ? (index) => onNavigate({ tab: "stages", stageIndex: index })
              : undefined
          }
        />
      </Section>

      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-xs">
        {[
          [t("statApprovers"), insights.stats.approverStages],
          [t("statHod"), insights.stats.hodStages],
          [t("statTotalUsers"), insights.stats.totalUsers],
          [t("statRoutingRules"), routingRules.length],
          [t("statProducts"), productCount],
        ].map(([label, value]) => (
          <span key={label}>
            {label}{" "}
            <span className="text-foreground font-medium tabular-nums">
              {value.toLocaleString()}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  readonly title: string;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CheckRow({
  check,
  targetLabel,
  onNavigate,
}: {
  readonly check: Check;
  readonly targetLabel: string;
  readonly onNavigate?: (target: InsightsTarget) => void;
}) {
  const Icon = check.severity === "error" ? CircleAlert : TriangleAlert;
  const content = (
    <>
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          check.severity === "error" ? "text-destructive" : "text-warning-ink",
        )}
      />
      <span className="text-foreground min-w-0 flex-1 text-sm">
        {check.message}
      </span>
      {onNavigate && (
        <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center gap-1 text-xs">
          {targetLabel}
          <ArrowRight className="size-3" />
        </span>
      )}
    </>
  );
  return (
    <li>
      {onNavigate ? (
        <button
          type="button"
          className="group hover:bg-muted/50 flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
          onClick={() => onNavigate(check.target)}
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-2.5 px-3 py-2.5">{content}</div>
      )}
    </li>
  );
}

/**
 * แถบเดียวแบ่งช่วงตามสัดส่วน SLA ของแต่ละขั้น — ใช้สีหลักสีเดียว (DESIGN.md ไม่ให้แยก role ด้วยสี)
 * ขั้นที่ไม่ได้ตั้ง SLA ได้ช่องเล็กแบบเส้นประ จะได้ยังเห็นว่ามีขั้นนี้อยู่
 */
function Journey({
  rows,
  totalMinutes,
  endLabel,
}: {
  readonly rows: StageRow[];
  readonly totalMinutes: number;
  readonly endLabel: string;
}) {
  const t = useTranslations("systemAdmin.workflow");
  const floor = totalMinutes > 0 ? totalMinutes * 0.06 : 1;

  return (
    <div className="flex items-start gap-1">
      {rows.map((row) => (
        <div
          key={`${row.index}-${row.name}`}
          className="min-w-0 basis-0 space-y-1.5"
          style={{ flexGrow: Math.max(row.minutes, floor) }}
        >
          <div
            className={cn(
              "h-2.5 rounded-sm",
              row.minutes > 0
                ? "bg-primary/80"
                : "border-muted-foreground/40 border border-dashed",
            )}
          />
          <p className="truncate text-xs" title={row.name}>
            {row.name}
          </p>
          <p className="text-muted-foreground truncate text-xs tabular-nums">
            {row.minutes > 0
              ? formatCycleTime(row.minutes)
              : t("insightsNoSla")}
          </p>
        </div>
      ))}
      <div className="text-muted-foreground flex shrink-0 items-center gap-1 pl-1 text-xs leading-none">
        <ArrowRight className="size-3" />
        <span className="max-w-24 truncate">{endLabel}</span>
      </div>
    </div>
  );
}

function StageMatrix({
  rows,
  noUsersStages,
  onSelectStage,
}: {
  readonly rows: StageRow[];
  readonly noUsersStages: Set<number | undefined>;
  readonly onSelectStage?: (index: number) => void;
}) {
  const t = useTranslations("systemAdmin.workflow");
  const th = "text-muted-foreground px-2 py-2 text-xs font-medium";

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[40rem] text-xs">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className={cn(th, "pl-3 text-left")}>
              {t("insightsColStage")}
            </th>
            <th className={cn(th, "text-left")}>{t("insightsColUsers")}</th>
            <th className={cn(th, "text-left")}>SLA</th>
            {ACTIONS.map((action) => (
              <th key={action} className={cn(th, "text-center")}>
                {t(ACTION_LABEL[action])}
              </th>
            ))}
            <th className={cn(th, "pr-3 text-left")}>
              {t("insightsColHidden")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const RoleIcon = ROLE_ICON[row.role];
            const hidden = [
              row.hidePrice && t("insightsHiddenPrice"),
              row.hideTotal && t("insightsHiddenTotal"),
            ].filter(Boolean);
            return (
              <tr key={`${row.index}-${row.name}`}>
                <td className="py-2 pr-2 pl-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {RoleIcon && (
                      <RoleIcon
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-label={t(ROLE_LABEL[row.role])}
                      />
                    )}
                    {onSelectStage ? (
                      <button
                        type="button"
                        className="truncate font-medium hover:underline"
                        onClick={() => onSelectStage(row.index)}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <span className="truncate font-medium">{row.name}</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {row.isHod ? (
                    <span className="text-warning-ink font-medium">HOD</span>
                  ) : noUsersStages.has(row.index) ? (
                    <span className="text-destructive inline-flex items-center gap-1 font-medium">
                      <CircleAlert className="size-3.5" />0
                    </span>
                  ) : (
                    row.userCount
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {row.minutes > 0 ? (
                    formatCycleTime(row.minutes)
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                {ACTIONS.map((action) => {
                  const cell = row.actions[action];
                  return (
                    <td key={action} className="px-2 py-2 text-center">
                      {cell.active ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="bg-primary inline-block size-2 rounded-full"
                            aria-label={t(ACTION_LABEL[action])}
                          />
                          {cell.recipients > 0 && (
                            <span
                              className="text-muted-foreground inline-flex items-center gap-0.5 tabular-nums"
                              title={t("insightsRecipients", {
                                count: cell.recipients,
                              })}
                            >
                              <Bell className="size-3" />
                              {cell.recipients}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 pr-3 pl-2">
                  {hidden.length > 0 ? (
                    hidden.join(" · ")
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
