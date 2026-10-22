// =============================================================
// Dashboard types — canonical schema synced with backend enums
// =============================================================

export type DatasetShape =
  | "scalar"
  | "scalar_delta"
  | "time_series"
  | "categorical"
  | "ranked"
  | "matrix"
  | "table";

export type WidgetType =
  | "kpi"
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "heatmap"
  | "gauge"
  | "table"
  | "sparkline";

type DatasetCategory =
  "inventory" | "workflow" | "movement" | "spend" | "variance";

// -------------------------------------------------------------
// Dataset metadata (from GET /api/:bu/datasets)
// -------------------------------------------------------------
export interface DatasetMeta {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly shape: DatasetShape;
  readonly category: DatasetCategory;
  readonly unit?: string;
}

// -------------------------------------------------------------
// Dataset parameters — descriptors drive the widget param form,
// values are stored on the widget (`params` jsonb) and sent to exec
// -------------------------------------------------------------
export interface DatasetParam {
  readonly name: string;
  readonly label: string;
  readonly type: "text" | "int";
  readonly required: boolean;
  readonly default?: string | number;
  readonly options?: readonly string[];
}

export type WidgetParams = Record<string, string | number>;

// -------------------------------------------------------------
// Dataset data — discriminated by shape
// -------------------------------------------------------------
interface ScalarData {
  readonly value: number;
}

interface ScalarDeltaData {
  readonly value: number;
  readonly prev: number;
  readonly change?: string;
}

export interface TimeSeriesPoint {
  readonly date: string;
  readonly value: number;
}

export interface CategoricalPoint {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

interface RankedPoint {
  readonly rank: number;
  readonly label: string;
  readonly value: number;
  readonly extras?: Record<string, unknown>;
}

interface MatrixData {
  readonly rows: readonly string[];
  readonly cols: readonly string[];
  readonly values: readonly (readonly number[])[];
}

/**
 * `id` ไม่ใช่คอลัมน์ที่โชว์ — เป็นค่าที่ client เอาไปทำลิงก์ไปหาเอกสารของแถวนั้น
 * (label ของมันว่างเสมอ) ตารางต้องข้ามไม่เอาไปวาดเป็นคอลัมน์
 */
type TableColumnType = "text" | "number" | "currency" | "date" | "icon" | "id";

/**
 * ช่องที่เป็นลิงก์ไปหาเอกสารของแถว — ค่าในนี้เป็น "คีย์ของคอลัมน์" ในแถวเดียวกัน ไม่ใช่ค่า
 * (คอลัมน์พวกนั้น backend ประกาศเป็น type `id` ตารางจึงไม่วาด) · `doc_type` คือ
 * `inventory_doc_type` ของ transaction ซึ่ง `cellDocHref` map เป็น route ของหน้าเว็บ
 */
export interface TableColumnLink {
  readonly doc_type: string;
  readonly doc_id: string;
  /** คีย์ของเลขที่เอกสาร ใช้เป็น tooltip */
  readonly title?: string;
}

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly type?: TableColumnType;
  readonly link?: TableColumnLink;
}

export interface TableData {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly Record<string, unknown>[];
}

export type DatasetData<S extends DatasetShape> = S extends "scalar"
  ? ScalarData
  : S extends "scalar_delta"
    ? ScalarDeltaData
    : S extends "time_series"
      ? readonly TimeSeriesPoint[]
      : S extends "categorical"
        ? readonly CategoricalPoint[]
        : S extends "ranked"
          ? readonly RankedPoint[]
          : S extends "matrix"
            ? MatrixData
            : S extends "table"
              ? TableData
              : never;

// -------------------------------------------------------------
// Response — GET /api/:bu/datasets/:id (single resolved dataset)
// -------------------------------------------------------------
type DatasetResponse = {
  [S in DatasetShape]: {
    readonly meta: DatasetMeta & { readonly shape: S };
    readonly data: DatasetData<S>;
  };
}[DatasetShape];

