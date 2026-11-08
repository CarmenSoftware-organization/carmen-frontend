import type { DashboardDataset } from "@/types/dashboard-dataset";
import type {
  CategoricalPoint,
  DatasetData,
  DatasetMeta,
  DatasetShape,
  MatrixData,
  TimeSeriesPoint,
} from "@/types/dashboard-widget";

/**
 * ข้อมูลสมมติสำหรับรูปตัวอย่างในแกลเลอรีของ pop up Add widget — ให้เห็นหน้าตาของ widget
 * ทุกตัวโดยไม่ยิง API สักครั้ง (117 ตัว) ข้อมูลจริงค่อยดูในหน้าปรับแต่งหลังกด "ถัดไป"
 *
 * - ค่าคงที่ต่อ dataset (seed จาก id) — รูปแต่ละใบต่างกัน แต่ไม่เปลี่ยนทุก render
 * - ป้ายตาม `dimension` ของ dataset จึงผ่านตัวแปลตัวเดียวกับของจริง (`widget-labels.ts`)
 *   สถานะเป็นรหัสจริง (draft…) ที่แปลเป็นภาษาของหน้าได้ · วัน/เดือน/งวดเป็นค่าเรียงจริง
 * - ชื่อ (ผู้ขาย / คลัง / สินค้า) ไม่มีค่าสมมติที่ดูจริง — ใช้ "ชื่อมิติ + ตัวอักษร"
 *   ผ่าน `nameOf` ที่ผู้เรียกประกอบตาม locale
 */

export interface SampleWidget {
  readonly meta: DatasetMeta;
  readonly data: DatasetData<DatasetShape>;
}

/** ชื่อสมมติของมิติที่เป็นชื่อจริง — ("vendor", "A") → "ผู้ขาย A" */
export type SampleNameOf = (
  dimension: string | undefined,
  letter: string,
) => string;

const STATUS_SAMPLE = [
  "draft",
  "in_progress",
  "approved",
  "completed",
  "voided",
];
const PRIORITY_SAMPLE = ["low", "medium", "high", "critical"];
const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

/** FNV-1a — id เดียวกันได้ seed เดิมเสมอ */
function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — สุ่มแบบกำหนด seed คืนค่า [0, 1) */
function randomFrom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** n ค่าบนแกนของมิติหนึ่ง — เวลาเรียงเก่า → ใหม่ ลงท้ายที่ `today` */
export function sampleAxis(
  dimension: string | undefined,
  n: number,
  today: Date,
  nameOf: SampleNameOf,
): string[] {
  const back = (step: (d: Date, i: number) => Date, fmt: (d: Date) => string) =>
    Array.from({ length: n }, (_, i) => fmt(step(today, n - 1 - i)));
  switch (dimension) {
    case "status":
      return STATUS_SAMPLE.slice(0, n);
    case "priority":
      return PRIORITY_SAMPLE.slice(0, n);
    case "day":
      return Array.from({ length: n }, (_, i) => pad2(i + 1));
    case "date":
      return back(
        (d, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - i),
        (d) =>
          `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      );
    case "month":
      return back(
        (d, i) => new Date(d.getFullYear(), d.getMonth() - i, 1),
        (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      );
    case "period":
      return back(
        (d, i) => new Date(d.getFullYear(), d.getMonth() - i, 1),
        (d) => `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}`,
      );
    default:
      return LETTERS.slice(0, n).map((l) => nameOf(dimension, l));
  }
}

/** ขนาดของตัวเลขตามหน่วย — เงินเป็นหลักพัน วันมีทศนิยม จำนวนเป็นจำนวนเต็มเล็ก ๆ */
function valueMaker(unit: string | undefined, rand: () => number) {
  switch (unit) {
    case "฿":
      return () => Math.round(5_000 + rand() * 55_000);
    case "days":
      return () => Math.round((1 + rand() * 20) * 10) / 10;
    case "rate":
      return () => Math.round((28 + rand() * 8) * 10_000) / 10_000;
    default:
      return () => Math.round(2 + rand() * 28);
  }
}

/**
 * widget สมมติของ dataset หนึ่ง — `meta` ชุดเดียวกับของจริง (หน่วย มิติ) ส่วน `data`
 * เป็นค่าสมมติตามรูปของ shape
 *
 * dataset แบบ `table` ของจริงมีคอลัมน์เฉพาะตัวที่ catalogue ไม่บอก — ตัวอย่างจึงเป็นตาราง
 * 2 คอลัมน์ (shape categorical ให้ `TableCard` ตั้งหัวคอลัมน์ตามภาษาเอง)
 *
 * @param dataset - รายการใน catalogue
 * @param nameOf - ชื่อสมมติของมิติที่เป็นชื่อจริง
 * @param today - วันอ้างอิงของแกนเวลา (เทสต์ส่งค่าคงที่)
 */
export function sampleWidget(
  dataset: DashboardDataset,
  nameOf: SampleNameOf,
  today: Date = new Date(),
): SampleWidget {
  const rand = randomFrom(seedOf(dataset.id));
  const value = valueMaker(dataset.unit, rand);
  const shape = dataset.shape === "table" ? "categorical" : dataset.shape;
  const meta: DatasetMeta = {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    shape: shape as DatasetShape,
    category: dataset.category as DatasetMeta["category"],
    unit: dataset.unit,
    dimension: dataset.dimension,
    series_dimension: dataset.series_dimension,
  };

  switch (shape) {
    case "scalar":
      return { meta, data: { value: value() } };
    case "scalar_delta": {
      const now = value();
      return { meta, data: { value: now, prev: Math.max(0, now - 4) } };
    }
    case "time_series": {
      let level = value();
      const data: TimeSeriesPoint[] = sampleAxis("date", 10, today, nameOf).map(
        (date) => {
          // เดินสุ่มรอบค่าเดิม — ได้เส้นขึ้นลงพอให้ดูเป็นแนวโน้ม
          level = Math.max(0, Math.round(level * (0.7 + rand() * 0.6)));
          return { date, value: level };
        },
      );
      return { meta, data };
    }
    case "matrix": {
      const rows = sampleAxis(dataset.series_dimension, 2, today, nameOf);
      const cols = sampleAxis(
        dataset.dimension,
        dataset.dimension === "day" ? 7 : 5,
        today,
        nameOf,
      );
      const data: MatrixData = {
        rows,
        cols,
        values: rows.map(() => cols.map(() => value())),
      };
      return { meta, data };
    }
    case "ranked": {
      const values = Array.from({ length: 5 }, () => value()).sort(
        (a, b) => b - a,
      );
      const labels = sampleAxis(dataset.dimension, 5, today, nameOf);
      return {
        meta,
        data: labels.map((label, i) => ({
          rank: i + 1,
          label,
          value: values[i]!,
        })),
      };
    }
    default: {
      // categorical และตาราง — เรียงมากไปน้อยเหมือนข้อมูลจริงส่วนใหญ่
      const labels = sampleAxis(dataset.dimension, 4, today, nameOf);
      const values = labels.map(() => value()).sort((a, b) => b - a);
      const data: CategoricalPoint[] = labels.map((label, i) => ({
        label,
        value: values[i]!,
      }));
      return { meta, data };
    }
  }
}
