import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Controller,
  useWatch,
  type UseFormReturn,
  type Control,
  type FieldArrayWithId,
} from "react-hook-form";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { memo, useMemo } from "react";
import { useTranslations } from "use-intl";
import { Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldInput } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LookupProductInLocation } from "@/components/lookup/lookup-product-in-location";
import { InventoryDialog } from "@/components/share/inventory-dialog";
import { OnHandDialog } from "@/components/share/on-hand-dialog";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { useProfile } from "@/hooks/use-profile";
import {
  useProductCostByLocationQty,
  useStockInDefaultCost,
} from "@/hooks/use-product-cost";
import { useProductInventory } from "@/hooks/use-product-inventory";
import {
  IA_TYPE_ICON_COLOR,
  IA_TYPE_SIGN,
} from "@/constant/inventory-adjustment";
import { cn } from "@/lib/utils";
import type { InventoryAdjustmentType } from "@/types/inventory-adjustment";
import type { AdjFormValues } from "./ia-form-schema";

const ProductInventoryDialog = memo(function ProductInventoryDialog({
  control,
  index,
  isStockOut = false,
}: {
  control: Control<AdjFormValues>;
  index: number;
  /** ใบจ่ายออก — ดูยอด ณ วันที่ของใบ ไม่ใช่ยอดทั้งงวด */
  isStockOut?: boolean;
}) {
  "use no memo";
  const { buCode } = useProfile();
  const docDate = useWatch({ control, name: "date" }) ?? "";
  const locationId = useWatch({ control, name: "location_id" }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  const atDate = isStockOut ? docDate : undefined;
  // กด "On hand" ในกล่องแล้วเปิดยอดรายคลัง — ทรงเดียวกับ SR/PR/PO และใช้วันเดียวกับกล่อง
  const [onHandOpen, setOnHandOpen] = useState(false);
  return (
    <>
      <InventoryDialog
        buCode={buCode}
        locationId={locationId}
        productId={productId}
        productName={productName}
        productLocalName={productLocalName}
        atDate={atDate}
        onOnHandClick={productId ? () => setOnHandOpen(true) : undefined}
      />
      {productId && (
        <OnHandDialog
          open={onHandOpen}
          onOpenChange={setOnHandOpen}
          productId={productId}
          atDate={atDate}
        />
      )}
    </>
  );
});

/**
 * ใบจ่ายออก: เตือนทันทีที่กรอกจำนวนเกินยอดที่ตัดได้ ณ วันที่ของใบ
 *
 * ใช้ query เดียวกับหน้าต่างดูสต๊อกของแถวนั้น (inventory-info?at_date — key ตรงกัน) จึงไม่ยิงเพิ่ม
 * เทียบกับ available_qty ไม่ใช่ on_hand_qty: ของที่รับเข้าหลังวันที่ของใบไม่นับ และเอกสารที่ลงวันที่หลังกว่า
 * อาจนับของก้อนนี้ไว้แล้ว หลังบ้านปฏิเสธตอนบันทึกอยู่แล้ว ตรงนี้แค่บอกให้รู้ก่อนกด
 *
 * แสดงเป็นไอคอน (i) สีแดงในช่อง Qty ข้อความเต็มเปิดดูเมื่อ hover หรือคลิก/แตะ — เดิมเป็นบรรทัดใต้ช่อง
 * ซึ่งยาวเกินคอลัมน์จนทับช่องกรอก ไม่แสดงเมื่อช่องมี error ของฟอร์มอยู่แล้ว เพราะไอคอน error อยู่ที่เดียวกัน
 */
const QtyOnDateWarning = memo(function QtyOnDateWarning({
  control,
  index,
  hasError,
  children,
}: {
  control: Control<AdjFormValues>;
  index: number;
  /** ช่องมี error ของฟอร์มอยู่ — ไอคอน error ใช้ตำแหน่งเดียวกัน */
  hasError: boolean;
  /** ช่องกรอก Qty */
  children: ReactNode;
}) {
  "use no memo";
  const [open, setOpen] = useState(false);
  const t = useTranslations("inventoryManagement.inventoryAdjustment");
  const { buCode } = useProfile();
  const docDate = useWatch({ control, name: "date" }) ?? "";
  const locationId = useWatch({ control, name: "location_id" }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const qty = useWatch({ control, name: `items.${index}.qty` });
  const { data } = useProductInventory(
    buCode || undefined,
    locationId || undefined,
    productId || undefined,
    docDate || undefined,
  );
  const available = data?.available_qty;
  const isOver =
    !hasError &&
    available !== undefined &&
    typeof qty === "number" &&
    qty > available;
  const message = isOver
    ? t("exceedsAvailable", { date: data?.as_of_date ?? "", available })
    : "";
  return (
    <div className={cn("relative", isOver && "[&_input]:pl-7")}>
      {children}
      {isOver && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={message}
              className="text-destructive absolute top-1/2 left-2 -translate-y-1/2 cursor-help rounded-full"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              onClick={(e) => {
                // hover เปิดไว้แล้ว คลิกต้องไม่ toggle ปิด — ปิดด้วยการคลิกที่อื่น/Esc/เอาเมาส์ออก
                e.preventDefault();
                setOpen(true);
              }}
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="bg-background text-destructive w-max max-w-[min(24rem,calc(100vw-2rem))] px-3 py-2 text-xs font-semibold"
            // เปิดตอน hover ระหว่างพิมพ์ — อย่าดึง focus ออกจากช่องกรอก
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {message}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
});

const TotalCostCell = memo(function TotalCostCell({
  control,
  index,
  adjustmentType,
}: {
  control: Control<AdjFormValues>;
  index: number;
  adjustmentType: InventoryAdjustmentType;
}) {
  "use no memo";
  const total = Number(
    useWatch({ control, name: `items.${index}.total_cost` }) ?? 0,
  );
  // ทิศทางอยู่ที่ตัวเลขชุดเดียวกับ list และยอดรวมท้ายใบ · ยอด 0 ไม่ใส่เครื่องหมาย ไม่ลงสี
  return (
    <span
      className={cn(
        "block text-right text-xs tabular-nums",
        total !== 0 && IA_TYPE_ICON_COLOR[adjustmentType],
      )}
    >
      {`${total === 0 ? "" : IA_TYPE_SIGN[adjustmentType]}${total.toFixed(2)}`}
    </span>
  );
});

/** ชุดค่าที่ราคาจาก API ผูกอยู่ด้วย — ต่างจากเดิมเมื่อไหร่ถึงจะเขียนราคาทับ */
const costKey = (
  productId: string,
  locationId: string,
  qty: number,
  atDate = "",
) => `${productId}|${locationId}|${qty}|${atDate}`;

const CostProbe = memo(function CostProbe({
  form,
  index,
  isEstimate = false,
  readOnly = false,
}: {
  form: UseFormReturn<AdjFormValues>;
  index: number;
  /**
   * ต้นทุนบนฟอร์มนี้เป็นค่าประมาณเสมอ ไม่ใช่ค่าที่ผู้ใช้พิมพ์ (ใบจ่ายออก) — ประเมินตั้งแต่ mount
   * แม้แถวจะมีอยู่แล้ว และไม่ทำให้ฟอร์ม dirty เพราะหลังบ้านไม่รับต้นทุนจาก client อยู่แล้ว
   * (ต้นทุนจริงคือที่บัญชีตัดตอน commit)
   */
  isEstimate?: boolean;
  /** โหมดดู — เติมแค่ต้นทุนที่ประเมิน ไม่แตะจำนวนหรือหน่วย */
  readOnly?: boolean;
}) {
  "use no memo";
  const { buCode } = useProfile();
  const { control } = form;
  const locationId = useWatch({ control, name: "location_id" }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const qty = useWatch({ control, name: `items.${index}.qty` });
  const probeQty = typeof qty === "number" ? qty : 0;
  // ใบจ่ายออกตีราคาจากของที่มีอยู่ ณ วันที่ของใบ — ล็อตที่รับเข้าหลังวันนั้นต้องไม่ถูกเสนอ
  const docDate = useWatch({ control, name: "date" }) ?? "";
  const atDate = isEstimate && docDate ? docDate : undefined;
  const { data } = useProductCostByLocationQty(
    buCode,
    productId || undefined,
    locationId || undefined,
    probeQty,
    atDate,
  );
  // ชุดค่าที่ราคาผูกอยู่ด้วยของรอบที่เขียนไปล่าสุด — ref อยู่กับ component instance
  // ซึ่งติดไปกับแถวเดิมเพราะตาราง getRowId ด้วย id ของ field array (ไม่ใช่ index)
  //
  // แถวที่มีราคาอยู่แล้วตอน mount ถือว่า "เขียนแล้ว" ตั้งแต่ต้น ไม่งั้น probe จะทับ
  // ราคาที่เซฟไว้ทันทีที่ตัวเองเกิดใหม่ — ซึ่งเกิดทุกครั้งที่ฟอร์มปลดล็อก เพราะ
  // CostProbe ถูก render เฉพาะตอน `disabled` เป็น false: เปิดใบเก่าอยู่โหมด view
  // (ไม่มี probe) กด Edit ทีเดียว probe เกิดใหม่แล้วดูดราคาจาก cache มาทับ ราคาที่
  // ส่งตอนกด Commit จึงเป็นราคาที่ fetch มา ไม่ใช่ราคาที่พิมพ์ไว้
  //
  // ใบจ่ายออก (isEstimate) ไม่มีราคาที่พิมพ์ไว้ให้ต้องรักษา และค่าที่โหลดมาของใบร่างเป็น 0 เสมอ
  // จึงประเมินตั้งแต่ mount — ไม่งั้นเปิดใบร่างกลับมาต้นทุนเป็น 0.00 ทุกแถว (e2e SO.2)
  const mountedItem = form.getValues(`items.${index}`);
  const appliedKey = useRef<string | null>(
    !isEstimate && (mountedItem?.id || mountedItem?.cost_per_unit)
      ? costKey(productId, locationId, probeQty, atDate)
      : null,
  );
  useEffect(() => {
    if (!data) return;
    const key = costKey(productId, locationId, probeQty, atDate);
    // เขียนทับเฉพาะตอน สินค้า/คลัง/จำนวน เปลี่ยนจริง — effect ตัวนี้ยิงซ้ำได้จาก
    // หลายทางที่ไม่ใช่การแก้ข้อมูล (กดเพิ่มแถวซึ่ง prepend ดัน index ของทุกแถว +1,
    // ลบแถว, refetch ตาม staleTime: 0) ทุกครั้งมันเคยลบราคาที่ผู้ใช้พิมพ์เองทิ้ง
    if (appliedKey.current === key) return;
    appliedKey.current = key;
    form.setValue(`items.${index}.cost_per_unit`, data.average_cost_per_unit, {
      shouldDirty: !isEstimate,
    });
    form.setValue(`items.${index}.total_cost`, data.total_cost, {
      shouldDirty: !isEstimate,
    });
    if (readOnly) return;
    if (
      typeof data.requested_qty === "number" &&
      data.requested_qty !== form.getValues(`items.${index}.qty`)
    ) {
      form.setValue(`items.${index}.qty`, data.requested_qty, {
        shouldDirty: true,
      });
    }
    const unitName = data.inventory_unit_name ?? data.unit_name;
    if (unitName && !form.getValues(`items.${index}.unit_name`)) {
      form.setValue(`items.${index}.unit_name`, unitName);
    }
  }, [
    data,
    form,
    index,
    productId,
    locationId,
    probeQty,
    atDate,
    isEstimate,
    readOnly,
  ]);
  return null;
});

/**
 * ราคาตั้งต้นของบรรทัดใบรับเข้า (SI) ตามค่า si.cost-from ของ BU (หน้า Company Profile)
 *
 * เดิมใบรับเข้าใช้ CostProbe ตัวเดียวกับใบจ่าย ซึ่งดึง "ต้นทุนการจ่าย" — BU ถัวเฉลี่ยจึงได้ค่าเฉลี่ยเสมอ
 * BU FIFO ได้ล็อตเก่าสุด และไม่ได้ราคาเลยถ้าคลังยังไม่มีของ ค่าที่ตั้งไว้จึงไม่มีผล
 * ราคาไม่ขึ้นกับจำนวน: เขียนทับเฉพาะตอน สินค้า/คลัง/วันที่ของใบ เปลี่ยน แก้จำนวนแล้วราคาที่พิมพ์ไว้ไม่หาย
 * (ยอดรวมคำนวณใหม่จากช่องจำนวนเอง) · แถวที่มีราคาอยู่แล้วตอน mount ถือว่าเขียนแล้ว เหมือน CostProbe
 */
const StockInCostProbe = memo(function StockInCostProbe({
  form,
  index,
}: {
  form: UseFormReturn<AdjFormValues>;
  index: number;
}) {
  "use no memo";
  const { buCode } = useProfile();
  const { control } = form;
  const locationId = useWatch({ control, name: "location_id" }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const docDate = useWatch({ control, name: "date" }) ?? "";
  const atDate = docDate || undefined;
  const { data } = useStockInDefaultCost(
    buCode,
    productId || undefined,
    locationId || undefined,
    atDate,
  );
  const key = `${productId}|${locationId}|${atDate ?? ""}`;
  const mountedItem = form.getValues(`items.${index}`);
  const appliedKey = useRef<string | null>(
    mountedItem?.id || mountedItem?.cost_per_unit ? key : null,
  );
  useEffect(() => {
    if (!data) return;
    if (appliedKey.current === key) return;
    appliedKey.current = key;
    const cost = Number(data.cost_per_unit) || 0;
    const qty = Number(form.getValues(`items.${index}.qty`)) || 0;
    form.setValue(`items.${index}.cost_per_unit`, cost, { shouldDirty: true });
    form.setValue(`items.${index}.total_cost`, qty * cost, {
      shouldDirty: true,
    });
  }, [data, form, index, key]);
  return null;
});

const ProductCell = memo(function ProductCell({
  control,
  form,
  index,
  disabled,
  errorMessage,
  excludeIds,
  autoOpen,
  onPicked,
  isCostEstimate = false,
}: {
  control: Control<AdjFormValues>;
  form: UseFormReturn<AdjFormValues>;
  index: number;
  disabled: boolean;
  errorMessage?: string;
  excludeIds?: string[];
  autoOpen?: boolean;
  onPicked?: () => void;
  /** ต้นทุนเป็นค่าประมาณ (ใบจ่ายออก) — ดู CostProbe.isEstimate */
  isCostEstimate?: boolean;
}) {
  "use no memo";
  const locationId = useWatch({ control, name: "location_id" }) ?? "";
  const docStatus = useWatch({ control, name: "doc_status" });
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  if (disabled) {
    return (
      // ปุ่ม on-hand ชิดท้ายชื่อ ไม่ดันไปขอบคอลัมน์ — คอลัมน์ยืดตามจอ ไอคอนจึงเคยลอยกลางตาราง
      // จนดูเหมือนเป็นคอลัมน์ของตัวเอง
      <div className="flex items-center gap-1.5 text-xs">
        <div className="min-w-0">
          {/* ชื่อสินค้า + ชื่อท้องถิ่นบรรทัดล่าง ใช้ primitive ตัวเดียวกับ PO/SR */}
          <NameWithSubtext
            primary={productName || "—"}
            secondary={productLocalName}
          />
        </div>
        <ProductInventoryDialog
          control={control}
          index={index}
          isStockOut={isCostEstimate}
        />
        {/* ใบจ่ายออกที่ยังเป็นร่างยังไม่มีต้นทุนจริง โชว์ค่าประมาณแม้อยู่โหมดดู ส่วนใบที่ commit แล้ว
            ใช้ต้นทุนที่บัญชีโพสต์ซึ่งหลังบ้านส่งมา ห้ามเอาค่าประมาณไปทับ */}
        {isCostEstimate && docStatus === "draft" && (
          <CostProbe form={form} index={index} isEstimate readOnly />
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-1.5 pr-4">
      <div className="min-w-0 flex-1">
        <Controller
          control={control}
          name={`items.${index}.product_id`}
          render={({ field }) => (
            <LookupProductInLocation
              locationId={locationId}
              value={field.value ?? ""}
              defaultOpen={autoOpen}
              onValueChange={(value, product) => {
                field.onChange(value);
                onPicked?.();
                if (product) {
                  form.setValue(`items.${index}.product_name`, product.name);
                  form.setValue(
                    `items.${index}.product_local_name`,
                    product.local_name ?? "",
                  );
                  form.setValue(
                    `items.${index}.unit_name`,
                    product.inventory_unit?.name ??
                      product.inventory_unit_name ??
                      "",
                  );
                }
              }}
              disabled={!locationId}
              excludeIds={excludeIds}
              defaultLabel={productName}
              className="w-full text-xs"
              error={errorMessage}
            />
          )}
        />
      </div>
      <ProductInventoryDialog
        control={control}
        index={index}
        isStockOut={isCostEstimate}
      />
      {/* ใบจ่ายออกตีราคาด้วยต้นทุนการจ่าย ส่วนใบรับเข้าเริ่มจากราคาตาม si.cost-from */}
      {isCostEstimate ? (
        <CostProbe form={form} index={index} isEstimate />
      ) : (
        <StockInCostProbe form={form} index={index} />
      )}
    </div>
  );
});

const UnitCell = memo(function UnitCell({
  control,
  index,
}: {
  control: Control<AdjFormValues>;
  index: number;
}) {
  "use no memo";
  const unitName = useWatch({ control, name: `items.${index}.unit_name` });
  return (
    <span className="text-muted-foreground text-xs">{unitName || "—"}</span>
  );
});

export type AdjItemField = FieldArrayWithId<AdjFormValues, "items", "id">;

interface UseAdjItemTableOptions {
  form: UseFormReturn<AdjFormValues>;
  itemFields: AdjItemField[];
  disabled: boolean;
  onDelete: (index: number) => void;
  adjustmentType: InventoryAdjustmentType;
  autoOpenFirst?: boolean;
  onProductPicked?: () => void;
}

export function useAdjItemTable({
  form,
  itemFields,
  disabled,
  onDelete,
  adjustmentType,
  autoOpenFirst,
  onProductPicked,
}: UseAdjItemTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const allColumns = useMemo<ColumnDef<AdjItemField>[]>(() => {
    const recalcTotal = (
      index: number,
      field: "qty" | "cost_per_unit",
      newValue: number,
    ) => {
      const qty =
        field === "qty" ? newValue : form.getValues(`items.${index}.qty`);
      const cost =
        field === "cost_per_unit"
          ? newValue
          : form.getValues(`items.${index}.cost_per_unit`);
      // ค่าว่างต้องเป็น 0 ไม่ใช่ NaN — NaN ในช่องที่ซ่อนอยู่ (ใบจ่ายออกไม่มีคอลัมน์ราคา) ทำให้
      // schema ไม่ผ่านแล้วกด Save เงียบ ไม่มีทั้งคำขอและ toast (e2e SO.3)
      form.setValue(
        `items.${index}.total_cost`,
        (Number(qty) || 0) * (Number(cost) || 0),
      );
    };

    const indexColumn: ColumnDef<AdjItemField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      size: 32,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const dataColumns: ColumnDef<AdjItemField>[] = [
      {
        accessorKey: "product_id",
        header: tfl("product"),
        cell: ({ row }) => {
          const errorMessage =
            form.formState.errors.items?.[row.index]?.product_id?.message;
          const selectedIds = form
            .getValues("items")
            .map((item, i) => (i === row.index ? "" : item.product_id))
            .filter(Boolean);
          return (
            <ProductCell
              control={form.control}
              form={form}
              index={row.index}
              disabled={disabled}
              errorMessage={errorMessage}
              excludeIds={selectedIds}
              autoOpen={autoOpenFirst && row.index === 0}
              onPicked={onProductPicked}
              isCostEstimate={adjustmentType === "stock-out"}
            />
          );
        },
        size: 240,
      },
      {
        accessorKey: "unit_name",
        header: tfl("unit"),
        cell: ({ row }) => (
          <UnitCell control={form.control} index={row.index} />
        ),
        size: 40,
        meta: {
          cellClassName: "text-center",
          headerClassName: "text-center",
        },
      },
      {
        accessorKey: "qty",
        header: tfl("qty"),
        cell: ({ row }) => {
          if (disabled) {
            const qty = form.getValues(`items.${row.index}.qty`);
            return <span className="block text-right text-xs">{qty}</span>;
          }
          const errorMessage =
            form.formState.errors.items?.[row.index]?.qty?.message;
          const input = (
            <FieldInput
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder={tfl("qty")}
              className={cn(
                "text-right text-xs md:text-xs",
                errorMessage && "pl-7",
              )}
              error={errorMessage}
              errorIconAlign="left"
              {...form.register(`items.${row.index}.qty`, {
                valueAsNumber: true,
                onChange: (e) =>
                  recalcTotal(row.index, "qty", Number(e.target.value) || 0),
              })}
            />
          );
          if (adjustmentType !== "stock-out") return input;
          return (
            <QtyOnDateWarning
              control={form.control}
              index={row.index}
              hasError={!!errorMessage}
            >
              {input}
            </QtyOnDateWarning>
          );
        },
        size: 80,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        id: "cost_per_unit",
        accessorKey: "cost_per_unit",
        header: tfl("costPerUnit"),
        cell: ({ row }) => {
          if (disabled) {
            const cost = form.getValues(`items.${row.index}.cost_per_unit`);
            return (
              <span className="block text-right text-xs tabular-nums">
                {(cost ?? 0).toFixed(2)}
              </span>
            );
          }
          const errorMessage =
            form.formState.errors.items?.[row.index]?.cost_per_unit?.message;
          return (
            <FieldInput
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder={tfl("costPerUnit")}
              className={cn(
                "text-right text-xs md:text-xs",
                errorMessage && "pl-7",
              )}
              error={errorMessage}
              errorIconAlign="left"
              {...form.register(`items.${row.index}.cost_per_unit`, {
                valueAsNumber: true,
                onChange: (e) =>
                  recalcTotal(
                    row.index,
                    "cost_per_unit",
                    Number(e.target.value) || 0,
                  ),
              })}
            />
          );
        },
        size: 100,
        meta: { headerClassName: "text-right" },
      },
      {
        accessorKey: "total_cost",
        header: tfl("totalCost"),
        cell: ({ row }) => (
          <TotalCostCell
            control={form.control}
            index={row.index}
            adjustmentType={adjustmentType}
          />
        ),
        size: 100,
        meta: { headerClassName: "text-right" },
      },
    ];

    const actionColumn: ColumnDef<AdjItemField> = {
      id: "action",
      header: () => "",
      cell: ({ row }: { row: { index: number } }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Remove"
          onClick={() => onDelete(row.index)}
        >
          <Trash2 />
        </Button>
      ),
      enableSorting: false,
      size: 40,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    };

    // ใบจ่ายออกกรอกต้นทุนเองไม่ได้ (มาจากต้นทุนเฉลี่ย) จึงซ่อนช่องตอนแก้ไข
    // แต่ตอนดูต้องเห็นว่ายอดรวมคิดจากต้นทุนต่อหน่วยเท่าไร
    const visibleDataColumns =
      adjustmentType === "stock-out" && !disabled
        ? dataColumns.filter((c) => c.id !== "cost_per_unit")
        : dataColumns;

    return [
      indexColumn,
      ...visibleDataColumns,
      ...(disabled ? [] : [actionColumn]),
    ];
  }, [
    form,
    disabled,
    onDelete,
    tfl,
    adjustmentType,
    autoOpenFirst,
    onProductPicked,
  ]);

  const table = useReactTable({
    data: itemFields,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return { table };
}