// -------------------------------------------------------------
// Personal saved widget — bound to dataset_id + widget_type
// -------------------------------------------------------------
/**
 * ค่าตั้งการแสดงผลต่อ widget — backend เก็บให้เฉย ๆ ไม่ตีความ (ตรวจแค่ว่าเป็น object
 * และไม่เกิน 8KB) **frontend เป็นเจ้าของ schema นี้** เพิ่มคีย์ใหม่ได้โดยไม่ต้อง
 * deploy backend ดู migration 130 ของ micro-data
 */
export interface WidgetDisplay {
  /**
   * ความกว้างเป็นหน่วยคอลัมน์ของกริด 12 คอลัมน์ (เหมือน grid ของ css framework)
   * 3=¼ · 4=⅓ · 6=½ · 8=⅔ · 9=¾ · 12=เต็มแถว — ไม่ใส่ = ตามชนิดกราฟ
   */
  readonly width?: number;
  /**
   * ความสูงเป็นจำนวนแถวของกริด (1 แถว = 4rem) — การ์ดสูงเท่าที่ประกาศ ไม่ยืดตาม
   * การ์ดที่สูงที่สุดในแถวเดียวกันเหมือนก่อนหน้านี้ เนื้อที่ล้นจะเลื่อนในกล่องเอง
   */
  readonly height?: number;
  /** ทศนิยมของตัวเลขบนการ์ด */
  readonly decimals?: number;
  /** ต้นสเกลของ gauge (default 0) */
  readonly min?: number;
  /** ปลายสเกลของ gauge — ไม่ใส่ = เดาจากค่าปัจจุบัน ซึ่งอ่านความหมายไม่ได้ */
  readonly max?: number;
  /** เปลี่ยนสีเมื่อค่าถึงขีด เรียงจากน้อยไปมาก (UI ปัจจุบันแก้ได้ตัวแรกตัวเดียว) */
  readonly thresholds?: readonly {
    readonly value: number;
    readonly color: string;
  }[];
}

/** ชื่อ widget แยกภาษา — มี object เมื่อไรต้องมี en (backend ปฏิเสธ th ที่ไม่มี en) */
export interface LocalizedTitle {
  readonly en: string;
  readonly th?: string;
}

export interface WidgetConfig {
  readonly id: string;
  readonly dataset_id: string;
  readonly widget_type: WidgetType;
  readonly title?: string | null;
  readonly title_i18n?: LocalizedTitle | null;
  readonly order_index: number;
  readonly params?: WidgetParams | null;
  readonly display?: WidgetDisplay | null;
}

interface CreateWidgetDto {
  readonly dataset_id: string;
  readonly widget_type: WidgetType;
  readonly title?: string;
  readonly title_i18n?: LocalizedTitle | null;
  readonly order_index?: number;
  readonly params?: WidgetParams;
  readonly display?: WidgetDisplay;
}

interface UpdateWidgetDto {
  readonly title?: string | null;
  readonly title_i18n?: LocalizedTitle | null;
  readonly order_index?: number;
  readonly params?: WidgetParams;
  readonly widget_type?: WidgetType;
  /** แทนที่ทั้งก้อน (replace ไม่ใช่ merge — เหมือน params) */
  readonly display?: WidgetDisplay;
}

interface WidgetConfigListResponse {
  readonly items: readonly WidgetConfig[];
  readonly count: number;
}

// -------------------------------------------------------------
// Composite widget (from /dashboard-widgets/{procurement|inventory|me})
// — config + resolved data; data may be missing if dataset fetch fails
// -------------------------------------------------------------
export interface CompositeWidgetItem extends WidgetConfig {
  readonly module?: "procurement" | "inventory";
  readonly meta?: DatasetMeta;
  readonly data?: DatasetData<DatasetShape>;
  readonly error?: string;
}

interface CompositeWidgetListResponse {
  readonly items: readonly CompositeWidgetItem[];
  readonly count: number;
}

