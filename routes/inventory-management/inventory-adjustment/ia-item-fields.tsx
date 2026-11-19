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
import { useElementWidth } from "@/hooks/use-element-width";
import { IaItemCards } from "./ia-item-cards";

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

  // กล่องแคบ (มือถือ) = การ์ดแถวละใบ — ตาราง 6 คอลัมน์บีบช่องเลือกสินค้าเหลือ "11…"
  // และช่อง Qty แคบจนมองไม่เห็นเลข · ตัดสินจากความกว้างกล่อง ไม่ใช่จอ
  const [setItemsBox, itemsBoxWidth] = useElementWidth();
  const asCards = itemsBoxWidth != null && itemsBoxWidth < 560;
  const emptyMessage = (
    // ปุ่มเพิ่มรายการอยู่ที่หัวข้อของ section อยู่แล้ว ไม่ต้องมีซ้ำ
    // ในกล่องว่าง — ปุ่มเดียวกันสองที่บนจอเดียว
    <EmptyComponent
      icon={BoxIcon}
      title={t("noItems")}
      description={t("noItemsDesc")}
    />
  );

  const itemsError = form.formState.errors.items;
  const itemsRootMessage =
    typeof itemsError?.message === "string" ? itemsError.message : undefined;

  return (
    <>
      {/* first = ไม่มีเส้นคั่นบน — หัวเอกสารเป็นการ์ดแยกจากรายการชัดอยู่แล้ว (ทรงเดียวกับ PR) */}
      <SettingSection
        first
        wide
        frameless
        title={tfl("items")}
        count={itemFields.length}
        // "เพิ่มรายการ…" เป็นคำชวนทำ — ใบที่อ่านอย่างเดียวไม่มีอะไรให้เพิ่ม
        description={disabled ? undefined : t("noItemsDesc")}
        action={
          !disabled ? (
            // secondary เหมือน Add Item ของ PR/SR — ปุ่มหลักของหน้าคือ Commit ที่ footer
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddItem}
            >
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

          {/* กล่องที่วัดความกว้างต้องอยู่ทั้งสองแบบ ไม่งั้นสลับแล้ววัดไม่ได้ */}
          <div ref={setItemsBox}>
            {asCards ? (
              <IaItemCards
                table={table}
                disabled={disabled}
                onDelete={setDeleteIndex}
                empty={emptyMessage}
              />
            ) : (
              <DataGrid
                tableLayout={{
                  rowClamp: false,
                  // โหมดอ่านชิดบน — ชื่อสินค้ามีบรรทัดรอง เซลล์อื่นไม่มี
                  cellAlign: disabled ? "top" : "middle",
                }}
                table={table}
                recordCount={itemFields.length}
                emptyMessage={emptyMessage}
              >
                <DataGridContainer>
                  <DataGridTable />
                </DataGridContainer>
              </DataGrid>
            )}
          </div>
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
