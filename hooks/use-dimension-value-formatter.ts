import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatDimensionValue, ymdToLocalDate } from "@/lib/dimension-value";
import type { DimensionMaster } from "@/types/accounting-master";
import type { DimensionRef } from "@/types/gl-dimension";

/** `formatDimensionValue` ที่ผูก i18n (Yes/No), locale ตัวเลขของ BU และรูปแบบวันที่ของโปรไฟล์ */
export function useDimensionValueFormatter() {
  const common = useTranslations("common");
  const { defaultBu, dateFormat } = useProfile();
  const locales = defaultBu?.config?.amount_format?.locales ?? "en-US";
  const labels = {
    yes: common("yes"),
    no: common("no"),
    formatNumber: (text: string) => {
      const n = Number(text);
      return Number.isFinite(n)
        ? new Intl.NumberFormat(locales, { maximumFractionDigits: 5 }).format(n)
        : text;
    },
    formatDate: (ymd: string) => {
      const d = ymdToLocalDate(ymd);
      return d ? formatDate(d.toISOString(), dateFormat) : ymd;
    },
  };
  return (
    ref: DimensionRef,
    dimension?: Pick<DimensionMaster, "data_type">,
  ) => formatDimensionValue(ref, dimension, labels);
}
