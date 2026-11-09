import { lazy, Suspense, useState } from "react";
import { useWatch, type Control, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STAGE_ROLE } from "@/types/stage-role";
import { PR_ITEM_PRICELIST_COMPARE_TYPE } from "@/types/purchase-request";
import { formatDate } from "@/lib/date-utils";
import type { PrFormValues } from "./pr-form-schema";
import { applyDerivedAmounts } from "./pr-auto-allocate";
import type { PricelistEntry } from "./pr-pricelist-dialog";

const PrPricelistDialog = lazy(() =>
  import("./pr-pricelist-dialog").then((mod) => ({
    default: mod.PrPricelistDialog,
  })),
);

interface Props {
  readonly control: Control<PrFormValues>;
  readonly form: UseFormReturn<PrFormValues>;
  readonly index: number;
  readonly role?: string;
  readonly isDisabled: boolean;
}

export function PrPricelistCompare({
  control,
  form,
  index,
  role,
  isDisabled,
}: Props) {
  "use no memo";
  const tc = useTranslations("common");
  const [showPricelist, setShowPricelist] = useState(false);

  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const unitId =
    useWatch({ control, name: `items.${index}.requested_unit_id` }) ?? "";
  const currencyId =
    useWatch({ control, name: `items.${index}.currency_id` }) ?? "";
  const deliveryDate =
    useWatch({ control, name: `items.${index}.delivery_date` }) ?? "";
  const requestedQty =
    useWatch({ control, name: `items.${index}.requested_qty` }) ?? 0;
  const requestedUnitName =
    useWatch({ control, name: `items.${index}.requested_unit_name` }) ?? "";
  const approvedQty =
    useWatch({ control, name: `items.${index}.approved_qty` }) ?? 0;
  const approvedUnitName =
    useWatch({ control, name: `items.${index}.approved_unit_name` }) ?? "";

  const canCompare =
    !!productId &&
    !!unitId &&
    !!currencyId &&
    (role === STAGE_ROLE.PURCHASE || role === STAGE_ROLE.APPROVE);

  if (!canCompare) return null;

  const handleSelect = (entry: PricelistEntry) => {
    form.setValue(`items.${index}.vendor_id`, entry.vendor_id);
    form.setValue(`items.${index}.vendor_name`, entry.vendor_name);
    form.setValue(`items.${index}.pricelist_price`, entry.price);
    // ราคากับธง Inc VAT ต้องมาจาก entry เดียวกันเสมอ
    form.setValue(
      `items.${index}.is_tax_included`,
      entry.is_tax_included ?? false,
    );
    // อัตราภาษีเดินทางมากับราคา — ไม่งั้นราคารวม VAT จะถูกถอดด้วยอัตราของ tax profile เดิม
    if (entry.tax_profile_id !== undefined) {
      form.setValue(`items.${index}.tax_profile_id`, entry.tax_profile_id);
      form.setValue(
        `items.${index}.tax_profile_name`,
        entry.tax_profile_name ?? "",
      );
      form.setValue(`items.${index}.tax_rate`, entry.tax_rate ?? 0);
    }
    form.setValue(
      `items.${index}.pricelist_detail_id`,
      entry.pricelist_detail_id,
    );
    form.setValue(`items.${index}.pricelist_no`, entry.pricelist_no);
    form.setValue(
      `items.${index}.pricelist_type`,
      PR_ITEM_PRICELIST_COMPARE_TYPE.MANUAL_SELECT,
    );
    applyDerivedAmounts(
      form,
      index,
      form.getValues(`items.${index}`),
      entry.price,
      Number(form.getValues(`items.${index}.tax_rate`)) || 0,
      entry.is_tax_included ?? false,
    );
  };

  return (
    <div className="pt-3">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-primary"
              aria-label={tc("comparePrice")}
              onClick={() => setShowPricelist(true)}
            >
              <Scale className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tc("comparePrice")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Suspense fallback={null}>
        <PrPricelistDialog
          open={showPricelist}
          onOpenChange={setShowPricelist}
          productId={productId}
          productName={productName}
          unitId={unitId}
          currencyId={currencyId}
          atDate={formatDate(deliveryDate, "yyyy-MM-dd")}
          requestedQty={requestedQty}
          requestedUnitName={requestedUnitName}
          approvedQty={approvedQty}
          approvedUnitName={approvedUnitName}
          onSelect={handleSelect}
          readOnly={isDisabled || role !== STAGE_ROLE.PURCHASE}
        />
      </Suspense>
    </div>
  );
}
