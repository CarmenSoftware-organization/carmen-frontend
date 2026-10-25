import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  useFieldArray,
  useFormState,
  useWatch,
  type Control,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { BoxIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { GrnPoSelectDialog } from "./grn-po-select-dialog";
import type { GrnFormValues } from "./grn-form-schema";
import { EMPTY_DETAIL } from "./grn-form-schema";
import EmptyComponent from "@/components/empty-component";
import type { PoForGrn, PoGrnDetail } from "@/types/purchase-order";
import type { GrnStockLockReason } from "@/types/goods-receive-note";
import { useGrnItemTable } from "./use-grn-item-table";
import { GrnItemComputedSync } from "./grn-item-cells";

export const mapPoDetailToItems = (
  d: PoGrnDetail,
  poId: string,
  poNo: string,
): GrnFormValues["items"][number][] => {
  if (!d.locations?.length) {
    return [
      {
        ...EMPTY_DETAIL,
        purchase_order_id: poId,
        purchase_order_no: poNo,
        purchase_order_detail_id: d.id,
        product_id: d.product_id,
        product_name: d.product_name ?? "",
        // ชื่อท้องถิ่นมากับ PO อยู่แล้ว ไม่ลอกมาด้วย = แถวที่มาจาก PO ไม่มีบรรทัด
        // ภาษาไทยใต้ชื่อสินค้า ต่างจากแถวที่กรอกเอง ทั้งที่เป็นสินค้าตัวเดียวกัน
        product_local_name: d.product_local_name ?? "",
        received_qty: d.order_qty,
        received_unit_id: d.order_unit_id,
        received_base_qty: d.base_qty,
        received_base_unit_id: d.base_unit_id,
        approved_qty: d.order_qty,
        approved_unit_id: d.order_unit_id,
        // ยอดทั้งหมดของ GRN คิดจาก unit_price × received_qty (computeLineAmounts
        // แล้ว GrnItemComputedSync เขียน net/total กลับเข้าฟอร์ม) — ไม่หยิบราคา
        // จาก PO มาใส่ ทุกยอดในใบเลยเป็นศูนย์ทั้งที่ PO มีราคาอยู่
        //
        // net/total ปล่อยศูนย์ ให้ตัว sync เป็นคนคำนวณที่เดียว — seed ค่ามาจาก
        // PO ก็ถูกเขียนทับอยู่ดี มีแต่จะเห็นตัวเลขเก่าแวบหนึ่งตอนโหลด
        unit_price: d.price,
        net_amount: 0,
        total_price: 0,
      },
    ];
  }

  // PO หนึ่งบรรทัดที่กระจายหลายคลัง = GRN หลายบรรทัด บรรทัดละคลัง — ข้ามคลังที่
  // หลังบ้านบอกว่าใช้ไม่ได้ (`can_use: false`) ไม่ใช่ดึงมาทุกคลังแล้วให้ผู้ใช้ไป
  // เจอเอาตอนบันทึกว่ารับเข้าคลังนั้นไม่ได้
  return d.locations
    .filter((loc) => loc.can_use !== false)
    .map((loc) => ({
      ...EMPTY_DETAIL,
      purchase_order_id: poId,
      purchase_order_no: poNo,
      purchase_order_detail_id: d.id,
      product_id: d.product_id,
      product_name: d.product_name ?? "",
      product_local_name: d.product_local_name ?? "",
      location_id: loc.location_id,
      location_name: loc.location_name,
      location_code: loc.location_code ?? "",
      location_type: loc.location_type ?? "",
      received_qty: loc.remain_qty ?? loc.order_qty,
      received_unit_id: loc.request_unit_id || d.order_unit_id,
      received_base_qty: loc.request_base_qty ?? 0,
      received_base_unit_id: loc.request_base_unit_id || d.base_unit_id,
      approved_qty: loc.requested_qty ?? loc.order_qty,
      approved_unit_id: loc.request_unit_id || d.order_unit_id,
      foc_qty: loc.foc_qty ?? 0,
      // ราคาต่อหน่วยมาจาก PO ใบเดียวกัน ทุกบรรทัดที่แตกมาจากรายการเดียวจึงเริ่มที่
      // ราคาเดียวกัน — แก้รายบรรทัดทีหลังได้ (ของที่รับจริงอาจต่อรองราคาใหม่)
      unit_price: d.price,
      net_amount: 0,
      total_price: 0,
    }));
};

const PoAddButton = memo(function PoAddButton({
  control,
  onOpen,
  hasItems,
}: {
  control: Control<GrnFormValues>;
  onOpen: () => void;
  hasItems: boolean;
}) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const vendorId = useWatch({ control, name: "vendor_id" }) ?? "";
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={!vendorId}
      onClick={onOpen}
    >
      <Plus aria-hidden="true" /> {hasItems ? t("addMorePo") : t("addFromPo")}
    </Button>
  );
});

