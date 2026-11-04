import { useState } from "react";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import type {
  LocalizedTitle,
  WidgetDisplay,
  WidgetParams,
} from "@/types/dashboard-widget";
import { defaultParamsFor } from "./widget-shape";

interface WidgetConfigSeed {
  readonly dataset: DashboardDataset;
  readonly initialParams?: WidgetParams | null;
  /** ค่าการแสดงผลเดิม — ไม่ส่ง = ยังไม่เคยตั้ง */
  readonly initialDisplay?: WidgetDisplay | null;
  /** ชื่อที่ผู้ใช้ตั้งเอง — null/ไม่ส่ง = ใช้ชื่อตั้งต้นของ dataset (ดู `customWidgetTitle`) */
  readonly initialTitle?: LocalizedTitle | null;
}

export interface WidgetConfigState {
  readonly values: WidgetParams;
  readonly setParam: (name: string, value: string | number) => void;
  readonly display: WidgetDisplay;
  readonly setDisplay: (next: WidgetDisplay) => void;
  readonly titleEn: string;
  readonly setTitleEn: (value: string) => void;
  readonly titleTh: string;
  readonly setTitleTh: (value: string) => void;
  /** ชื่อที่จะบันทึก — null = ใช้ชื่อตั้งต้นของ dataset */
  readonly titleI18n: LocalizedTitle | null;
  /** กรอกชื่อไทยแต่ไม่กรอกอังกฤษ — backend ต้องมี en เป็นตัวหลัก */
  readonly isTitleInvalid: boolean;
}

/**
 * state ของฟอร์มตั้งค่า widget (ชื่อ · param · การแสดงผล) — seed จาก props ตอน mount
 * เท่านั้น ผู้เรียกที่สลับ dataset ในที่เดิมต้องใส่ `key={dataset.id}` ให้ส่วนที่ถือ hook นี้
 */
export function useWidgetConfigState({
  dataset,
  initialParams,
  initialDisplay,
  initialTitle,
}: WidgetConfigSeed): WidgetConfigState {
  const [values, setValues] = useState<WidgetParams>(
    () => initialParams ?? defaultParamsFor(dataset.params),
  );
  const [display, setDisplay] = useState<WidgetDisplay>(
    () => initialDisplay ?? {},
  );
  const [titleEn, setTitleEn] = useState(initialTitle?.en ?? "");
  const [titleTh, setTitleTh] = useState(initialTitle?.th ?? "");

  const en = titleEn.trim();
  const th = titleTh.trim();
  const titleI18n: LocalizedTitle | null = en
    ? th
      ? { en, th }
      : { en }
    : null;

  return {
    values,
    setParam: (name, value) =>
      setValues((prev) => ({ ...prev, [name]: value })),
    display,
    setDisplay,
    titleEn,
    setTitleEn,
    titleTh,
    setTitleTh,
    titleI18n,
    isTitleInvalid: !!th && !en,
  };
}
