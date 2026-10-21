import { formatCurrency } from "@/lib/currency-utils";
import { HiddenValue } from "@/components/share/hidden-value";

interface Props {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly netAmount: number;
  readonly taxAmount: number;
  readonly totalPrice: number;
  readonly exchangeRate: number;
  readonly isForeignCurrency: boolean;
  readonly baseCurrencyCode?: string;
  /** stage ซ่อน `total_price` — ยอดสกุลฐาน (`base_*`) เป็น badge แทนตัวเลข */
  readonly isHidden?: boolean;
}

export function PrItemSummary({
  subtotal,
  discountAmount,
  netAmount,
  taxAmount,
  totalPrice,
  exchangeRate,
  isForeignCurrency,
  baseCurrencyCode,
  isHidden = false,
}: Props) {
  if (!isForeignCurrency) return null;

  const metrics = [
    { k: "subtotal", v: subtotal },
    { k: "discount", v: discountAmount },
    { k: "net", v: netAmount },
    { k: "tax", v: taxAmount },
    { k: "total", v: totalPrice },
  ];

  return (
    <>
      {/* base currency code — คอลัมน์ Currency (col 3) แถวเดียวกับค่า base */}
      <div className="text-muted-foreground text-micro col-start-3 flex items-center justify-end">
        {baseCurrencyCode}
      </div>
      {metrics.map((m, i) => (
        <div
          key={m.k}
          className={`text-muted-foreground text-micro flex items-center justify-end tabular-nums ${
            i === 0 ? "col-start-6" : ""
          }`}
        >
          {isHidden ? <HiddenValue /> : formatCurrency(m.v * exchangeRate)}
        </div>
      ))}
    </>
  );
}
