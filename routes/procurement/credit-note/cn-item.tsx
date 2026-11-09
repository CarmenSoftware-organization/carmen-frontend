import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { BoxIcon, ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import EmptyComponent from "@/components/empty-component";
import { cnUnitPriceFromGrnLine } from "./cn-grn-unit-price";
import { useGoodsReceiveNoteById } from "@/hooks/use-goods-receive-note";
import { getDeleteDescription } from "@/lib/form-utils";
import type { CnFormValues } from "./cn-form-schema";
import { fieldFocusRef } from "@/lib/field-focus";
import { CN_ITEM } from "./cn-form-schema";
import { CnItemComputedSync } from "./cn-item-cells";
import { useCnItemTable } from "./use-cn-item-table";
import { CnAddItemDialog, type CnGrnLine } from "./cn-add-item-dialog";

interface Props {
  readonly form: UseFormReturn<CnFormValues>;
  readonly disabled: boolean;
}

export function CnItem({ form, disabled }: Props) {
  "use no memo";
  const t = useTranslations("procurement.creditNote");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const grnId =
    useWatch({ control: form.control, name: "grn_id" }) || undefined;
  const vendorId = useWatch({ control: form.control, name: "vendor_id" });
  const cnNo = useWatch({ control: form.control, name: "cn_no" });
  const canAddItem = !disabled && !!grnId;
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const {
    fields: itemFields,
    prepend: prependItem,
    remove: removeItem,
  } = useFieldArray({ control: form.control, name: "items" });

  // product:location ที่มีอยู่แล้ว → ส่งให้ dialog disable กันเพิ่มซ้ำ
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const existingKeys = useMemo(
    () =>
      new Set(
        (watchedItems ?? []).map(
          (i) => `${i.item_id ?? ""}:${i.location_id ?? ""}`,
        ),
      ),
    [watchedItems],
  );

  // กด Save แล้วติดที่ "ต้องมีอย่างน้อย 1 รายการ" — CN ต่างจาก PR/PO/GRN ตรงที่
  // รายการต้องเลือกมาจาก GRN เพิ่มแถวเปล่าไม่ได้ จึงเปิด dialog เลือกรายการให้แทน
  // (ผลลัพธ์เดียวกันคือพาไปยังสิ่งที่ต้องทำต่อ ไม่ปล่อยให้เดาเอง)
  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (!submitCount) return;
    if (itemFields.length === 0 && canAddItem) setAddOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ยิงครั้งเดียวต่อการกด submit
  }, [submitCount]);

  const handleAddLines = (lines: CnGrnLine[]) => {
    if (lines.length === 0) return;
    const currencyCode = form.getValues("currency_code") ?? "";
    // prepend เรียงตามที่เลือก — reverse เพื่อให้ตัวแรกที่เลือกอยู่บนสุด
    prependItem(
      lines.map((line) => ({
        ...CN_ITEM,
        _group_key: crypto.randomUUID(),
        _grn_received_qty: line.quantity,
        currency_code: currencyCode,
        item_id: line.product_id,
        item_name: line.product_name,
        item_local_name: line.product_local_name,
        location_id: line.location_id,
        location_name: line.location_name,
        location_code: line.location_code,
        unit_id: line.unit_id,
        unit_name: line.unit_name,
        // ไม่ pre-fill จำนวนคืน (CN_ITEM = 0) — line.quantity คือจำนวนที่รับ
        // ซึ่งไปอยู่แถวหลัก (ยอดตาม GRN) ให้เทียบแทน
        unit_price: line.unit_price,
        discount_rate: line.discount_rate,
        tax_profile_id: line.tax_profile_id,
        tax_profile_name: line.tax_profile_name,
        tax_rate: line.tax_rate,
        _grn_price: line.unit_price,
        _grn_sub_total: line.grn_sub_total,
        _grn_discount_amount: line.grn_discount_amount,
        _grn_net_amount: line.grn_net_amount,
        _grn_tax_amount: line.grn_tax_amount,
        _grn_total_amount: line.grn_total_amount,
      })),
    );
    // prepend → รายการแรกที่เลือกอยู่บนสุด · เด้งไปช่องจำนวนของแถวนั้นเลย เพราะ
    // จำนวนคือสิ่งเดียวที่ต้องกรอกเองหลังเลือกรายการมาจาก GRN (สินค้า/สถานที่/
    // ราคามาครบแล้ว) · รอเฟรมถัดไปให้แถวใหม่ mount ก่อน
    requestAnimationFrame(() => {
      fieldFocusRef<HTMLInputElement>("items.0.quantity").current?.focus();
    });
  };

  // ยอดฝั่ง GRN ของแต่ละบรรทัดไม่ได้อยู่ใน API ของ CN — ใบที่โหลดกลับมาจึงได้ null
  // มาทั้งกระดาน ต้องไปเทียบกับ GRN ต้นทางเอง (query เดียวกับ dialog เลือกรายการ
  // → React Query ใช้ cache ร่วม ไม่ได้ยิงเพิ่มจริง) · setValue ไม่ mark dirty
  // เพราะเป็นค่าอ้างอิงที่เติมให้ ไม่ใช่การแก้ของผู้ใช้ และไม่เข้า payload อยู่แล้ว
  const { data: grn } = useGoodsReceiveNoteById(grnId);
  useEffect(() => {
    if (!grn) return;
    const grnByLine = new Map<
      string,
      {
        received: number;
        price: number;
        subTotal: number;
        discount: number;
        net: number;
        tax: number;
        total: number;
      }
    >();
    for (const detail of grn.good_received_note_detail ?? []) {
      const key = `${detail.product?.id ?? ""}:${detail.location?.id ?? ""}`;
      // บรรทัดแรกที่ match ชนะ — ตรงกับที่ dialog หยิบไปตอนเพิ่มรายการ
      if (grnByLine.has(key)) continue;
      const line = detail.items?.[0];
      if (!line) continue;
      const received = Number(line.received_qty) || 0;
      const subTotal = Number(line.sub_total_price) || 0;
      grnByLine.set(key, {
        received,
        // ถอดราคาด้วยสูตรเดียวกับ dialog เลือกรายการ (ถอด VAT ถ้าติ๊ก Inc VAT)
        price: cnUnitPriceFromGrnLine(line),
        subTotal,
        discount: Number(line.discount_amount) || 0,
        net: Number(line.net_amount) || 0,
        tax: Number(line.tax_amount) || 0,
        total: Number(line.total_price) || 0,
      });
    }
    form.getValues("items").forEach((item, index) => {
      if (item._grn_received_qty != null) return;
      const grnLine = grnByLine.get(
        `${item.item_id ?? ""}:${item.location_id ?? ""}`,
      );
      if (!grnLine) return;
      const base = `items.${index}` as const;
      form.setValue(`${base}._grn_received_qty`, grnLine.received);
      form.setValue(`${base}._grn_price`, grnLine.price);
      form.setValue(`${base}._grn_sub_total`, grnLine.subTotal);
      form.setValue(`${base}._grn_discount_amount`, grnLine.discount);
      form.setValue(`${base}._grn_net_amount`, grnLine.net);
      form.setValue(`${base}._grn_tax_amount`, grnLine.tax);
      form.setValue(`${base}._grn_total_amount`, grnLine.total);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form stable; เติมเมื่อ GRN มาถึง
  }, [grn, itemFields.length]);

  const table = useCnItemTable({
    form,
    itemFields,
    disabled,
    onDelete: setDeleteIndex,
  });

  // ปุ่มยังกดได้ตลอดแล้วค่อยบอกว่าขาดอะไร — ปุ่มที่จางแล้วกดไม่ติดไม่ได้บอก
  // ว่าต้องทำอะไรก่อน · เตือนตามลำดับที่ต้องกรอกจริง (ผู้ขาย → ใบรับของ)
  const handleAddClick = () => {
    if (!vendorId) {
      toast.warning(t("selectVendorFirst"));
      return;
    }
    if (!grnId) {
      toast.warning(t("selectGrnFirst"));
      return;
    }
    setAddOpen(true);
  };

  const expandAction = itemFields.length > 0 && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => table.toggleAllRowsExpanded(!table.getIsAllRowsExpanded())}
    >
      {table.getIsAllRowsExpanded() ? (
        <>
          <ChevronsDownUp /> {tc("collapseAll")}
        </>
      ) : (
        <>
          <ChevronsUpDown /> {tc("expandAll")}
        </>
      )}
    </Button>
  );

  const addAction = !disabled && (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={handleAddClick}
    >
      <Plus aria-hidden="true" /> {t("addItem")}
    </Button>
  );

  const itemsError = form.formState.errors.items?.message;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-end gap-2">
        {expandAction}
        {addAction}
      </div>
      {itemsError && (
        <p className="text-destructive text-xs" role="alert">
          {itemsError}
        </p>
      )}

      {/* compute sync — 1 ต่อ item, รัน setValue net/tax/total แม้ตอน collapsed */}
      {itemFields.map((item, i) => (
        <CnItemComputedSync
          key={item.id}
          control={form.control}
          form={form}
          index={i}
        />
      ))}

      <DataGrid
        table={table}
        recordCount={itemFields.length}
        // โหมดแก้ไข: คอลัมน์กว้างตาม size (px) จริง เกินจอก็เลื่อนแนวนอน (เหมือน
        // PO/GRN) เคยลองบีบให้พอดีจอด้วย table-fixed w-full แล้ว combo
        // discount/tax หดจนกรอก rate กับยอดไม่ได้
        //
        // โหมดดู: ปิด resizable → กลับไปใช้ width "fixed" ซึ่งแปลง size เป็น % ของ
        // ความกว้างจริง ตารางเลยพอดีจอไม่ต้องเลื่อน และสัดส่วนคอลัมน์ยังเท่าเดิม
        // ซึ่งจำเป็น เพราะแถว "คืน" เป็นตารางซ้อนที่คิด % จาก CN_COL ชุดเดียวกัน
        // (table-auto ทำให้คอลัมน์จัดตามเนื้อหา สัดส่วนไม่ตรง แถวคืนเลยเหลื่อม)
        tableLayout={
          // โหมดอ่านชิดบน — เซลล์ที่มีบรรทัดรอง (รหัสคลัง · ชื่อท้องถิ่น ·
          // เปอร์เซ็นต์ใต้ยอดเงิน) กับเซลล์บรรทัดเดียวจะได้เริ่มที่เส้นเดียวกัน
          disabled
            ? { cellAlign: "top" }
            : { columnsResizable: true, cellAlign: "middle" }
        }
        emptyMessage={
          <EmptyComponent
            icon={BoxIcon}
            title={t("noItems")}
            description={t("noItemsDesc")}
          />
        }
      >
        {/* native scroll (overflow-auto) ไม่ห่อ Radix ScrollArea — เลี่ยง nested
            scroll ที่สะดุด · scroll (pb-3) เฉพาะโหมดแก้ไขที่ตารางกว้างเกินจอจริง
            ไม่งั้นแถบเลื่อนลอย (macOS) ไปบังตัวเลขแถวสุดท้าย เพราะ CN เป็นตาราง
            แบน ไม่มีแถวกาง · โหมดดูไม่มีแถบเลื่อน จะเว้นที่ไว้ก็เป็นช่องว่างเปล่า */}
        <DataGridContainer scroll={!disabled}>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>

      <CnAddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        grnId={grnId}
        existingKeys={existingKeys}
        onAdd={handleAddLines}
        currentCnNo={cnNo}
      />

      <DeleteDialog
        open={deleteIndex !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIndex(null);
        }}
        title={tfl("deleteLocation")}
        description={getDeleteDescription(deleteIndex, form, "item_name")}
        onConfirm={() => {
          if (deleteIndex === null) return;
          removeItem(deleteIndex);
          setDeleteIndex(null);
        }}
      />
    </div>
  );
}
