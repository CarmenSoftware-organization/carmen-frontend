import { useState } from "react";
import { useTranslations } from "use-intl";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { BoxIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { CompactSection } from "@/components/share/compact-section";
import type { BusinessUnit } from "@/types/profile";
import type { PrtFormValues } from "./prt-form-schema";
import { usePrtItemTable } from "./use-prt-item-table";
import { PRT_ITEM } from "./prt-form-schema";
import EmptyComponent from "@/components/empty-component";
import { getDeleteDescription } from "@/lib/form-utils";
import { useElementWidth } from "@/hooks/use-element-width";
import { ItemCards } from "../shared/item-cards";

/**
 * กล่องรายการแคบกว่านี้ (px) = การ์ดแถวละใบ (มือถือ / tablet) — เกณฑ์เดียวกับ PR
 * (iPad Pro 1024 แนวตั้งได้กล่อง ~920 จึงยังเป็นตาราง) แทนตารางที่เลื่อนแนวนอน ซึ่งซ่อน
 * จำนวน/สกุลเงิน/จุดส่งของไว้หลังขอบ
 */
const ITEM_CARDS_MAX_WIDTH = 900;

/** ป้ายของช่องในการ์ด (column id → คีย์ใต้ `field`) */
const PRT_ITEM_CARD_LABELS = {
  location_id: "location",
  requested_qty: "requested",
  currency_id: "currency",
  delivery_point_id: "deliveryPoint",
} as const;

interface PrtItemFieldsProps {
  readonly form: UseFormReturn<PrtFormValues>;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly defaultBu?: BusinessUnit;
}

export function PrtItemFields({
  form,
  disabled,
  readOnly = false,
  defaultBu,
}: PrtItemFieldsProps) {
  "use no memo";
  const t = useTranslations("procurement.purchaseRequestTemplate");
  const tfl = useTranslations("field");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const {
    fields: itemFields,
    prepend: prependItem,
    remove: removeItem,
  } = useFieldArray({ control: form.control, name: "items" });

  // คลังกับสินค้าของแต่ละรายการผูกกับเวิร์กโฟลว์ของแม่แบบ ยังไม่เลือกก็ยังไม่รู้ว่า
  // แม่แบบนี้เอาไว้ใช้กับขั้นตอนไหน — กันตั้งแต่ปุ่มเพิ่มรายการ ดีกว่าปล่อยให้กรอกไป
  // ครึ่งทางแล้วค่อยรู้ · ปุ่มยังกดได้ ไม่ปิดตาย ไม่งั้นคนกดไม่ติดแล้วไม่รู้ว่าทำไม
  const workflowId = useWatch({ control: form.control, name: "workflow_id" });

  const handleAddItem = () => {
    if (!workflowId) {
      toast.warning(t("selectWorkflowFirst"));
      return;
    }
    // แถวใหม่ขึ้นบนสุด "รายการก่อนหน้า" จึงคือแถวแรกปัจจุบัน — แม่แบบหนึ่งชุดมัก
    // เป็นของที่เข้าคลังเดียวกันทั้งชุด เติมคลัง + จุดส่งของให้ล่วงหน้าแล้วแก้เองได้
    // (ทรงเดียวกับ PR/PO/GRN) · อ่านผ่าน getValues ไม่ใช่ itemFields[0] เพราะ
    // field array เก็บค่าตอน mount ไม่ใช่ค่าล่าสุดที่ผู้ใช้เพิ่งเลือก
    const prev = form.getValues("items.0");
    const carriedLocation = prev?.location_id
      ? {
          location_id: prev.location_id,
          location_name: prev.location_name,
          location_code: prev.location_code,
          delivery_point_id: prev.delivery_point_id,
          delivery_point_name: prev.delivery_point_name,
        }
      : {};

    prependItem({
      ...PRT_ITEM,
      currency_id: defaultBu?.config?.default_currency_id ?? null,
      ...carriedLocation,
    });
  };

  // ตัดสินชุดความกว้างคอลัมน์จากกล่องตาราง ไม่ใช่จอ (หัก border 1px สองข้างของ DataGridContainer)
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const { table } = usePrtItemTable({
    containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2,
    form,
    itemFields,
    disabled,
    readOnly,
    onDelete: setDeleteIndex,
  });
  // ยังไม่ได้วัด (undefined) = ตาราง เหมือน PR
  const asCards =
    gridBoxWidth !== undefined && gridBoxWidth < ITEM_CARDS_MAX_WIDTH;
  const emptyMessage = (
    <EmptyComponent
      icon={BoxIcon}
      title={t("noItems")}
      description={t("noItemsDesc")}
    />
  );

  return (
    <CompactSection
      first
      frameless
      title={tfl("items")}
      description={t("itemsDesc")}
      count={itemFields.length}
      action={
        !readOnly ? (
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={handleAddItem}
            variant="secondary"
          >
            <Plus /> {t("addItem")}
          </Button>
        ) : undefined
      }
    >
      {/* กล่องที่ผูก ref ต้องอยู่ทั้งสองโหมด ไม่งั้นสลับแล้ววัดไม่ได้อีก */}
      <div ref={setGridBox}>
        {asCards ? (
          <ItemCards
            table={table}
            emptyMessage={emptyMessage}
            labelKeys={PRT_ITEM_CARD_LABELS}
            // 4 ช่อง: การ์ดกว้างตั้งแต่ ~576px (tablet) เรียงแถวเดียว · มือถือ 2 คอลัมน์
            columnsClassName="@xl:grid-cols-4"
          />
        ) : (
          <DataGrid
            table={table}
            // กล่อง 900–1140: เลื่อนแนวนอนแทนการบีบช่องกรอก/lookup (ตารางแก้ไขห้ามใช้ grow
            // ตอนกล่องแคบ) · 760 ≈ ผลรวม size ชุดแบ่งสัดส่วน 740 + เผื่อ
            tableClassNames={{ base: "min-w-[760px]" }}
            recordCount={itemFields.length}
            // โหมดอ่านชิดบน — คลังมีรหัสเป็นบรรทัดรอง เซลล์อื่นไม่มี
            tableLayout={{ cellAlign: readOnly ? "top" : "middle" }}
            emptyMessage={emptyMessage}
          >
            <DataGridContainer>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        )}
      </div>

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
    </CompactSection>
  );
}
