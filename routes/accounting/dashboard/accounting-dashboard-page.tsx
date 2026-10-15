import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale } from "use-intl";
import { useNavigate, useSearchParams } from "react-router";
import { CartesianGrid, Line, LineChart } from "recharts";
import { DocumentListHeader } from "@/components/share/document-list-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bar,
  BarChart,
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "@/components/ui/chart";
import { DatePicker } from "@/components/ui/date-picker";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AccountingDashboardAudience,
  AccountingDashboardRole,
  AccountingDashboardSnapshot,
  CashForecastScenario,
  DashboardAnalysis,
  DashboardMetric,
  DashboardTask,
  DashboardTone,
  LocalizedDashboardText,
} from "@/types/accounting-dashboard";
import { buildCashForecast } from "./cash-forecast";
import { CashForecastPanel } from "./cash-forecast-panel";
import { ROLE_ACCESS, resolveDashboardAudience } from "./dashboard-access";

const TONE_CLASS: Record<DashboardTone, string> = {
  neutral: "border-border bg-card text-foreground",
  primary: "border-primary/25 bg-primary/[0.055] text-primary",
  info: "border-info/25 bg-info/[0.07] text-info-ink",
  success: "border-success/30 bg-success/[0.09] text-success-ink",
  warning: "border-warning/35 bg-warning/[0.1] text-warning-ink",
  destructive: "border-destructive/30 bg-destructive/[0.065] text-destructive",
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const NUMBER_FORMATTERS = new Map<string, Intl.NumberFormat>();

function numberFormatter(
  locale: string,
  kind: "currency" | "compact" | "number",
) {
  const key = `${locale}:${kind}`;
  const existing = NUMBER_FORMATTERS.get(key);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat(
    locale,
    kind === "currency"
      ? { style: "currency", currency: "THB", maximumFractionDigits: 0 }
      : kind === "compact"
        ? { notation: "compact", maximumFractionDigits: 1 }
        : undefined,
  );
  NUMBER_FORMATTERS.set(key, formatter);
  return formatter;
}

export function AccountingDashboardPage({
  snapshot,
  isLoading = false,
  error,
  onRefresh,
  asOf: controlledAsOf,
  onAsOfChange,
  mock = false,
}: {
  readonly snapshot: AccountingDashboardSnapshot;
  readonly isLoading?: boolean;
  readonly error?: Error | null;
  readonly onRefresh?: () => void;
  readonly asOf?: string;
  readonly onAsOfChange?: (value: string) => void;
  /** snapshot มาจาก dashboard-mock-data → แสดงป้าย MOCK */
  readonly mock?: boolean;
}) {
  const locale = useLocale();
  const isThai = locale.startsWith("th");
  const localize = (value: LocalizedDashboardText) =>
    value[isThai ? "th" : "en"];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [localAsOf, setLocalAsOf] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const asOf = controlledAsOf ?? localAsOf;
  const setAsOf = onAsOfChange ?? setLocalAsOf;
  const previewEnabled = import.meta.env.DEV;
  const requestedRole = params.get(
    "preview_role",
  ) as AccountingDashboardRole | null;
  const role =
    previewEnabled && requestedRole && requestedRole in ROLE_ACCESS
      ? requestedRole
      : previewEnabled
        ? "controller"
        : "accountant";
  const allowedViews = ROLE_ACCESS[role];
  const requestedView = params.get(
    "dashboard_view",
  ) as AccountingDashboardAudience | null;
  const audience = resolveDashboardAudience(role, requestedView);
  const requestedScenario = params.get(
    "scenario",
  ) as CashForecastScenario | null;
  const scenario: CashForecastScenario =
    requestedScenario && ["base", "best", "worst"].includes(requestedScenario)
      ? requestedScenario
      : "base";
  const forecast = useMemo(
    () => buildCashForecast(scenario, asOf),
    [scenario, asOf],
  );
  const content = snapshot[audience];

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  const changeRole = (nextRole: AccountingDashboardRole) => {
    const next = new URLSearchParams(params);
    next.set("preview_role", nextRole);
    const permitted = ROLE_ACCESS[nextRole];
    if (!permitted.includes(audience)) next.set("dashboard_view", permitted[0]);
    setParams(next, { replace: true });
  };

  if (error) {
    return (
      <ErrorState
        message={
          isThai
            ? "ไม่สามารถโหลดแดชบอร์ดบัญชี"
            : "Unable to load accounting dashboard"
        }
        error={error}
        onRetry={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <DocumentListHeader
          title={localize(snapshot.title)}
          description={localize(snapshot.description)}
          mock={mock}
        />
        <div className="flex flex-wrap items-end gap-2">
          {previewEnabled && (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3" aria-hidden="true" />
                {isThai ? "ดูตัวอย่างตามบทบาท" : "Preview role"}
              </span>
              <Select
                value={role}
                onValueChange={(value) =>
                  changeRole(value as AccountingDashboardRole)
                }
              >
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="controller">Controller</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              {isThai ? "ข้อมูล ณ วันที่" : "As of"}
            </span>
            <DatePicker
              value={asOf}
              onValueChange={setAsOf}
              hideClear
              className="w-32"
            />
          </label>
          <div className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              {isThai ? "งวดบัญชี" : "Period"}
            </span>
            <Badge
              variant="outline"
              className="h-8 rounded-md px-3 font-medium"
            >
              {snapshot.period}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={isThai ? "รีเฟรชแดชบอร์ด" : "Refresh dashboard"}
            onClick={onRefresh}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        {allowedViews.length > 1 ? (
          <Tabs
            value={audience}
            onValueChange={(value) => updateParam("dashboard_view", value)}
          >
            <TabsList variant="line">
              <TabsTrigger value="operational">
                <BriefcaseBusiness className="size-3.5" />
                {isThai ? "งานประจำวัน" : "Operational"}
              </TabsTrigger>
              <TabsTrigger value="management">
                <TrendingUp className="size-3.5" />
                {isThai ? "ภาพรวมบริหาร" : "Management"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <Badge variant="secondary" className="gap-1.5">
            <Users className="size-3" />
            {audience === "operational"
              ? isThai
                ? "งานประจำวัน"
                : "Operational"
              : isThai
                ? "ภาพรวมบริหาร"
                : "Management"}
          </Badge>
        )}
        <p className="text-muted-foreground text-xs">
          {isThai ? "รีเฟรชล่าสุด" : "Last refreshed"}{" "}
          {new Date(snapshot.generatedAt).toLocaleString(locale)}
        </p>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <Tabs value={audience} className="gap-4">
          <TabsContent value={audience} className="space-y-4">
            <section
              aria-label={isThai ? "ตัวชี้วัดสำคัญ" : "Key metrics"}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {content.metrics.map((item) => (
                <MetricCard
                  key={item.id}
                  metric={item}
                  locale={locale}
                  localize={localize}
                  onOpen={item.href ? () => navigate(item.href!) : undefined}
                />
              ))}
            </section>

            {audience === "management" && (
              <CashForecastPanel
                forecast={forecast}
                scenario={scenario}
                onScenarioChange={(value) => updateParam("scenario", value)}
              />
            )}

            <section
              className="grid grid-cols-1 gap-3 xl:grid-cols-2"
              aria-label={isThai ? "การวิเคราะห์" : "Analysis"}
            >
              {content.analyses.map((analysis) => (
                <AnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  locale={locale}
                  localize={localize}
                />
              ))}
            </section>

            <ActionQueue
              tasks={content.tasks}
              localize={localize}
              isThai={isThai}
              onOpen={(href) => navigate(href)}
            />

            <div
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${snapshot.reconciliationVariance === 0 ? "border-success/30 bg-success/[0.07]" : "border-destructive/30 bg-destructive/[0.06]"}`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                {snapshot.reconciliationVariance === 0 ? (
                  <CheckCircle2 className="text-success-ink size-4" />
                ) : (
                  <ShieldAlert className="text-destructive size-4" />
                )}
                {snapshot.reconciliationVariance === 0
                  ? isThai
                    ? "กระทบยอดแล้ว ผลต่าง 0.00"
                    : "Reconciled, variance 0.00"
                  : `${isThai ? "ผลต่างการกระทบยอด" : "Reconciliation variance"}: ${snapshot.reconciliationVariance.toLocaleString(locale)}`}
              </span>
              <span className="text-muted-foreground">
                {snapshot.currency} ·{" "}
                {isThai
                  ? "ขอบเขต BU และสิทธิ์ปัจจุบัน"
                  : "Current BU and permission scope"}
              </span>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function MetricCard({
  metric,
  locale,
  localize,
  onOpen,
}: {
  readonly metric: DashboardMetric;
  readonly locale: string;
  readonly localize: (value: LocalizedDashboardText) => string;
  readonly onOpen?: () => void;
}) {
  const value = formatValue(metric.value, metric.format, locale);
  const Icon =
    metric.tone === "destructive"
      ? AlertCircle
      : metric.tone === "warning"
        ? Clock3
        : metric.tone === "success"
          ? CheckCircle2
          : Calculator;
  const card = (
    <Card
      className={`h-full gap-2 py-4 transition-colors ${TONE_CLASS[metric.tone ?? "neutral"]}`}
    >
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="text-foreground text-sm">
          {localize(metric.label)}
        </CardTitle>
        <Icon className="size-4" aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-foreground text-2xl font-semibold tabular-nums">
          {value}
        </p>
        <p className="text-foreground/75 mt-1 text-xs">
          {localize(metric.detail)}
        </p>
      </CardContent>
    </Card>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="focus-visible:ring-ring rounded-xl text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      {card}
    </button>
  ) : (
    card
  );
}

function AnalysisCard({
  analysis,
  locale,
  localize,
}: {
  readonly analysis: DashboardAnalysis;
  readonly locale: string;
  readonly localize: (value: LocalizedDashboardText) => string;
}) {
  const config = {
    value: { label: localize(analysis.valueLabel), color: "var(--chart-1)" },
    secondary: {
      label: analysis.secondaryLabel ? localize(analysis.secondaryLabel) : "",
      color: "var(--chart-3)",
    },
  };
  const formatter = (value: number) =>
    formatValue(value, analysis.format, locale);
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="text-primary size-4" />
          {localize(analysis.title)}
        </CardTitle>
        <CardDescription className="text-xs">
          {localize(analysis.description)}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {analysis.kind === "bar" && (
          <ChartContainer config={config} className="aspect-auto h-52 w-full">
            <BarChart
              data={analysis.data}
              layout="vertical"
              margin={{ left: 2, right: 34 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={78}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatter(Number(value))}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[0, 3, 3, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ChartContainer>
        )}
        {analysis.kind === "line" && (
          <>
            <div className="mb-2 flex gap-4 text-xs">
              <ChartLegendDot
                color="var(--chart-1)"
                label={localize(analysis.valueLabel)}
              />
              {analysis.secondaryLabel && (
                <ChartLegendDot
                  color="var(--chart-3)"
                  label={localize(analysis.secondaryLabel)}
                />
              )}
            </div>
            <ChartContainer config={config} className="aspect-auto h-48 w-full">
              <LineChart
                data={analysis.data}
                margin={{ left: 0, right: 12, top: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value) =>
                    numberFormatter(locale, "compact").format(Number(value))
                  }
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatter(Number(value))}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2.25}
                  dot={{ r: 2 }}
                />
                {analysis.secondaryLabel && (
                  <Line
                    type="monotone"
                    dataKey="secondary"
                    stroke="var(--color-secondary)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 2 }}
                  />
                )}
              </LineChart>
            </ChartContainer>
          </>
        )}
        {analysis.kind === "donut" && (
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3">
            <ChartContainer config={config} className="aspect-square h-36 w-36">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatter(Number(value))}
                    />
                  }
                />
                <Pie
                  data={analysis.data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={34}
                  outerRadius={58}
                  paddingAngle={2}
                >
                  {analysis.data.map((point, index) => (
                    <Cell
                      key={point.label}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="space-y-2 text-xs">
              {analysis.data.map((point, index) => (
                <li key={point.label} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{point.label}</span>
                  <span className="font-semibold tabular-nums">
                    {formatter(point.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionQueue({
  tasks,
  localize,
  isThai,
  onOpen,
}: {
  readonly tasks: DashboardTask[];
  readonly localize: (value: LocalizedDashboardText) => string;
  readonly isThai: boolean;
  readonly onOpen: (href: string) => void;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">
          {isThai ? "งานและความเสี่ยงที่ต้องติดตาม" : "Actions and risks"}
        </CardTitle>
        <CardDescription className="text-xs">
          {isThai
            ? "เรียงตามความเร่งด่วนและเปิดรายการต้นทางได้"
            : "Prioritized work with direct access to source records"}
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y px-4">
        {tasks.map((item) => {
          const content = (
            <>
              <span
                className={`mt-0.5 size-2.5 shrink-0 rounded-full ${item.tone === "destructive" ? "bg-destructive" : item.tone === "warning" ? "bg-warning" : item.tone === "success" ? "bg-success" : "bg-primary"}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {localize(item.title)}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {localize(item.detail)}
                </span>
              </span>
              <Badge variant="secondary" className="tabular-nums">
                {item.count}
              </Badge>
              {item.href && (
                <ArrowRight
                  className="text-muted-foreground size-4"
                  aria-hidden="true"
                />
              )}
            </>
          );
          return item.href ? (
            <button
              type="button"
              key={item.id}
              onClick={() => onOpen(item.href!)}
              className="hover:bg-accent focus-visible:ring-ring -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-md px-2 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {content}
            </button>
          ) : (
            <div key={item.id} className="flex items-start gap-3 py-3">
              {content}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChartLegendDot({
  color,
  label,
}: {
  readonly color: string;
  readonly label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function formatValue(
  value: number,
  format: DashboardMetric["format"] | DashboardAnalysis["format"],
  locale: string,
) {
  if (format === "currency")
    return numberFormatter(locale, "currency").format(value);
  if (format === "percent") return `${value.toLocaleString(locale)}%`;
  if (format === "days")
    return `${value.toLocaleString(locale)} ${locale.startsWith("th") ? "วัน" : "days"}`;
  return numberFormatter(locale, "number").format(value);
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton
          key={index}
          className={index > 3 ? "h-64 xl:col-span-2" : "h-28"}
        />
      ))}
    </div>
  );
}
