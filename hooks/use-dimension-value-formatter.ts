import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDimensionValue } from "@/lib/dimension-value";
import type { DimensionMaster } from "@/types/accounting-master";
import type { DimensionRef } from "@/types/gl-dimension";

/** `formatDimensionValue` ที่ผูก i18n (Yes/No) และ locale ตัวเลขของ BU */
export function useDimensionValueFormatter() {
  const common = useTranslations("common");
  const { defaultBu } = useProfile();
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
  };
  return (
    ref: DimensionRef,
    dimension?: Pick<DimensionMaster, "data_type" | "date_format">,
  ) => formatDimensionValue(ref, dimension, labels);
}
