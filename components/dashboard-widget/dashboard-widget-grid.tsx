import {
  CircleX,
  Minus,
  TrendingDown,
  TrendingUp,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { useWidgetTitle } from "./use-widget-title";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTile, SubTile } from "@/components/icons/tiles";
import {
  StatusTile,
  WidgetParamsBadges,
} from "@/components/dashboard-widget/widget-status";
import { statusOf } from "@/components/dashboard-widget/status-meta";
import { cn } from "@/lib/utils";
import { useBuCode } from "@/hooks/use-bu-code";
import { Link, useNavigate } from "react-router";
import { useInViewport } from "@/hooks/use-in-viewport";
import {
  cellDocHref,
  docHref,
  idColumnKey,
} from "@/components/dashboard-widget/table-row-link";
import {
  applyDecimals,
  gaugeRange,
  gridClasses,
  thresholdColor,
} from "@/components/dashboard-widget/widget-display";
import { dashboardDatasetDataQueryOptions } from "@/hooks/use-dashboard-dataset";
import {
  isCategoricalData,
  isScalarDeltaData,
  isTableData,
  isTimeSeriesData,
  type CategoricalPoint,
  type CompositeWidgetItem,
  type DashboardDatasetDetail,
  type SystemWidgetConfigItem,
  type SystemWidgetConfigListResponse,
  type DatasetData,
  type DatasetMeta,
  type DatasetShape,
  type TableColumn,
  type TableData,
  type TimeSeriesPoint,
} from "@/types/dashboard-widget";