/**
 * error ระดับ array ของ items (เช่น "ต้องมีอย่างน้อย 1 รายการ") — subscribe errors
 * เองในคอมโพเนนต์ย่อยนี้ เพื่อ**ไม่ให้ GrnItemTable อ่าน form.formState.errors
 * โดยตรง** ซึ่งจะ subscribe แล้ว re-render ทั้งตารางทุกครั้งที่ validation รัน (เช่น
 * setValue discount/tax แบบ shouldValidate) → columns recompute → product
 * lookup remount แล้วเด้ง focus. แยกออกมาแล้ว GrnItemTable นิ่ง ไม่ churn ตอนพิมพ์
 */
const ItemsArrayError = memo(function ItemsArrayError({
  control,
}: {
  control: Control<GrnFormValues>;
}) {
  "use no memo";
  const { errors } = useFormState({ control, name: "items" });
  const message = errors.items?.message;
  if (!message) return null;
  return (
    <p className="text-destructive text-xs" role="alert">
      {message}
    </p>
  );
});

interface GrnItemTableProps {
  readonly form: UseFormReturn<GrnFormValues>;
  readonly disabled: boolean;
  /** บรรทัดที่เอกสารอื่นอ้างอิงแล้ว (key = id ของ detail) — ดู useGrnItemTable */
  readonly lockedLines?: ReadonlyMap<string, GrnStockLockReason[]>;
}

const NO_LOCKED_LINES: ReadonlyMap<string, GrnStockLockReason[]> = new Map();

/**
 * รายการสินค้าของ GRN — **1 แถว = 1 บรรทัดของเอกสาร (สินค้า + คลัง)** ตารางเดียว
 * ไม่มีกลุ่มสินค้าให้กาง (ทรงเดียวกับ PO หลังเลิก group location)
 *
 * ฟอร์มเก็บ `items` เป็น array แบนอยู่แล้ว การจับกลุ่มเมื่อก่อนเกิดตอน render
 * เท่านั้น — เอาออกแล้ว index ของแถวจึงตรงกับ index ในฟอร์มพอดี
 */
