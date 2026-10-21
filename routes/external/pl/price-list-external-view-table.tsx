import { formatTaxRate, priceListTaxParts } from "@/lib/price-list-tax";
import { cn } from "@/lib/utils";
import type { PricelistExternalDetailDto } from "@/types/price-list-external";

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface PriceListExternalViewTableProps {
  readonly details: readonly PricelistExternalDetailDto[];
}

/**
 * View-mode ตาราง read-only ของ price list external — คอลัมน์ตรงกับ edit mode
 * เป๊ะ (Product · Unit · MOQ · Price · Tax Profile · Tax Rate · Tax Amount ·
 * Total · Lead Time) · 1 แถว/product เหมือน edit (MOQ tiers ซ้อนอยู่ใน
 * moq_tiers ไม่โชว์ที่นี่ เหมือน edit ที่พับไว้) · Tax amount/Total คำนวณสดจาก
 * price + rate ด้วย priceListTaxParts ตัวเดียวกับ edit (price = ก่อนภาษี)
 */
export default function PriceListExternalViewTable({
  details,
}: PriceListExternalViewTableProps) {
  return (
    <div className="border-border/60 bg-card w-full overflow-x-auto rounded-lg border">
      <table className="text-foreground w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground border-border/60 border-b">
            <Th className="w-12 text-center">#</Th>
            <Th className="text-left">Product</Th>
            <Th className="text-left">Unit</Th>
            <Th className="text-right">MOQ</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-left">Tax Profile</Th>
            <Th className="text-right">Tax Rate</Th>
            <Th className="text-right">Tax Amount</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">Lead Time</Th>
          </tr>
        </thead>
        <tbody>
          {details.map((d) => {
            const { price: p, taxAmt, total } = priceListTaxParts(
              d.price,
              d.tax_rate,
            );
            return (
              <tr key={d.id} className="border-border/50 border-b">
                <Td className="text-muted-foreground text-center tabular-nums">
                  {d.sequence_no}
                </Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium">{d.product_name}</span>
                    {d.product_code && (
                      <span className="text-muted-foreground text-micro">
                        {d.product_code}
                      </span>
                    )}
                  </div>
                </Td>
                <Td className="text-muted-foreground">{d.unit_name || "—"}</Td>
                <Td className="text-right tabular-nums">
                  {Number(d.moq_qty) || 0}
                </Td>
                <Td className="text-right tabular-nums">{fmtMoney(p)}</Td>
                <Td>{d.tax_profile_name || "—"}</Td>
                <Td className="text-muted-foreground text-right tabular-nums">
                  {formatTaxRate(d.tax_rate, !!d.tax_profile_id)}
                </Td>
                <Td className="text-right tabular-nums">{fmtMoney(taxAmt)}</Td>
                <Td className="text-right font-medium tabular-nums">
                  {fmtMoney(total)}
                </Td>
                <Td className="text-right tabular-nums">
                  {Number(d.lead_time_days) || 0}
                </Td>
              </tr>
            );
          })}
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
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>
  );
}
