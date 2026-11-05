import type { DatasetParam } from "@/types/dashboard-widget";

type DashboardDatasetShape = "scalar" | "scalar_delta" | (string & {});
type DashboardDatasetCategory = "workflow" | "inventory" | (string & {});

export interface DashboardDataset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly shape: DashboardDatasetShape;
  readonly category: DashboardDatasetCategory;
  readonly unit: string;
  readonly params?: readonly DatasetParam[];
  /**
   * ชนิดกราฟที่ shape ของ dataset นี้วาดได้ — backend เป็นเจ้าของสัญญานี้
   * (`SupportedRenders` ใน micro-data) frontend เอามาตัดกับการ์ดที่มีจริง
   * ดู `availableRenders` — optional เพราะ backend รุ่นเก่ายังไม่ส่งฟิลด์นี้
   */
  readonly supported_renders?: readonly string[];
  /**
   * ชนิดกราฟที่ widget ใหม่ควรเริ่ม เมื่อตัวปกติของ shape อ่านผิด (เช่น เทียบงวดรายวัน
   * = เส้นซ้อน ไม่ใช่แท่ง 31 กลุ่ม) — ไม่มี = ตามปกติของ shape
   */
  readonly default_render?: string;
  /** แกนป้ายเก็บอะไร — ตัวเดียวกับ `DatasetMeta.dimension` (catalogue รู้ก่อนโหลดข้อมูล) */
  readonly dimension?: string;
  /** แถว (series) ของ matrix เก็บอะไร — ตัวเดียวกับ `DatasetMeta.series_dimension` */
  readonly series_dimension?: string;
}