export function GrnItemTable({
  form,
  disabled,
  lockedLines = NO_LOCKED_LINES,
}: GrnItemTableProps) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const docType = useWatch({ control: form.control, name: "doc_type" });
  const isManual = docType === "manual";
  // สกุลเงินของใบ — ส่งให้ dialog กันหยิบ PO คนละสกุลเข้ามา (watch ไม่ใช่
  // getValues เพราะผู้ใช้เปลี่ยนสกุลเงินที่หัวใบได้ระหว่างกรอก)
  const currencyId = useWatch({ control: form.control, name: "currency_id" });
  const currencyName = useWatch({
    control: form.control,
    name: "currency_name",
  });
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  // แถว (row id) ที่ต้องเปิดตัวเลือกสินค้า/โฟกัสราคาอยู่ตอนนี้
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [autoFocusPriceId, setAutoFocusPriceId] = useState<string | null>(null);

  // สลับโหมดดู↔แก้ = เริ่มกรอกรอบใหม่ ล้างสถานะนำทางทั้งชุด — ตารางไม่ได้ unmount
  // ตอนสลับโหมด ของค้างจากรอบก่อน (เช่นเลือกสินค้าไว้แล้วกด Cancel) จะกลับมาเด้ง
  // lookup หรือดูดเคอร์เซอร์ทันทีที่กด Edit ทั้งที่ผู้ใช้ยังไม่ได้แตะอะไร
  useEffect(() => {
    setOpenProductId(null);
    setAutoFocusPriceId(null);
  }, [disabled]);

  const {
    fields: itemFields,
    prepend: prependItem,
    remove: removeItem,
  } = useFieldArray({ control: form.control, name: "items" });

  const excludePoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of itemFields) {
      if (item.purchase_order_id) ids.add(item.purchase_order_id);
    }
    return ids;
  }, [itemFields]);

  const handleSelectPoList = (poList: PoForGrn[]) => {
    const items = poList.flatMap(
      (po) =>
        po.po_detail?.flatMap((d) => mapPoDetailToItems(d, po.id, po.po_no)) ??
        [],
    );
    if (items.length > 0) prependItem(items);
  };

  /**
   * เลือกคลังเสร็จ → เปิดตัวเลือกสินค้าของแถวเดิมต่อ
   *
   * Radix คืน focus ให้ปุ่มที่เพิ่งกดเป็นค่า default ซึ่งกลายเป็นทางตัน: ผู้ใช้พิมพ์
   * ต่อทันทีแล้วตัวเลขหายไปเฉย ๆ เพราะ focus ยังค้างที่ปุ่มที่เพิ่งกด
   *
   * เส้นทางคือ **คลัง → สินค้า → ราคา → จำนวน** ครบทั้งแถวในบรรทัดเดียว
   * (คลังมาก่อนเพราะมันเป็นตัวกำหนดว่าเลือกสินค้าอะไรได้บ้าง)
   *
   * callback ทุกตัวที่ส่งเข้า useGrnItemTable ห่อ useCallback ไว้ เพราะมันเป็น dep
   * ของ columns useMemo — ปล่อยให้เป็นฟังก์ชันใหม่ทุก render เท่ากับ columns
   * recompute ทุก render แล้ว cell ที่มีช่องกรอกจะโดนสร้างใหม่จนโฟกัสหลุด
   */
  const handleLocationPicked = useCallback(
    (rowId: string) => setOpenProductId(rowId),
    [],
  );

  const handleProductPicked = useCallback((rowId: string) => {
    setOpenProductId(null);
    setAutoFocusPriceId(rowId);
  }, []);

  const handleProductOpenChange = useCallback(
    (rowId: string, open: boolean) => setOpenProductId(open ? rowId : null),
    [],
  );

  const handleDeleteItem = useCallback(
    (index: number) => setDeleteIndex(index),
    [],
  );

  const table = useGrnItemTable({
    form,
    itemFields,
    disabled,
    isPo: !isManual,
    openProductId,
    onProductOpenChange: handleProductOpenChange,
    autoFocusPriceId,
    onLocationPicked: handleLocationPicked,
    onProductPicked: handleProductPicked,
    onDeleteItem: handleDeleteItem,
    lockedLines,
  });

  const handleAddItem = () => {
    // แถวใหม่ขึ้นบนสุด "รายการก่อนหน้า" จึงคือแถวแรกปัจจุบัน — ของที่มาส่งพร้อมกัน
    // ใบเดียวมักเข้าคลังเดิมติดกันหลายรายการ เติมคลังให้ล่วงหน้าแล้วแก้เองได้
    // (ทรงเดียวกับ PR/PO) · อ่านผ่าน getValues ไม่ใช่ itemFields[0] เพราะ field
    // array เก็บค่าตอน mount ไม่ใช่ค่าล่าสุดที่ผู้ใช้เพิ่งเลือก
    const prev = form.getValues("items.0");
    const carriedLocation = prev?.location_id
      ? {
          location_id: prev.location_id,
          location_name: prev.location_name,
          location_code: prev.location_code,
          location_type: prev.location_type,
        }
      : {};

    prependItem({ ...EMPTY_DETAIL, ...carriedLocation });
    // ล้างสถานะนำทางของแถวก่อนหน้าทิ้ง — ไม่งั้น lookup ของแถวเดิมเด้งขึ้นมา
    // ทับตอนที่ผู้ใช้กำลังจะเริ่มกรอกแถวใหม่
    setOpenProductId(null);
    setAutoFocusPriceId(null);
  };

  // กด Save/Submit แล้วติดที่ "ต้องมีอย่างน้อย 1 รายการ" — เติมแถวเปล่าให้เลย
  // ผู้ใช้จะได้เห็นว่าต้องกรอกช่องไหน แทนที่จะได้แค่ toast แล้วหน้าว่าง (กติกา
  // เดียวกับ PR/PO) · เฉพาะ GRN แบบ manual — แบบอิง PO รายการมาจาก PO ไม่ใช่กรอกเอง
  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (!submitCount) return;
    if (itemFields.length === 0 && !disabled && isManual) handleAddItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ยิงครั้งเดียวต่อการกด submit
  }, [submitCount]);

  const addAction =
    !disabled &&
    (isManual ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleAddItem}
      >
        <Plus /> {t("addItem")}
      </Button>
    ) : (
      <PoAddButton
        control={form.control}
        onOpen={() => setPoDialogOpen(true)}
        hasItems={itemFields.length > 0}
      />
    ));

  /**
   * ข้อความยืนยันลบ — บอกให้ครบว่าแถวไหน
   *
   * ของเดิมโยนชื่อสินค้าดิบ ๆ เป็น description (ไม่มีประโยค) ใต้หัวข้อ "ลบสินค้า"
   * ซึ่งอ่านแล้วเหมือนกำลังลบสินค้าออกจากระบบ ไม่ใช่เอาแถวออกจากใบ · และแถวหนึ่ง
   * ของใบรับสินค้าคือ สินค้า + คลัง ชื่อสินค้าอย่างเดียวจึงไม่พอเมื่อสินค้าตัวเดียวกัน
   * รับเข้าหลายคลังในใบเดียว
   *
   * อ่านผ่าน getValues ไม่ใช่ itemFields — field array เก็บค่าตอน mount ไม่ใช่ค่า
   * ล่าสุดที่ผู้ใช้เพิ่งเลือก
   */
  const deleteDescription = (() => {
    if (deleteIndex == null) return undefined;
    const row = form.getValues(`items.${deleteIndex}`);
    const product =
      row?.product_name ||
      t("removeItemUntitled", { index: deleteIndex + 1 });
    return row?.location_name
      ? t("removeItemConfirm", { product, location: row.location_name })
      : t("removeItemConfirmNoLocation", { product });
  })();

  return (
    <div className="space-y-2 pt-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {addAction}
      </div>

      <ItemsArrayError control={form.control} />

      {/* compute sync — 1 ตัวต่อแถว เขียน derived discount/tax/net/total กลับ form */}
      {itemFields.map((item, i) => (
        <GrnItemComputedSync key={item.id} form={form} index={i} />
      ))}

      <DataGrid
        table={table}
        recordCount={itemFields.length}
        tableLayout={{
          // เซลล์มีช่องกรอก — clamp สองบรรทัดทำ layout ของ control เพี้ยน
          rowClamp: false,
          columnsResizable: true,
          // โหมดอ่านชิดบน — บางเซลล์มีบรรทัดรอง (รหัสคลัง · ชื่อท้องถิ่น ·
          // เปอร์เซ็นต์ใต้ยอดเงิน) บางเซลล์ไม่มี กึ่งกลางแล้วเซลล์บรรทัดเดียว
          // จะลอยอยู่ระหว่างสองบรรทัดของเพื่อนบ้าน (ทรงเดียวกับ PO)
          cellAlign: disabled ? "top" : "middle",
        }}
        emptyMessage={
          <EmptyComponent
            icon={BoxIcon}
            title={t("noItems")}
            description={t("noItemsDesc")}
          />
        }
      >
        <DataGridContainer scroll>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>

      <DeleteDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
        title={t("removeItem")}
        description={deleteDescription}
        onConfirm={() => {
          if (deleteIndex !== null) removeItem(deleteIndex);
          setDeleteIndex(null);
        }}
      />

      {poDialogOpen && (
        <GrnPoSelectDialog
          open={poDialogOpen}
          onOpenChange={setPoDialogOpen}
          vendorId={form.getValues("vendor_id") ?? ""}
          currencyId={currencyId ?? ""}
          currencyName={currencyName ?? ""}
          excludeIds={excludePoIds}
          onSelect={handleSelectPoList}
        />
      )}
    </div>
  );
}
