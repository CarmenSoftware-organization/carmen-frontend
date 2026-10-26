import { useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { ApiError } from "@/lib/api-error";
import { PRODUCT_CATEGORY_TEMPLATE_ID } from "@/lib/print-document";
import { usePrintDocument } from "@/hooks/use-print-document";
import { useExportReportMutation } from "@/hooks/use-export-report";

export const PRODUCT_CATEGORY_REPORT_NAME = "Product Category Report";

/** ช่วงรหัสที่ f_product_category รับ — "ALL" = ไม่จำกัดชั้นนั้น */
export const CATEGORY_REPORT_FILTER_KEYS = [
  "CategoryFrom",
  "CategoryTo",
  "SubCategoryFrom",
  "SubCategoryTo",
  "ItemGroupFrom",
  "ItemGroupTo",
] as const;

export type CategoryReportFilters = Record<
  (typeof CATEGORY_REPORT_FILTER_KEYS)[number],
  string
>;

/**
 * Product Category Report จากหน้า category — template แบบ form (ไม่อยู่ในหน้ารายการรายงาน)
 * - `printReport` เปิด viewer แท็บใหม่ (ทางเดียวกับปุ่ม Print ของหน้าผู้ขาย)
 * - `exportReport` ดาวน์โหลด CSV แบบ flat (Category / Sub Category / Item Group เรียงตามรหัส)
 *   จาก /reports/export — แถวชุดเดียวกับใบพิมพ์
 *
 * @returns ฟังก์ชันพิมพ์ / ส่งออก ซึ่งคืน true เมื่อสำเร็จ (ให้ dialog ปิดตัวเอง) และสถานะกำลังทำงาน
 */
export function useCategoryReport() {
  const t = useTranslations("report");
  const { print, isPrinting } = usePrintDocument();
  const exportMutation = useExportReportMutation();
  // isPending จาก closure ยังเป็น false จนกว่า React จะ re-render — คลิกซ้ำใน tick เดียวกันหลุดผ่านได้
  const exportInFlight = useRef(false);

  const printReport = async (filters: CategoryReportFilters) =>
    (await print("PRODUCT_CATEGORY", {
      templateId: PRODUCT_CATEGORY_TEMPLATE_ID,
      filters,
    })) !== null;

  const exportReport = async (filters: CategoryReportFilters) => {
    if (exportInFlight.current) return false;
    exportInFlight.current = true;
    const name = PRODUCT_CATEGORY_REPORT_NAME;
    const toastId = toast.loading(t("generating", { name }));
    try {
      const { blob, fileName, rowCount } = await exportMutation.mutateAsync({
        template_id: PRODUCT_CATEGORY_TEMPLATE_ID,
        filters,
      });
      if (rowCount === 0) {
        toast.info(t("exportNoData"), { id: toastId });
        return false;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName ?? "product_category.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(t("exportReady", { name }), { id: toastId });
      return true;
    } catch (err) {
      // REPORT_TEMPLATE_UNAVAILABLE = template ยังไม่ลง / ปิดไว้สำหรับ BU นี้ — บอกตรง ๆ แทนข้อความกลาง
      const unavailable =
        err instanceof ApiError &&
        err.appCode === "REPORT_TEMPLATE_UNAVAILABLE";
      toast.error(unavailable ? t("unavailableForBu") : t("exportError"), {
        id: toastId,
      });
      return false;
    } finally {
      exportInFlight.current = false;
    }
  };

  return {
    printReport,
    exportReport,
    isBusy: isPrinting || exportMutation.isPending,
  };
}
