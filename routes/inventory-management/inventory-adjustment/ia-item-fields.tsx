import { useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { BoxIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingSection } from "@/components/ui/setting-section";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import EmptyComponent from "@/components/empty-component";
import type { InventoryAdjustmentType } from "@/types/inventory-adjustment";
import type { AdjFormValues } from "./ia-form-schema";
import { ADJ_ITEM } from "./ia-form-schema";
import { useAdjItemTable } from "./use-ia-item-table";
import { getDeleteDescription } from "@/lib/form-utils";

interface AdjItemFieldsProps {
  readonly form: UseFormReturn<AdjFormValues>;
  readonly disabled: boolean;
  readonly adjustmentType: InventoryAdjustmentType;
}

export function AdjItemFields({
  form,
  disabled,
  adjustmentType,
}: AdjItemFieldsProps) {
  "use no memo";
  const t = useTranslations("inventoryManagement.inventoryAdjustment");
  const tfl = useTranslations("field");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const {
    fields: itemFields,
    prepend: prependItem,
    remove: removeItem,
  } = useFieldArray({ control: form.control, name: "items" });

  // แถวที่เพิ่งเพิ่มเปิดช่องเลือกสินค้าให้เลย (ท่าเดียวกับ GRN) — prepend วางแถว
  // ใหม่ไว้บนสุดเสมอ index 0 จึงเป็นตัวที่ต้องเปิด
  const locationId = useWatch({ control: form.control, name: "location_id" });
  const [autoOpenFirst, setAutoOpenFirst] = useState(false);

  const handleAddItem = () => {
    // ช่องเลือกสินค้าดึงเฉพาะของที่มีในคลังที่เลือก — ยังไม่เลือกคลังก็เพิ่มแถวไป
    // ก็กดเลือกอะไรไม่ได้ บอกไปตรง ๆ ดีกว่าปล่อยให้งง
    if (!locationId) {
      toast.warning(t("selectLocationFirst"));
      return;
    }
    prependItem({ ...ADJ_ITEM });
    setAutoOpenFirst(true);
  };

  const { table } = useAdjItemTable({
    form,
    itemFields,
    disabled,
    onDelete: setDeleteIndex,
    adjustmentType,
    autoOpenFirst,
    onProductPicked: () => setAutoOpenFirst(false),
  });

  const itemsError = form.formState.errors.items;
  const itemsRootMessage =
    typeof itemsError?.message === "string" ? itemsError.message : undefined;

  return (
    <>
      <SettingSection
        wide
        frameless
        title={tfl("items")}
        count={itemFields.length}
        // "เพิ่มรายการ…" เป็นคำชวนทำ — ใบที่อ่านอย่างเดียวไม่มีอะไรให้เพิ่ม
        description={disabled ? undefined : t("noItemsDesc")}
        action={
          !disabled ? (
            <Button type="button" size="sm" onClick={handleAddItem}>
              <Plus /> {t("addItem")}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-2">
          {itemsRootMessage && (
            <p className="text-destructive text-xs" role="alert">
              {itemsRootMessage}
            </p>
          )}

          <DataGrid
            tableLayout={{
              rowClamp: false,
              // โหมดอ่านชิดบน — ชื่อสินค้ามีบรรทัดรอง เซลล์อื่นไม่มี
              cellAlign: disabled ? "top" : "middle",
            }}
            table={table}
            recordCount={itemFields.length}
            emptyMessage={
              // ปุ่มเพิ่มรายการอยู่ที่หัวข้อของ section อยู่แล้ว ไม่ต้องมีซ้ำ
              // ในกล่องว่าง — ปุ่มเดียวกันสองที่บนจอเดียว
              <EmptyComponent
                icon={BoxIcon}
                title={t("noItems")}
                description={t("noItemsDesc")}
              />
            }
          >
            <DataGridContainer>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        </div>
      </SettingSection>

      <DeleteDialog
        open={deleteIndex !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIndex(null);
        }}
        title={t("removeItem")}
        description={getDeleteDescription(deleteIndex, form)}
        onConfirm={() => {
          if (deleteIndex === null) return;
          removeItem(deleteIndex);
          setDeleteIndex(null);
        }}
      />
    </>
  );
}
