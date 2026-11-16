import { useTranslations } from "use-intl";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date-utils";
import type { LastPricelistVendor } from "./pr-auto-allocate";

/**
 * กล่อง "ไม่มีใบราคาที่เปิดอยู่ — ผู้ขายล่าสุดที่เคยเสนอราคาสินค้านี้" เหนือตารางเทียบราคา
 * (`last_vendor` ของ price-compare) ปุ่มใส่ได้แค่ผู้ขาย ราคาต้องให้จัดซื้อกรอกเอง —
 * เลขใบราคาเก่าแสดงเป็นที่มาเท่านั้น ไม่ผูกลงบรรทัด · ไม่มีผู้ขาย = ไม่แสดงอะไร
 */
export function PrLastVendorNotice({
  lastVendor,
  dateFormat,
  readOnly,
  onUse,
}: {
  readonly lastVendor: LastPricelistVendor | null;
  readonly dateFormat: string;
  readonly readOnly: boolean;
  readonly onUse: (lastVendor: LastPricelistVendor) => void;
}) {
  const t = useTranslations("procurement.purchaseRequest.lastVendor");
  if (!lastVendor) return null;

  const from = formatDate(lastVendor.effective_date?.from, dateFormat);
  const to = formatDate(lastVendor.effective_date?.to, dateFormat);

  return (
    <div
      role="note"
      aria-label={t("title")}
      className="border-primary/30 bg-primary/5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5 text-xs"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-primary flex items-center gap-1.5 font-semibold">
          <History className="size-3.5" aria-hidden />
          {t("title")}
        </p>
        <p>
          <span className="font-semibold">{lastVendor.vendor_name}</span>
          {lastVendor.vendor_code && (
            <span className="text-muted-foreground">
              {" "}
              ({lastVendor.vendor_code})
            </span>
          )}
          <span className="text-muted-foreground tabular-nums">
            {" · "}
            {t("source", { pricelistNo: lastVendor.pricelist_no })}
            {from && to && ` · ${from} → ${to}`}
          </span>
        </p>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>
      {!readOnly && (
        <Button
          type="button"
          size="xs"
          variant="success"
          onClick={() => onUse(lastVendor)}
        >
          {t("use")}
        </Button>
      )}
    </div>
  );
}
