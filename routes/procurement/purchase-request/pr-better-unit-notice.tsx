import { useTranslations } from "use-intl";
import { ArrowRightLeft } from "lucide-react";
import { formatCurrency } from "@/lib/currency-utils";

/**
 * ข้อเสนอให้ซื้อจำนวนเดิมด้วยหน่วยอื่นของสินค้า — `suggests.better_unit` ของ price-compare
 * backend ปัดจำนวนขึ้นเป็นหน่วยนั้นแล้ว (ได้ของเท่าเดิมหรือมากกว่า ไม่มีทางน้อยลง) และแนะนำเฉพาะเมื่อ
 * ราคาต่อหน่วยฐานถูกกว่าราคาที่ถูกที่สุดในหน่วยที่สั่งอยู่
 */
export interface BetterUnitOffer {
  pricelist_detail_id: string;
  pricelist_no: string;
  vendor_name: string;
  unit_name: string;
  price: number;
  currency: string;
  /** จำนวนที่ต้องสั่งในหน่วยนั้น (ปัดขึ้นแล้ว) */
  order_qty: number;
  /** order_qty คิดเป็นหน่วยฐาน */
  base_qty: number;
  /** หน่วยฐานที่ได้เกินจำนวนที่ขอ เพราะต้องปัดขึ้น */
  extra_base_qty: number;
  base_unit_name: string;
  price_per_base_unit: number;
  total_price: number;
  /** null = หน่วยที่สั่งไม่มีราคาให้เทียบ */
  saving_per_base_unit: number | null;
}

/**
 * กล่องแนะนำ "สั่งเป็นหน่วยอื่นถูกกว่า" เหนือตารางเทียบราคา — แสดงอย่างเดียว ไม่เปลี่ยนรายการให้
 * (เปลี่ยนหน่วย/จำนวนของรายการเป็นการตัดสินใจของผู้ซื้อ) ไม่มีข้อเสนอ = ไม่แสดงอะไร
 */
export function PrBetterUnitNotice({
  offers,
}: {
  readonly offers: readonly BetterUnitOffer[];
}) {
  const t = useTranslations("procurement.purchaseRequest.betterUnit");
  if (offers.length === 0) return null;

  return (
    <div
      role="note"
      aria-label={t("title")}
      className="border-success/40 bg-success/5 mb-3 rounded-lg border px-3 py-2.5 text-xs"
    >
      <p className="text-success-ink mb-1 flex items-center gap-1.5 font-semibold">
        <ArrowRightLeft className="size-3.5" aria-hidden />
        {t("title")}
      </p>
      <ul className="space-y-1.5">
        {offers.map((offer) => (
          <li key={offer.pricelist_detail_id}>
            <span className="font-semibold">
              {t("offer", {
                qty: offer.order_qty,
                unit: offer.unit_name,
                vendor: offer.vendor_name,
                pricelistNo: offer.pricelist_no,
              })}
            </span>
            {" · "}
            <span className="tabular-nums">
              {t("price", {
                price: formatCurrency(offer.price),
                currency: offer.currency,
                unit: offer.unit_name,
                total: formatCurrency(offer.total_price),
              })}
            </span>
            <div className="text-muted-foreground flex flex-wrap gap-x-2 tabular-nums">
              <span>
                {t("perBase", {
                  price: formatCurrency(offer.price_per_base_unit),
                  currency: offer.currency,
                  baseUnit: offer.base_unit_name,
                })}
              </span>
              {offer.saving_per_base_unit !== null && (
                <span className="text-success-ink">
                  {t("saving", {
                    saving: formatCurrency(offer.saving_per_base_unit),
                    currency: offer.currency,
                    baseUnit: offer.base_unit_name,
                  })}
                </span>
              )}
              {offer.extra_base_qty > 0 && (
                <span>
                  {t("extra", {
                    extra: offer.extra_base_qty,
                    baseUnit: offer.base_unit_name,
                  })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-1.5">{t("hint")}</p>
    </div>
  );
}
