import { useCallback } from "react";
import { useLocale, useTranslations } from "use-intl";
import { resolveWidgetTitle, type WidgetTitleSource } from "./widget-title";

/**
 * คีย์คำแปลของ dataset — จุดแรกแยกหมวด (path ซ้อนของ use-intl) จุดถัดไปเป็น `__`
 * เพราะ dataset เทียบงวดต่อท้าย id ของตัวตั้ง (`document.pr-count.vs-period`) และ
 * `pr-count` เป็นข้อความอยู่แล้ว จะเป็น object ให้ลงลึกอีกชั้นไม่ได้ — เดิม 20 ตัวนี้จึงไม่มี
 * คำแปลได้เลย · id สองท่อน (เกือบทั้งหมด) ได้คีย์เท่าเดิม
 */
export function datasetMessageKey(datasetId: string): string {
  const dot = datasetId.indexOf(".");
  if (dot < 0) return datasetId;
  return (
    datasetId.slice(0, dot + 1) + datasetId.slice(dot + 1).replaceAll(".", "__")
  );
}

/**
 * ชื่อ dataset ตาม locale — คีย์คือ dataset_id ตรง ๆ (`dashboard.datasets.workflow.cn-pending-approval`)
 * use-intl อ่านจุดเป็น path ซ้อน ซึ่งตรงกับโครงของไฟล์แปล; dataset ที่ไม่มีคำแปล
 * (เช่นที่ promote จาก SQL Workbench) ใช้ชื่อจาก catalogue
 */
export function useDatasetLabel() {
  const t = useTranslations("dashboard.datasets");
  return useCallback(
    (datasetId: string, datasetName?: string) => {
      const key = datasetMessageKey(datasetId);
      return (t.has(key) ? t(key) : undefined) || datasetName || datasetId;
    },
    [t],
  );
}

/** ฟังก์ชันเลือกชื่อ widget ตาม locale ปัจจุบัน — ดู `resolveWidgetTitle` */
export function useWidgetTitle() {
  const locale = useLocale();
  const t = useTranslations("dashboard.datasets");
  return useCallback(
    (widget: WidgetTitleSource, datasetName?: string) => {
      const key = datasetMessageKey(widget.dataset_id);
      return resolveWidgetTitle(widget, {
        locale,
        datasetName,
        translatedDatasetName: t.has(key) ? t(key) : undefined,
      });
    },
    [locale, t],
  );
}
