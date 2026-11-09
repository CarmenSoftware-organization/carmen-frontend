import { useMemo } from "react";
import { useTranslations } from "use-intl";
import { Crown } from "lucide-react";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { PriceWithIncVat } from "@/components/share/inc-vat";
import { formatTaxRate, priceListTaxParts } from "@/lib/price-list-tax";
import { cn } from "@/lib/utils";
import {
  buildProductGroups,
  type GroupableDetail,
} from "./pl-product-grouping";

interface PLItemGroupedViewProps {
  readonly detailRefs: readonly GroupableDetail[];
  readonly showNote?: boolean;
}

/**
 * View-mode grouped table ของ price-list products — product ที่ซ้ำกัน (หลาย MOQ
 * tier) ถูก group เป็น "แถวเดียว": ชื่อ product + ลำดับ span ทั้งกลุ่มด้วย rowspan
 * จัดกึ่งกลางแนวตั้ง, ไม่มีเส้นคั่นระหว่าง tier ในกลุ่ม (เส้นคั่นเฉพาะระหว่างกลุ่ม)
 * tier เรียงตาม MOQ น้อย→มาก (read-only, ขับด้วย detailRefs ล้วน)
 */
export function PLItemGroupedView({
  detailRefs,
  showNote = false,
}: PLItemGroupedViewProps) {
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const groups = useMemo(() => buildProductGroups(detailRefs), [detailRefs]);

  return (
    <div className="border-border/60 bg-card w-full overflow-x-auto rounded-lg border">
      <table className="text-foreground w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground border-border/60 border-b">
            <Th className="w-14 text-center">#</Th>
            {/* Product มีเพดานกว้าง — ไม่งั้นมันกินที่ว่างทั้งหมด ดันตัวเลขไปกองกลางจอ
                และเหลือ Note แคบติดขอบขวา · ที่เหลือยกให้ Note (คอลัมน์เดียวที่ไม่มีความกว้าง) */}
            <Th className="w-[28%] min-w-40 text-left sm:min-w-56">{tfl("product")}</Th>
            <Th className="w-36 text-left">{tfl("moq")}</Th>
            <Th className="w-32 text-right">{tfl("price")}</Th>
            <Th className="w-20 text-right">{tfl("taxRate")}</Th>
            <Th className="w-20 text-right">{tfl("tax")}</Th>
            {/* Total รวม VAT เสมอ (ไม่ติ๊ก = price + tax · ติ๊ก = price) บอกที่หัวคอลัมน์ครั้งเดียว */}
            <Th className="w-28 text-right">
              {tfl("total")}{" "}
              <span className="text-micro font-normal">({tc("incVat")})</span>
            </Th>
            {/* ไม่มี Note = คอลัมน์ว่างรับที่เหลือแทน ไม่งั้นตัวเลขกระจายเต็มจอ */}
            {showNote ? (
              <Th className="min-w-40 text-left">{tfl("note")}</Th>
            ) : (
              <th aria-hidden />
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) =>
            group.tiers.map((tier, ti) => {
              const isFirst = ti === 0;
              const isLast = ti === group.tiers.length - 1;
              const tierClass = cn(
                "py-1",
                isLast && "border-border/50 border-b",
              );
              // price = เลขที่กรอก · ไม่ติ๊ก Inc VAT: Tax = price × rate, Total = price + Tax · ติ๊ก: Total = price, Tax ถอดจาก price
              // — สูตรเดียวกับตารางแก้ไขและ portal vendor (priceListTaxParts)
              const { price, priceWithoutTax, taxAmt, total } =
                priceListTaxParts(
                  tier.price ?? tier.price_without_tax,
                  tier.tax_rate,
                  tier.is_tax_included,
                );
              return (
                <tr key={tier.id ?? `${group.productId}-${ti}`}>
                  {isFirst && (
                    <>
                      <Td
                        rowSpan={group.tiers.length}
                        className="border-border/50 text-muted-foreground border-b text-center align-middle tabular-nums"
                      >
                        {group.groupNumber}
                      </Td>
                      <Td
                        rowSpan={group.tiers.length}
                        className="border-border/50 border-b align-middle"
                      >
                        <NameWithSubtext
                          primary={tier.product_name ?? ""}
                          secondary={productSubtext(tier)}
                        />
                      </Td>
                    </>
                  )}
                  {/* MOQ tier + lead time (ราคาย้ายไปเป็นคอลัมน์ Price/Total) */}
                  <Td className={cn("align-middle", tierClass)}>
                    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap tabular-nums">
                      {tier.is_preferred && (
                        <Crown
                          className="text-warning-ink size-3 shrink-0"
                          aria-label="preferred"
                        />
                      )}
                      <span className="text-foreground font-medium">
                        {Number(tier.moq_qty) || 0}+ {tier.unit_name ?? "—"}
                      </span>
                      {/* lead time 0 = ส่งทันที/ไม่ได้กรอก — ไม่ต้องขึ้น "· 0d" ทุกขั้น */}
                      {Number(tier.lead_time_days) > 0 && (
                        <span
                          className="text-muted-foreground text-micro"
                          title={tfl("leadTime")}
                        >
                          · {Number(tier.lead_time_days)}d
                        </span>
                      )}
                    </span>
                  </Td>
                  {/* Price = เลขที่กรอก · ติ๊ก Inc VAT แสดงป้ายกำกับ + ราคาก่อน VAT ใน tooltip */}
                  <Td
                    className={cn(
                      "text-foreground text-right align-middle whitespace-nowrap tabular-nums",
                      tierClass,
                    )}
                  >
                    <PriceWithIncVat
                      isTaxIncluded={tier.is_tax_included}
                      title={
                        tier.is_tax_included
                          ? `${priceWithoutTax.toFixed(2)} ${tc("beforeVatShort")}`
                          : undefined
                      }
                    >
                      {price.toFixed(2)}
                    </PriceWithIncVat>
                  </Td>
                  {/* Tax rate = อ่านอย่างเดียว ตาม tax profile */}
                  <Td
                    className={cn(
                      "text-muted-foreground text-right align-middle tabular-nums",
                      tierClass,
                    )}
                  >
                    {formatTaxRate(tier.tax_rate, true)}
                  </Td>
                  {/* Tax = ยอดภาษี (ค่าเงิน) */}
                  <Td
                    className={cn(
                      "text-muted-foreground text-right align-middle tabular-nums",
                      tierClass,
                    )}
                  >
                    {taxAmt.toFixed(2)}
                  </Td>
                  {/* Total = ราคา + ภาษี */}
                  <Td
                    className={cn(
                      "text-foreground text-right align-middle font-semibold tabular-nums",
                      tierClass,
                    )}
                  >
                    {total.toFixed(2)}
                  </Td>
                  {showNote ? (
                    <Td
                      className={cn(
                        "text-muted-foreground align-middle",
                        tierClass,
                      )}
                    >
                      {tier.note || "—"}
                    </Td>
                  ) : (
                    <td aria-hidden className={tierClass} />
                  )}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <th className={cn("px-3 py-2 font-medium whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

function Td({
  className,
  rowSpan,
  children,
}: {
  readonly className?: string;
  readonly rowSpan?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <td rowSpan={rowSpan} className={cn("px-3 py-2", className)}>
      {children}
    </td>
  );
}

/**
 * บรรทัดรองใต้ชื่อสินค้า — ชื่อท้องถิ่นเมื่อต่างจากชื่อหลัก ไม่งั้นรหัสสินค้า
 * (ข้อมูลจริงหลายตัวกรอก local_name ซ้ำกับ name ทำให้ชื่อเดียวขึ้นสองบรรทัด)
 */
function productSubtext(tier: GroupableDetail): string | undefined {
  const name = tier.product_name?.trim().toLowerCase();
  const local = tier.product_local_name?.trim();
  if (local && local.toLowerCase() !== name) return local;
  return tier.product_code ?? undefined;
}
