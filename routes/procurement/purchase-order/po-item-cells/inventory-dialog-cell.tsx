import { memo, useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import { InventoryDialog } from "@/components/share/inventory-dialog";
import { OnHandDialog } from "@/components/share/on-hand-dialog";
import { OnOrderDialog } from "@/components/share/on-order-dialog";
import { useBuCode } from "@/hooks/use-bu-code";
import type { PoFormValues } from "../po-form-schema";

export const PoInventoryDialog = memo(function PoInventoryDialog({
  control,
  index,
}: {
  control: Control<PoFormValues>;
  index: number;
}) {
  "use no memo";
  const buCode = useBuCode();
  const locationId =
    useWatch({ control, name: `items.${index}.location_id` }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  const unitName =
    useWatch({ control, name: `items.${index}.order_unit_name` }) ?? "";
  // on hand ณ ปัจจุบัน ไม่ส่งวันที่ของใบไป
  const [onHandOpen, setOnHandOpen] = useState(false);
  const [onOrderOpen, setOnOrderOpen] = useState(false);

  return (
    <>
      <InventoryDialog
        buCode={buCode}
        locationId={locationId}
        productId={productId}
        productName={productName}
        productLocalName={productLocalName}
        unitName={unitName}
        icon="package"
        className={productId ? "text-primary" : "text-muted-foreground"}
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
});
