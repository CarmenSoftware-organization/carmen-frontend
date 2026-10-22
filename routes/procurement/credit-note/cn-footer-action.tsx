import { useTranslations } from "use-intl";
import { useWatch, type Control } from "react-hook-form";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClaimFormPrimary } from "@/components/share/form-primary-action";
import { formatCurrency } from "@/lib/currency-utils";
import { useCurrency } from "@/hooks/use-currency";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Currency } from "@/types/currency";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import type { CnFormValues } from "./cn-form-schema";

interface CnFooterActionProps {
  readonly control: Control<CnFormValues>;
  readonly canSubmit: boolean;
  readonly isPending: boolean;
  readonly onSubmitCn: () => void;
}

export function CnFooterAction({
  control,
  canSubmit,
  isPending,
  onSubmitCn,
}: CnFooterActionProps) {
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  useClaimFormPrimary(canSubmit);
  const items = useWatch({ control, name: "items" });
  // currency_code เก็บ id → resolve เป็นตัวอักษรสกุลเงินสำหรับต่อท้าย total
  const currencyId = useWatch({ control, name: "currency_code" }) ?? "";
  const { items: currencies } = useEntitiesByIds<Currency>({
    useListHook: useCurrency,
    ids: currencyId ? [currencyId] : [],
  });
  const currencyCode = currencies.find((c) => c.id === currencyId)?.code ?? "";

  // grand summary — โครง 5 ช่องเหมือน PO (subtotal · discount · net · tax · grand)
  // subtotal = net + discount (net_amount = subtotal − discount ต่อบรรทัดแล้ว)
  let subtotal = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalTax = 0;
  let grandTotal = 0;
  for (const item of items) {
    const net = Number(item?.net_amount ?? 0);
    const disc = Number(item?.discount_amount ?? 0);
    subtotal += net + disc;
    totalDiscount += disc;
    totalNet += net;
    totalTax += Number(item?.tax_amount ?? 0);
    grandTotal += Number(item?.total_amount ?? 0);
  }
  const summary = { subtotal, totalDiscount, totalNet, totalTax, grandTotal };

  return (
    <SummaryFooterBar
      hasRecord={items.length > 0}
      items={[
        {
          key: "subtotal",
          label: tfl("subtotal"),
          value: formatCurrency(summary.subtotal),
        },
        {
          key: "discount",
          label: tfl("discount"),
          value:
            summary.totalDiscount > 0
              ? `-${formatCurrency(summary.totalDiscount)}`
              : formatCurrency(0),
          valueClassName:
            summary.totalDiscount > 0 ? "text-destructive" : undefined,
        },
        {
          key: "net",
          label: tfl("net"),
          value: formatCurrency(summary.totalNet),
        },
        {
          key: "tax",
          label: tfl("tax"),
          value: formatCurrency(summary.totalTax),
        },
        {
          key: "grandTotal",
          label: tfl("grandTotal"),
          value: formatCurrency(summary.grandTotal),
          emphasis: true,
          suffix: currencyCode,
        },
      ]}
    >
      {/* ส่งใบอยู่ line เดียวกับสรุปยอด (ขวาล่าง เหมือน PR/PO/GRN/SR) — เป็นการ
          ตัดสินใจหลังอ่านยอดจบ ไม่ใช่คำสั่งจัดการใบแบบแก้ไข/ลบที่อยู่หัวใบ */}
      {canSubmit && (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={onSubmitCn}
          >
            <SendHorizontal aria-hidden="true" />
            {tc("submit")}
          </Button>
        </div>
      )}
    </SummaryFooterBar>
  );
}