export type ResolvedWidget = CompositeWidgetItem & {
  readonly meta: DatasetMeta;
  readonly data: DatasetData<DatasetShape>;
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const WIDGET_TYPE_ORDER: Record<string, number> = {
  kpi: 0,
  gauge: 0,
  sparkline: 1,
  pie: 2,
  bar: 3,
  line: 4,
  area: 4,
  table: 5,
  heatmap: 6,
};

function humanizeLabel(label: string): string {
  return label.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: number, unit: string): string {
  if (unit === "฿") {
    return new Intl.NumberFormat("th-TH", {
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toLocaleString();
}

export interface DashboardWidgetGridProps {
  readonly title: string;
  readonly description: string;
  readonly moduleName: string;
  readonly subTileFor: (datasetId: string) => string;
  readonly query: UseQueryResult<SystemWidgetConfigListResponse>;
  readonly hiddenDatasets?: ReadonlySet<string>;
}

export function DashboardWidgetGrid({
  title,
  description,
  moduleName,
  subTileFor,
  query,
  hiddenDatasets,
}: DashboardWidgetGridProps) {
  const t = useTranslations("dashboardWidget");
  const { data, isLoading, isError, error } = query;

  const widgets = (data?.items ?? [])
    .filter((w) => !hiddenDatasets?.has(w.dataset_id))
    // ชนิดที่ยังไม่มี card รองรับ (gauge/sparkline/heatmap) เดิมก็ render ไม่ออกอยู่แล้ว
    // — คัดออกตรงนี้เพื่อไม่ให้กินช่องกริดเปล่าและไม่ยิง dataset ทิ้ง
    .filter((w) => RENDERABLE_TYPES.has(w.widget_type))
    .sort((a, b) => {
      const groupDiff =
        WIDGET_TYPE_ORDER[a.widget_type] - WIDGET_TYPE_ORDER[b.widget_type];
      if (groupDiff !== 0) return groupDiff;
      return a.order_index - b.order_index;
    });

  return (
    <div className="space-y-4 p-3">
      <header className="flex items-center gap-3">
        <AppTile name={moduleName} size={40} />
        <div className="min-w-0">
          <h1 className="text-lg leading-tight font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm leading-snug">
            {description}
          </p>
        </div>
      </header>

      {isError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm"
        >
          {t("loadError", { message: error?.message ?? "Unknown error" })}
        </div>
      )}

      <section
        aria-busy={isLoading}
        aria-live="polite"
        className="grid auto-rows-[4rem] grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12"
      >
        {isLoading ? (
          <WidgetSkeletonCards />
        ) : (
          widgets.map((w) => (
            <LazyWidgetCard
              key={w.dataset_id}
              config={w}
              moduleName={moduleName}
              subTileFor={subTileFor}
            />
          ))
        )}

        {!isLoading && !isError && widgets.length === 0 && (
          <p className="bg-muted/30 text-muted-foreground col-span-full rounded-lg border border-dashed p-6 text-center text-sm">
            {t("empty")}
          </p>
        )}
      </section>
    </div>
  );
}

interface WidgetCardProps {
  readonly widget: ResolvedWidget;
  readonly moduleName: string;
  readonly subTileFor: (datasetId: string) => string;
}

function skeletonVariantFor(widgetType: string): "kpi" | "bar" | "pie" {
  if (widgetType === "pie") return "pie";
  if (widgetType === "kpi" || widgetType === "gauge") return "kpi";
  return "bar";
}

const RENDERABLE_TYPES = new Set([
  "kpi",
  "gauge",
  "pie",
  "bar",
  "line",
  "area",
  "table",
]);

function resolveWidget(
  config: SystemWidgetConfigItem,
  detail: DashboardDatasetDetail | undefined,
): ResolvedWidget | undefined {
  const base = {
    // system widget ไม่มีแถวใน DB — ใช้ dataset_id เป็น identity
    id: config.id ?? config.dataset_id,
    dataset_id: config.dataset_id,
    widget_type: config.widget_type,
    title: config.title,
    title_i18n: config.title_i18n,
    order_index: config.order_index,
    params: config.params,
  };
  if (config.meta && config.data)
    return { ...base, meta: config.meta, data: config.data };
  if (detail) return { ...base, meta: detail.meta, data: detail.data };
  return undefined;
}

/**
 * widget 1 ใบ = 1 query ของตัวเอง ยิงตอนเลื่อนเข้าใกล้ viewport แล้วส่ง payload
 * ที่ resolve แล้วให้ `children` วาด (ผู้เรียกเลือกการ์ดเองได้ เช่นหน้าที่จัดกลุ่ม
 * เป็น section)
 *
 * เดิมทั้งหน้าใช้ response ก้อนเดียวที่ gateway exec dataset ให้ครบทุกตัวก่อน จึง
 * เห็นข้อมูลพร้อมกันหลังตัวช้าสุด ตอนนี้ใบที่เสร็จก่อนขึ้นก่อน และใบที่ dataset พัง
 * ก็หายไปแค่ใบเดียว (เท่าพฤติกรรมเดิมที่ item มี `error` แล้วไม่ถูก render)
 *
 * config ที่พ่วง `meta`/`data` มาแล้ว (mock dashboard) จะไม่ยิง query เลย
 *
 * @param config - config ของ widget ใบนี้
 * @param className - class ของ wrapper — ผู้เรียกคุม col-span เอง
 * @param children - ฟังก์ชันวาดการ์ดจาก widget ที่ resolve แล้ว
 */
export function LazyWidget({
  config,
  className,
  children,
}: {
  readonly config: SystemWidgetConfigItem;
  readonly className?: string;
  readonly children: (widget: ResolvedWidget) => ReactNode;
}) {
  const buCode = useBuCode();
  const { ref, inView } = useInViewport<HTMLDivElement>();
  const preResolved = !!config.meta && !!config.data;
  const { data: detail, isError } = useQuery(
    dashboardDatasetDataQueryOptions(
      buCode,
      config.dataset_id,
      inView && !preResolved,
    ),
  );

  if (isError) return null;

  const resolved = resolveWidget(config, detail);

  return (
    <div ref={ref} className={cn("h-full", className)}>
      {resolved ? (
        children(resolved)
      ) : (
        <WidgetSkeleton variant={skeletonVariantFor(config.widget_type)} />
      )}
    </div>
  );
}

function LazyWidgetCard({
  config,
  moduleName,
  subTileFor,
}: {
  readonly config: SystemWidgetConfigItem;
  readonly moduleName: string;
  readonly subTileFor: (datasetId: string) => string;
}) {
  return (
    <LazyWidget
      config={config}
      className={gridClasses(config.widget_type, config.display)}
    >
      {(widget) => (
        <WidgetRouter
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      )}
    </LazyWidget>
  );
}

/**
 * เลือกการ์ดตาม `widget_type` — **ตัวเดียวในระบบ** ทั้งกริดของ module dashboard,
 * การ์ดบน personal dashboard และ preview ในหน้าตั้งค่าใช้ตัวนี้ร่วมกัน
 *
 * เคยมี switch ตัวที่สองอยู่ใน `components/dashboard-widget/sortable-widget-item.tsx` แล้วตอนเพิ่มการ์ด gauge
 * ใส่ case ไว้ที่นี่ที่เดียว อีกตัวตกไปเข้า `default: return null` — widget หายทั้งใบ
 * โดยไม่มี error ให้เห็น รวมเหลือตัวเดียวเพื่อไม่ให้พลาดซ้ำ
 *
 * @param widget - widget ที่ resolve ข้อมูลแล้ว
 * @param moduleName - ชื่อ module สำหรับเลือกไอคอน
 * @param subTileFor - map dataset_id → ชื่อ sub-tile
 * @returns การ์ดของชนิดนั้น หรือ null เมื่อยังไม่มีการ์ดรองรับ
 */
export function WidgetRouter({
  widget,
  moduleName,
  subTileFor,
}: {
  readonly widget: CompositeWidgetItem;
  readonly moduleName: string;
  readonly subTileFor: (datasetId: string) => string;
}) {
  if (!widget.meta || !widget.data) return null;
  const resolved = widget as ResolvedWidget;
  switch (widget.widget_type) {
    case "kpi":
      return (
        <KpiCard
          widget={resolved}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      );
    case "gauge":
      return (
        <GaugeCard
          widget={resolved}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      );
    case "pie":
      return (
        <PieCard
          widget={resolved}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      );
    case "bar":
      return (
        <BarCard
          widget={resolved}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      );
    case "line":
    case "area":
      return (
        <LineCard
          widget={resolved}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      );
    case "table":
      return (
        <TableCard
          widget={resolved}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      );
    default:
      return null;
  }
}

function WidgetHeader({ widget, moduleName, subTileFor }: WidgetCardProps) {
  const titleOf = useWidgetTitle();
  // widget กลุ่ม document.* ที่กรอง status → ไอคอนหลักเปลี่ยนตาม workflow status
  // ที่เหลือ (by-status / series / dataset ทั่วไป) → SubTile รูป doc-type เดิม
  const status = statusOf(widget.params);
  // document.* ตรงตัวอยู่แล้ว (ชื่อ + badge สื่อความหมายครบ) → ไม่ต้องมี description
  const isDocumentWidget = widget.dataset_id.startsWith("document.");
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0">
        {status ? (
          <StatusTile status={status} size={32} />
        ) : (
          <SubTile
            name={subTileFor(widget.dataset_id)}
            parentName={moduleName}
            size={32}
          />
        )}
      </span>
      <div className="min-w-0 space-y-0.5">
        <CardTitle className="text-sm leading-snug font-semibold">
          {titleOf(widget, widget.meta.name)}
        </CardTitle>
        {!isDocumentWidget && widget.meta.description && (
          <CardDescription className="text-micro leading-snug">
            {widget.meta.description}
          </CardDescription>
        )}
        <WidgetParamsBadges params={widget.params} />
      </div>
    </div>
  );
}

export function KpiCard({ widget, moduleName, subTileFor }: WidgetCardProps) {
  if (!isScalarDeltaData(widget.data)) return null;
  const { value: raw, prev } = widget.data;
  const value = applyDecimals(raw, widget.display);
  const hasDelta = widget.meta.shape === "scalar_delta" && prev !== undefined;

  return (
    <Card className="h-full min-h-0 gap-2 overflow-hidden py-4">
      <CardHeader className="px-4">
        <WidgetHeader
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums">
            {value.toLocaleString()}
          </span>
          {widget.meta.unit && widget.meta.unit !== "฿" && (
            <span className="text-muted-foreground text-xs">
              {widget.meta.unit}
            </span>
          )}
        </div>
        {hasDelta && <DeltaIndicator value={raw} prev={prev} />}
      </CardContent>
    </Card>
  );
}

/**
 * Gauge — ค่าเดียวเทียบกับช่วงที่ตั้งไว้ (`display.min`/`max`)
 *
 * วาดเป็นครึ่งวงกลมด้วย SVG ไม่ใช่ recharts เพราะ RadialBarChart ต้องแปลงข้อมูล
 * เป็น series ก่อนทั้งที่ตรงนี้มีค่าเดียว และคุมมุม/ความหนาได้ตรงกว่า
 *
 * ผู้ใช้ที่ยังไม่ตั้ง `max` จะได้สเกลที่เดาให้ (ปัดขึ้นเป็นเลขกลม) พร้อมป้ายบอกว่า
 * เป็นค่าประมาณ — gauge ที่ไม่รู้ปลายทางอ่านความหมายไม่ได้ ต้องบอกให้รู้ตัว
 */
export function GaugeCard({ widget, moduleName, subTileFor }: WidgetCardProps) {
  const t = useTranslations("dashboardWidget");
  if (!isScalarDeltaData(widget.data)) return null;
  const raw = widget.data.value;
  const value = applyDecimals(raw, widget.display);
  const { min, max, isEstimated } = gaugeRange(raw, widget.display);
  const ratio = Math.min(Math.max((raw - min) / (max - min), 0), 1);
  const color = thresholdColor(raw, widget.display, "var(--chart-1)");

  // ครึ่งวงกลม: เส้นรอบวง = π × r ใช้ dasharray ตัดตามสัดส่วน
  const r = 52;
  const circumference = Math.PI * r;

  return (
    <Card className="h-full min-h-0 gap-2 overflow-hidden py-4">
      <CardHeader className="px-4">
        <WidgetHeader
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        {/* จัดให้พอดีกล่อง: การ์ดสูงเท่าที่ประกาศแล้ว svg ที่กว้างเต็มจะดันบรรทัด
            min/max ตกขอบ (การ์ดเป็น overflow-hidden) ให้ svg ย่อตามที่เหลือแทน */}
        <div className="flex h-full min-h-0 flex-col items-center justify-center">
          <svg
            viewBox="0 0 128 72"
            preserveAspectRatio="xMidYMid meet"
            className="max-h-full min-h-0 w-full max-w-[12rem] flex-1"
            role="img"
            aria-label={`${value} / ${max}`}
          >
            <path
              d={`M 12 64 A ${r} ${r} 0 0 1 116 64`}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d={`M 12 64 A ${r} ${r} 0 0 1 116 64`}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${ratio * circumference} ${circumference}`}
            />
          </svg>
          <div className="-mt-6 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {value.toLocaleString()}
            </span>
            {widget.meta.unit && widget.meta.unit !== "฿" && (
              <span className="text-muted-foreground text-xs">
                {widget.meta.unit}
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-micro mt-1 flex w-full max-w-[12rem] justify-between tabular-nums">
            <span>{min.toLocaleString()}</span>
            <span>
              {max.toLocaleString()}
              {isEstimated ? ` ${t("gaugeEstimated")}` : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PieCard({ widget, moduleName, subTileFor }: WidgetCardProps) {
  const t = useTranslations("dashboardWidget");
  if (!isCategoricalData(widget.data)) return null;
  const data = widget.data as readonly CategoricalPoint[];
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const chartData = data.map((d) => ({
    name: humanizeLabel(d.label),
    value: d.value,
  }));

  return (
    <Card className="h-full min-h-0 gap-2 overflow-hidden py-4">
      <CardHeader className="px-4">
        <WidgetHeader
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        {chartData.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {t("noData")}
          </p>
        ) : (
          // แถวต้อง h-full ด้วย: กล่องวงกลมกว้างตามความสูงตัวเอง (aspect-square)
          // ถ้าแถวสูงตามเนื้อหา ความสูงจะเป็น 0 แล้ววงกลมหายทั้งวง เหลือแต่ legend
          <div className="flex h-full items-center gap-3">
            <div className="aspect-square h-full shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    // รัศมีเป็น % ไม่ใช่ px คงที่: ขนาดการ์ดปรับได้แล้ว เลข px เดิม
                    // (38/64 ที่ทำไว้ตอนกล่องคงที่ 160px) จะโดนตัดขอบเมื่อการ์ดเล็กลง
                    innerRadius="55%"
                    outerRadius="85%"
                    dataKey="value"
                    labelLine={false}
                    isAnimationActive={false}
                  >
                    {chartData.map((item, i) => (
                      <Cell
                        key={item.name}
                        style={{ fill: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [
                      `${formatValue(v, widget.meta.unit ?? "")} ${widget.meta.unit ?? ""}`,
                      "",
                    ]}
                    contentStyle={{ fontSize: "0.6875rem" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {chartData.map((item, i) => {
                const pct =
                  total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <li key={item.name} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-micro min-w-0 flex-1 truncate leading-tight">
                      {item.name}
                    </span>
                    <span className="text-micro font-semibold tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-micro w-9 text-right tabular-nums">
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BarCard({ widget, moduleName, subTileFor }: WidgetCardProps) {
  const t = useTranslations("dashboardWidget");
  // time_series วาดเป็นแท่งได้ (backend ประกาศไว้) — แกนเป็นวันที่ จึงต้องคงลำดับเวลา
  // ไม่ใช่เรียงตามค่าเหมือน categorical
  const isSeries = widget.meta.shape === "time_series";
  if (!isSeries && !isCategoricalData(widget.data)) return null;
  if (isSeries && !isTimeSeriesData(widget.data)) return null;

  const sorted = isSeries
    ? (widget.data as readonly TimeSeriesPoint[]).map((d) => ({
        name: d.date,
        value: d.value,
      }))
    : (widget.data as readonly CategoricalPoint[])
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((d) => ({ name: d.label, value: d.value }));
  const isCurrency = widget.meta.unit === "฿";
  // แท่งบางเกินไปเมื่อบีบให้พอดีกล่อง — คงความสูงต่อแท่งไว้แล้วให้กล่องเลื่อนแทน
  const chartHeight = Math.max(120, sorted.length * 26);

  return (
    <Card className="h-full min-h-0 gap-2 overflow-hidden py-4">
      <CardHeader className="px-4">
        <WidgetHeader
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        {sorted.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {t("noData")}
          </p>
        ) : (
          <div className="h-full min-h-0 overflow-y-auto">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                layout="vertical"
                data={sorted}
                margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                barCategoryGap="20%"
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  interval={0}
                />
                <Tooltip
                  formatter={(v: number) => [
                    `${isCurrency ? "฿" : ""}${formatValue(v, widget.meta.unit ?? "")}${
                      !isCurrency ? ` ${widget.meta.unit ?? ""}` : ""
                    }`,
                    "",
                  ]}
                  contentStyle={{ fontSize: "0.6875rem" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={false}
                >
                  {sorted.map((item, i) => (
                    <Cell
                      key={item.name}
                      style={{ fill: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: number) =>
                      isCurrency
                        ? `฿${formatValue(v, "฿")}`
                        : formatValue(v, "")
                    }
                    style={{ fontSize: 10, fill: "var(--foreground)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LineCard({ widget, moduleName, subTileFor }: WidgetCardProps) {
  const t = useTranslations("dashboardWidget");
  if (!isTimeSeriesData(widget.data)) return null;
  const data = widget.data as readonly TimeSeriesPoint[];
  const points = data.map((p) => ({ date: p.date, value: p.value }));
  const isCurrency = widget.meta.unit === "฿";

  return (
    <Card className="h-full min-h-0 gap-2 overflow-hidden py-4">
      <CardHeader className="px-4">
        <WidgetHeader
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        {points.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {t("noData")}
          </p>
        ) : (
          <div className="relative h-full min-h-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              className="absolute inset-0"
            >
              <LineChart
                data={points}
                margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(v: number) => [
                    `${isCurrency ? "฿" : ""}${formatValue(v, widget.meta.unit ?? "")}${
                      !isCurrency ? ` ${widget.meta.unit ?? ""}` : ""
                    }`,
                    "",
                  ]}
                  contentStyle={{ fontSize: "0.6875rem" }}
                  cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "var(--chart-1)" }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TableRow = Record<string, unknown>;

const TABLE_ICONS: Record<string, LucideIcon> = {
  "undo-2": Undo2,
  "circle-x": CircleX,
};

function isNumericColumn(type?: TableColumn["type"]): boolean {
  return type === "number" || type === "currency";
}

function formatTableCell(value: unknown, type?: TableColumn["type"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (isNumericColumn(type) && typeof value === "number") {
    const n = value.toLocaleString();
    return type === "currency" ? `฿${n}` : n;
  }
  return String(value);
}

function renderTableCell(
  value: unknown,
  type?: TableColumn["type"],
): ReactNode {
  if (type === "icon") {
    const Icon = typeof value === "string" ? TABLE_ICONS[value] : undefined;
    return Icon ? (
      <Icon className="text-muted-foreground size-4" aria-hidden="true" />
    ) : null;
  }
  return formatTableCell(value, type);
}

/**
 * ข้อมูลของ widget ในรูปตาราง — ตัวที่เป็น `table` อยู่แล้วส่งต่อตรง ๆ ส่วน
 * categorical/ranked สร้างคอลัมน์ให้เอง
 *
 * backend ประกาศไว้แล้วว่า categorical กับ ranked วาดเป็นตารางได้ (`supported_renders`)
 * แต่ payload เป็น `[{label, value}]` ไม่ใช่ `{columns, rows}` ที่ `TableCard` ต้องการ
 * ตัวแปลงนี้คือส่วนที่ขาด — ไม่ต้องแตะ dataset หรือ SQL เลย
 *
 * รับค่าดิบ (ไม่ใช่ทั้ง widget) เพราะฝั่งผู้เรียกต้อง memo ผลลัพธ์ให้ได้ — `widget`
 * ถูกสร้างใหม่ทุก render ที่ `buildFullWidget` ถ้าเอามาเป็น dependency ตรง ๆ
 * `useReactTable` จะได้ data/columns ชุดใหม่ทุกรอบแล้ววนไม่จบ
 *
 * @param raw - `widget.data` ดิบ
 * @param unit - หน่วยของ dataset สำหรับเติมในหัวคอลัมน์ค่า
 * @param labels - หัวคอลัมน์ที่แปลแล้ว
 * @returns TableData หรือ null เมื่อรูปข้อมูลใช้ไม่ได้
 */
function asTableData(
  raw: unknown,
  unit: string | undefined,
  labels: { label: string; value: string; rank: string },
): TableData | null {
  if (isTableData(raw)) return raw as TableData;
  if (!isCategoricalData(raw)) return null;

  const points = raw as readonly CategoricalPoint[];
  // ranked พ่วง `rank` มาด้วย — โชว์เป็นคอลัมน์แรกเพื่อไม่ให้ลำดับหายไปตอนเป็นตาราง
  const isRanked =
    points.length > 0 &&
    typeof (points[0] as { rank?: number }).rank === "number";
  // ranked ของเอกสารพก id มาใน extras — ยกขึ้นเป็นคอลัมน์ `id` ให้แถวคลิกได้
  // เหมือนตารางตระกูล document.* (คอลัมน์ชนิดนี้ไม่ถูกวาด ดู TableCard)
  const extraId = (p: CategoricalPoint): string | undefined => {
    const v = (p as { extras?: Record<string, unknown> }).extras?.id;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const hasId = points.some((p) => extraId(p) !== undefined);

  const columns: TableColumn[] = [
    ...(hasId ? [{ key: "id", label: "", type: "id" as const }] : []),
    ...(isRanked
      ? [{ key: "rank", label: labels.rank, type: "number" as const }]
      : []),
    { key: "label", label: labels.label, type: "text" },
    {
      key: "value",
      label: unit ? `${labels.value} (${unit})` : labels.value,
      type: "number",
    },
  ];

  return {
    columns,
    rows: points.map((p, i) => ({
      ...(hasId ? { id: extraId(p) ?? "" } : {}),
      ...(isRanked ? { rank: (p as { rank?: number }).rank ?? i + 1 } : {}),
      label: humanizeLabel(p.label),
      value: p.value,
    })),
  };
}

export function TableCard({ widget, moduleName, subTileFor }: WidgetCardProps) {
  "use no memo";
  const t = useTranslations("dashboardWidget");
  const colLabel = t("tableCol.label");
  const colValue = t("tableCol.value");
  const colRank = t("tableCol.rank");
  // ต้อง memo: categorical/ranked ถูกแปลงเป็นตารางใหม่ทุก render ถ้าไม่ตรึงไว้
  // `useReactTable` จะเห็น data/columns เป็นของใหม่ทุกรอบ แล้ว set state วนจนหน้าค้าง
  const data = useMemo(
    () =>
      asTableData(widget.data, widget.meta.unit, {
        label: colLabel,
        value: colValue,
        rank: colRank,
      }),
    [widget.data, widget.meta.unit, colLabel, colValue, colRank],
  );

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      // คอลัมน์ id มีไว้ทำลิงก์ ไม่ใช่ข้อมูลที่คนอ่าน — ข้ามไม่วาดเป็นคอลัมน์
      (data?.columns ?? [])
        .filter((col) => col.type !== "id")
        .map((col) => ({
          id: col.key,
          accessorFn: (row: TableRow) => row[col.key],
          header: col.label,
          cell: ({ getValue, row }) => {
            const content = renderTableCell(getValue(), col.type);
            const href = col.link ? cellDocHref(row.original, col.link) : null;
            if (!col.link || !href) return content;
            const title = col.link.title ? row.original[col.link.title] : undefined;
            return (
              <Link
                to={href}
                title={typeof title === "string" && title ? title : undefined}
                onClick={(e) => e.stopPropagation()}
                className="text-primary font-medium hover:underline"
              >
                {content}
              </Link>
            );
          },
          meta: isNumericColumn(col.type)
            ? {
                headerClassName: "text-right",
                cellClassName: "text-right tabular-nums",
              }
            : undefined,
        })),
    [data?.columns],
  );

  const rows = useMemo<TableRow[]>(() => [...(data?.rows ?? [])], [data?.rows]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // แถวคลิกได้เฉพาะ dataset ที่รู้ปลายทาง และแถวที่มี id จริง — ไม่งั้น
  // `DataGridTable` จะทำให้ทุกแถวดูกดได้ (cursor + focus ring) ทั้งที่กดแล้วไม่ไปไหน
  const navigate = useNavigate();
  const idKey = idColumnKey(data);
  const canLink =
    idKey !== null && rows.some((r) => docHref(widget.dataset_id, r, idKey));
  const onRowClick = canLink
    ? (row: TableRow) => {
        const href = docHref(widget.dataset_id, row, idKey);
        if (href) navigate(href);
      }
    : undefined;

  return (
    <Card className="h-full min-h-0 gap-2 overflow-hidden py-4">
      <CardHeader className="px-4">
        <WidgetHeader
          widget={widget}
          moduleName={moduleName}
          subTileFor={subTileFor}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        {!data || columns.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {t("noData")}
          </p>
        ) : (
          <DataGrid
            table={table}
            recordCount={rows.length}
            onRowClick={onRowClick}
            tableLayout={{ dense: true, headerSticky: true, width: "auto" }}
            emptyMessage={
              <p className="text-muted-foreground py-6 text-center text-xs">
                {t("noData")}
              </p>
            }
          >
            <DataGridContainer border={false} className="max-h-72 text-xs">
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        )}
      </CardContent>
    </Card>
  );
}

type WidgetSkeletonVariant = "kpi" | "bar" | "pie";

export function WidgetSkeleton({
  variant = "kpi",
  className,
}: {
  readonly variant?: WidgetSkeletonVariant;
  readonly className?: string;
}) {
  return (
    <Card
      className={cn("h-full min-h-0 gap-2 overflow-hidden py-4", className)}
    >
      <CardHeader className="px-4">
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        {variant === "kpi" && (
          <div className="space-y-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        )}
        {variant === "bar" && (
          <div className="flex h-24 items-end gap-2">
            <Skeleton className="h-1/2 w-full" />
            <Skeleton className="h-4/5 w-full" />
            <Skeleton className="h-3/5 w-full" />
            <Skeleton className="h-full w-full" />
            <Skeleton className="h-2/5 w-full" />
          </div>
        )}
        {variant === "pie" && (
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WidgetSkeletonCards() {
  return (
    <>
      <WidgetSkeleton
        variant="kpi"
        className="row-span-2 md:col-span-2 lg:col-span-3"
      />
      <WidgetSkeleton
        variant="kpi"
        className="row-span-2 md:col-span-2 lg:col-span-3"
      />
      <WidgetSkeleton
        variant="pie"
        className="row-span-3 md:col-span-3 lg:col-span-6"
      />
      <WidgetSkeleton
        variant="bar"
        className="row-span-3 md:col-span-3 lg:col-span-6"
      />
      <WidgetSkeleton
        variant="kpi"
        className="row-span-2 md:col-span-2 lg:col-span-3"
      />
      <WidgetSkeleton
        variant="kpi"
        className="row-span-2 md:col-span-2 lg:col-span-3"
      />
    </>
  );
}

function DeltaIndicator({
  value,
  prev,
}: {
  readonly value: number;
  readonly prev: number;
}) {
  const t = useTranslations("dashboardWidget");
  const diff = value - prev;
  const pct = prev === 0 ? null : Math.round((diff / Math.abs(prev)) * 100);

  if (diff === 0) {
    return (
      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
        <Minus className="size-3" aria-hidden="true" />
        <span>{t("deltaUnchanged")}</span>
      </p>
    );
  }

  const isUp = diff > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const tone = isUp ? "text-positive-ink" : "text-negative-ink";
  const sign = isUp ? "+" : "";

  return (
    <p className={cn("mt-1 flex items-center gap-1 text-xs", tone)}>
      <Icon className="size-3" aria-hidden="true" />
      <span className="tabular-nums">
        {sign}
        {diff.toLocaleString()}
        {pct !== null && ` (${sign}${pct}%)`}
      </span>
      <span className="text-muted-foreground">{t("deltaCompare")}</span>
    </p>
  );
}
