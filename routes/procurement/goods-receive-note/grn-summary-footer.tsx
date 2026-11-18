import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { formatCurrency } from "@/lib/currency-utils";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { sumGrnItems } from "./grn-summary";
import { useCurrency } from "@/hooks/use-currency";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Currency } from "@/types/currency";
import type { GrnFormValues } from "./grn-form-schema";
import { GrnFooterAction } from "./grn-footer-action";

interface GrnSummaryFooterProps {
  readonly form: UseFormReturn<GrnFormValues>;
  readonly isActionPending: boolean;
  readonly hasRecord: boolean;
  readonly isView: boolean;
  readonly isCommitted: boolean;
  readonly isVoid: boolean;
  readonly onCommit: () => void;
  readonly onVoid: () => void;
}

export function GrnSummaryFooter({
  form,
  isActionPending,
  hasRecord,
  isView,
  isCommitted,
  isVoid,
  onCommit,
  onVoid,
}: GrnSummaryFooterProps) {
  "use no memo";
  const tfl = useTranslations("field");

  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const currencyId = useWatch({ control: form.control, name: "currency_id" });
  const currencyName =
    useWatch({ control: form.control, name: "currency_name" }) ?? "";

  const { items: currencies } = useEntitiesByIds<Currency>({
    useListHook: useCurrency,
    ids: currencyId ? [currencyId] : [],
  });
  const currencyCode =
    currencies.find((c) => c.id === currencyId)?.code || currencyName;

  const summary = sumGrnItems(items);

  if (items.length === 0) return null;

  return (
    <SummaryFooterBar
      hasRecord
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
      {/* commit/void อยู่ line เดียวกับ summary (ขวาล่าง เหมือน PR footer) */}
      <GrnFooterAction
        isActionPending={isActionPending}
        hasRecord={hasRecord}
        isView={isView}
        isCommitted={isCommitted}
        isVoid={isVoid}
        onCommit={onCommit}
        onVoid={onVoid}
      />
    </SummaryFooterBar>
  );
}
