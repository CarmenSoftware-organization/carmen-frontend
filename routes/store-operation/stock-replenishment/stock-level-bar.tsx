import { useTranslations } from "use-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProductLocation } from "@/types/stock-replenishment";

const FILL_CLASS: Record<ProductLocation["status"], string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  low: "bg-muted-foreground/60",
};

const pct = (value: number, scale: number) =>
  `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;

interface StockLevelBarProps {
  readonly product: ProductLocation;
}

/**
 * แทนคอลัมน์ On Hand / Min / Max / Par สี่ช่อง — คำถามของหน้านี้คือ "ห่างจากเกณฑ์
 * แค่ไหน" ซึ่งตัวเลขสี่ตัวเรียงกันตอบด้วยตาไม่ได้ แถบเติมถึง on hand (สีตามสถานะ)
 * ขีดตั้งคือ min กับ par ตัวเลขดิบทั้งสี่อยู่ใน tooltip และ aria-label
 *
 * สเกลคือค่ามากสุดของทั้งสี่ — ข้อมูลจริงมี max = 0 ทั้งที่ par > 0 (MOOZE VODKA บน
 * ZB01) จึงยึด max ตัวเดียวไม่ได้
 */
export function StockLevelBar({ product }: StockLevelBarProps) {
  const t = useTranslations("storeOperation.stockReplenishment");
  const tfl = useTranslations("field");
  const { on_hand_qty, min_qty, max_qty, par_qty, status } = product;
  const scale = Math.max(on_hand_qty, min_qty, max_qty, par_qty) || 1;

  const rows = [
    [tfl("onHandQty"), on_hand_qty],
    [tfl("minQty"), min_qty],
    [tfl("parQty"), par_qty],
    [tfl("maxQty"), max_qty],
  ] as const;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          // focus ได้เพื่อให้คีย์บอร์ดเปิด tooltip ได้ — ตัวเลขดิบไม่มีที่อื่นให้อ่าน
          tabIndex={0}
          role="img"
          aria-label={t("stockLevelAria", {
            onHand: on_hand_qty,
            min: min_qty,
            par: par_qty,
            max: max_qty,
          })}
          className="focus-visible:ring-ring/50 flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2"
        >
          <span className="w-10 shrink-0 text-right font-semibold tabular-nums">
            {on_hand_qty.toLocaleString()}
          </span>
          <span className="bg-muted relative h-1.5 flex-1 rounded-full">
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                FILL_CLASS[status],
              )}
              style={{ width: pct(on_hand_qty, scale) }}
            />
            {min_qty > 0 && (
              <span
                className="bg-foreground/70 absolute -inset-y-1 w-px"
                style={{ left: pct(min_qty, scale) }}
              />
            )}
            {par_qty > 0 && (
              <span
                className="bg-foreground/35 absolute -inset-y-1 w-px"
                style={{ left: pct(par_qty, scale) }}
              />
            )}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right tabular-nums">
                {value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}
