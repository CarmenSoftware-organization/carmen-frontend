import {
  Controller,
  useWatch,
  type UseFormReturn,
  type Control,
} from "react-hook-form";
import { memo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LookupProductInLocation } from "@/components/lookup/lookup-product-in-location";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { OnHandDialog } from "@/components/share/on-hand-dialog";
import { OnOrderDialog } from "@/components/share/on-order-dialog";
import type { PrFormValues } from "../pr-form-schema";
import { InventoryDialogCell, useIsRowLocked } from "./helpers";

export const ProductCell = memo(function ProductCell({
  control,
  form,
  index,
  isDisabled,
  buCode,
}: {
  control: Control<PrFormValues>;
  form: UseFormReturn<PrFormValues>;
  index: number;
  isDisabled: boolean;
  buCode?: string;
}) {
  "use no memo";
  const locationId =
    useWatch({ control, name: `items.${index}.location_id` }) ?? "";
  const workflowId = useWatch({ control, name: "workflow_id" }) ?? "";
  const productCode =
    useWatch({ control, name: `items.${index}.product_code` }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  const unitName =
    useWatch({ control, name: `items.${index}.requested_unit_name` }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const isRowLocked = useIsRowLocked(control, index);
  const [onHandOpen, setOnHandOpen] = useState(false);
  const [onOrderOpen, setOnOrderOpen] = useState(false);

  // กด "คงเหลือ"/"กำลังสั่ง" ใน tooltip สต็อก แล้วเปิด dialog รายละเอียดต่อ —
  // ทรงเดียวกับ SR (sr-item-table.tsx) และแถบ inventory ใต้แถว (pr-inventory-row)
  const inventoryTooltip = (
    <>
      <InventoryDialogCell
        control={control}
        index={index}
        buCode={buCode}
        onOnHandClick={productId ? () => setOnHandOpen(true) : undefined}
        onOnOrderClick={productId ? () => setOnOrderOpen(true) : undefined}
      />
      {productId && (
        <>
          <OnHandDialog
            open={onHandOpen}
            onOpenChange={setOnHandOpen}
            productId={productId}
          />
          <OnOrderDialog
            open={onOrderOpen}
            onOpenChange={setOnOrderOpen}
            productId={productId}
          />
        </>
      )}
    </>
  );
  if (isDisabled || isRowLocked) {
    return (
      // ไอคอนอยู่ **นอก** stack สองบรรทัด จัดกลางเทียบทั้งก้อน — ทรงเดียวกับ SR
      // (sr-item-table.tsx) ปุ่ม icon-xs 24px จึงไม่ไปดันบรรทัดแรกให้สูงกว่าตัวหนังสือ
      // ซึ่งเป็นต้นเหตุที่คอลัมน์นี้กับ Location เคยมีระยะไม่เท่ากัน
      <div className="flex items-center gap-0.5">
        <div className="min-w-0 flex-1">
          <NameWithSubtext
            primary={productName || "—"}
            secondary={productLocalName || "—"}
          />
        </div>
        {inventoryTooltip}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Controller
        control={control}
        name={`items.${index}.product_id`}
        render={({ field }) => (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 flex-1">
                  <LookupProductInLocation
                    locationId={locationId}
                    workflowId={workflowId}
                    value={field.value ?? ""}
                    disableTooltip
                    error={
                      form.formState.errors.items?.[index]?.product_id?.message
                    }
                    onValueChange={(value, product) => {
                      field.onChange(value);
                      if (product) {
                        form.setValue(
                          `items.${index}.product_code`,
                          product.code,
                        );
                        form.setValue(
                          `items.${index}.product_name`,
                          product.name,
                        );
                        form.setValue(
                          `items.${index}.product_local_name`,
                          product.local_name ?? "",
                        );
                        // หน่วยนับสต็อกของสินค้า — ไม่ใช่หน่วยที่ขอเบิก แต่เป็น key
                        // ที่ last-receiving ใช้ถามต้นทุนครั้งก่อน (ดู
                        // pr-last-receiving-info / pr-price-alert-badge)
                        // ไม่เซ็ตไว้ = แถวที่เพิ่งเลือกสินค้าไม่มีไอคอนราคาครั้งก่อน
                        // และไม่มีธงเตือนราคาแพงขึ้นเลย ทั้งที่ของเดิมในใบมี
                        form.setValue(
                          `items.${index}.inventory_unit_id`,
                          product.inventory_unit?.id ?? null,
                        );
                        form.setValue(
                          `items.${index}.inventory_unit_name`,
                          product.inventory_unit?.name ??
                            product.inventory_unit_name ??
                            "",
                        );
                      }
                      form.setValue(`items.${index}.requested_unit_id`, "");
                      form.setValue(`items.${index}.foc_unit_id`, "");
                      form.setValue(`items.${index}.approved_unit_id`, "");
                    }}
                    className="h-8 w-full text-xs"
                    defaultLabel={productName}
                  />
                </div>
              </TooltipTrigger>
              {(productCode || productName) && (
                <TooltipContent
                  side="top"
                  className="max-w-[20rem]"
                >
                  <div className="space-y-1">
                    <p className="text-foreground/60 text-micro font-semibold">
                      {productCode}
                    </p>
                    <p className="text-xs leading-snug font-semibold">
                      {productName}
                    </p>
                  </div>
                  {(productLocalName || unitName) && (
                    <div className="text-foreground/60 text-micro mt-2 flex items-center gap-2 border-t pt-2">
                      {productLocalName && <span>{productLocalName}</span>}
                      {productLocalName && unitName && (
                        <span aria-hidden="true">·</span>
                      )}
                      {unitName && (
                        <span className="font-semibold">{unitName}</span>
                      )}
                    </div>
                  )}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
      />
      {inventoryTooltip}
    </div>
  );
});