// -------------------------------------------------------------
// System widget config (from /dashboard-widgets/{module}/config)
// — config เปล่า ๆ ไม่มี data: หน้า module dashboard ยิงตัวนี้ก่อนเพื่อวาดกริด
// แล้วค่อยให้แต่ละใบยิง dataset ของตัวเอง (ดู `useDashboardWidgetConfigs`)
// ไม่มี `id` เพราะ gateway ส่งแค่ config — system widget คือแถว template ใน DB ของ
// platform (kind=system) ที่ gateway cache 60 วิแล้วกรองตาม BU ไม่ใช่ค่าที่ hardcode
// -------------------------------------------------------------
export type SystemWidgetConfigItem = Omit<
  CompositeWidgetItem,
  "id" | "module"
> & {
  readonly id?: string;
  readonly module?: string;
};

export interface SystemWidgetConfigListResponse {
  readonly items: readonly SystemWidgetConfigItem[];
  readonly count: number;
}

// -------------------------------------------------------------
// Shape ↔ Widget type compatibility
// -------------------------------------------------------------
// เดิมตรงนี้มี `SUPPORTED_WIDGETS` ที่ hardcode ว่า shape ไหนวาดเป็นอะไรได้ —
// เป็นสำเนาของสัญญาฝั่ง backend (`SupportedRenders` ใน micro-data) ที่ drift ไปแล้ว
// (time_series ขาด bar, categorical ขาด table) ตอนนี้ backend ส่งชุดนั้นมาเป็น
// `supported_renders` บน dataset แต่ละตัว ดู `components/dashboard-widget/render-support.ts`

// -------------------------------------------------------------
// Type guards
// -------------------------------------------------------------
export function isScalarDeltaData(data: unknown): data is ScalarDeltaData {
  return (
    !!data &&
    !Array.isArray(data) &&
    typeof (data as ScalarDeltaData).value === "number"
  );
}

export function isCategoricalData(
  data: unknown,
): data is readonly CategoricalPoint[] {
  return (
    Array.isArray(data) &&
    (data.length === 0 ||
      (typeof (data[0] as CategoricalPoint).label === "string" &&
        typeof (data[0] as CategoricalPoint).value === "number"))
  );
}

export function isTimeSeriesData(
  data: unknown,
): data is readonly TimeSeriesPoint[] {
  return (
    Array.isArray(data) &&
    (data.length === 0 ||
      (typeof (data[0] as TimeSeriesPoint).date === "string" &&
        typeof (data[0] as TimeSeriesPoint).value === "number"))
  );
}

export function isTableData(data: unknown): data is TableData {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Array.isArray((data as TableData).columns) &&
    Array.isArray((data as TableData).rows)
  );
}

// =============================================================
// Aliases for migration (deprecated names — keep until consumers refactor)
// =============================================================
export type DashboardWidgetListResponse = CompositeWidgetListResponse;
export type DashboardDatasetDetail = DatasetResponse;
export type MyDashboardWidget = WidgetConfig;
export type CreateMyDashboardWidgetDto = CreateWidgetDto;
export type UpdateMyDashboardWidgetDto = UpdateWidgetDto;
export type MyDashboardWidgetListResponse = WidgetConfigListResponse;

// BU widget — widget ระดับ BU ที่ทุกคนใน BU เห็น; module null = หน้า /dashboard หลัก
export type BuDashboardWidget = WidgetConfig & { module: string | null };

/** แถว deploy ของ tenant (null = ยังไม่เคย deploy และยังไม่เคยแก้เอง) */
export interface BuDeployState {
  deployed_version: number;
  deployed_at: string | null;
  customized_at: string | null;
}

export interface BuDashboardWidgetListResponse {
  items: readonly BuDashboardWidget[];
  count: number;
  deploy_state: BuDeployState | null;
}

export type CreateBuDashboardWidgetDto = CreateWidgetDto & {
  module: string | null;
};
