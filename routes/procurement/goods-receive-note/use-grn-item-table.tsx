import { useCallback, useMemo, useRef, useState } from "react";
import { type FieldArrayWithId, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { GitBranch, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import type { GrnStockLockReason } from "@/types/goods-receive-note";
import type { GrnFormValues } from "./grn-form-schema";
import {
  GrnAmountCell,
  GrnItemDiscountCell,
  GrnItemTaxCell,
  LocationCell,
  ProductCell,
  QtyUnitCell,
  ReceivedQtyCell,
  UnitPriceCell,
} from "./grn-item-cells";

export type GrnItemField = FieldArrayWithId<GrnFormValues, "items", "id">;

function liveItem(form: UseFormReturn<GrnFormValues>, index: number) {
  return form.getValues(`items.${index}`);
}

interface UseGrnItemTableOptions {
  form: UseFormReturn<GrnFormValues>;
  itemFields: GrnItemField[];
  disabled: boolean;
  isPo: boolean;
  openProductId: string | null;
  onProductOpenChange: (rowId: string, open: boolean) => void;
  autoFocusPriceId: string | null;
  onLocationPicked: (rowId: string) => void;
  onProductPicked: (rowId: string) => void;
  onDeleteItem: (index: number) => void;
  /**
   * บรรทัดที่เอกสารอื่นอ้างอิงแล้ว (key = id ของ detail) — แก้ได้แค่หมายเหตุ ส่วนคลัง สินค้า
   * จำนวน ของแถม ราคา ส่วนลด ภาษี และปุ่มลบถูกปิด เพราะหลังบ้านจะปฏิเสธด้วย GRN_LINE_STOCK_LOCKED
   */
  lockedLines: ReadonlyMap<string, GrnStockLockReason[]>;
}

export function useGrnItemTable({
  form,
  itemFields,
  disabled,
  isPo,
  openProductId,
  onProductOpenChange,
  autoFocusPriceId,
  onLocationPicked,
  onProductPicked,
  onDeleteItem,
  lockedLines,
}: UseGrnItemTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const t = useTranslations("procurement.goodsReceiveNote");
  const [sorting, setSorting] = useState<SortingState>([]);
  // `disabled` = ใบนี้แก้ไม่ได้ (โหมดอ่าน หรือกำลังบันทึก) — isView คือตัวเดียวกัน
  // ไม่ใช่ตรงข้าม ใส่ `!` เมื่อไรคอลัมน์จะใช้ความกว้างโหมดอ่านตอนกด Edit และ
  // discount/tax จะกลายเป็นช่องกรอกตอนเปิดอ่าน
  const isView = disabled;

  const qtyRefs = useRef(
    new Map<string, React.RefObject<HTMLInputElement | null>>(),
  );

  const qtyRefFor = useCallback((rowId: string) => {
    const map = qtyRefs.current;
    if (!map.has(rowId)) map.set(rowId, { current: null });
    return map.get(rowId)!;
  }, []);

  const columns = useMemo<ColumnDef<GrnItemField>[]>(() => {
    // อ่าน id ของ detail จากค่าในฟอร์ม ไม่ใช่ row.original.id — useFieldArray เขียนทับ
    // `id` ของแถวด้วย key ที่มันสร้างเอง (keyName ค่าเริ่มต้นคือ "id")
    const lockReasonsOf = (index: number) =>
      lockedLines.get(liveItem(form, index)?.id ?? "");
    const isLocked = (index: number) => !!lockReasonsOf(index)?.length;

    const indexColumn: ColumnDef<GrnItemField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      enableResizing: false,
      size: 40,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const rightMeta = {
      headerClassName: "text-right",
      cellClassName: "text-right",
    };

    const dataColumns: ColumnDef<GrnItemField>[] = [
      {
        id: "location",
        accessorFn: (item) => item.location_name,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("location")} />
        ),
        sortingFn: (a, b) =>
          (liveItem(form, a.index)?.location_name ?? "").localeCompare(
            liveItem(form, b.index)?.location_name ?? "",
          ),
        size: isView ? 140 : 190,
        cell: ({ row }) => (
          <LocationCell
            form={form}
            index={row.index}
            disabled={
              disabled ||
              isLocked(row.index) ||
              (!!row.original.purchase_order_detail_id &&
                !!row.original.location_id)
            }
            isManual={!row.original.purchase_order_detail_id}
            onPicked={() => onLocationPicked(row.id)}
          />
        ),
      },
      {
        id: "product",
        accessorFn: (item) => item.product_name,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("product")} />
        ),
        sortingFn: (a, b) =>
          (liveItem(form, a.index)?.product_name ?? "").localeCompare(
            liveItem(form, b.index)?.product_name ?? "",
          ),
        size: 120,
        cell: ({ row }) => (
          <ProductCell
            form={form}
            index={row.index}
            isManual={!row.original.purchase_order_detail_id}
            disabled={disabled || isLocked(row.index)}
            open={row.id === openProductId ? true : undefined}
            onOpenChange={(open) => onProductOpenChange(row.id, open)}
            onPicked={() => onProductPicked(row.id)}
          />
        ),
      },
      ...(isPo
        ? [
            {
              id: "order",
              header: tfl("order"),
              size: 140,
              meta: rightMeta,
              cell: ({ row }) => (
                <QtyUnitCell
                  form={form}
                  index={row.index}
                  qtyField="approved_qty"
                  unitField="approved_unit_id"
                  disabled
                />
              ),
            } as ColumnDef<GrnItemField>,
          ]
        : []),
      {
        id: "received",
        header: tfl("received"),
        size: 140,
        meta: rightMeta,
        cell: ({ row }) => (
          <ReceivedQtyCell
            form={form}
            index={row.index}
            disabled={disabled || isLocked(row.index)}
            inputRef={qtyRefFor(row.id)}
          />
        ),
      },
      {
        id: "foc",
        header: tfl("foc"),
        size: 140,
        meta: rightMeta,
        cell: ({ row }) => (
          <QtyUnitCell
            form={form}
            index={row.index}
            qtyField="foc_qty"
            unitField="foc_unit_id"
            disabled={disabled || isLocked(row.index)}
          />
        ),
      },
      {
        id: "price",
        header: tfl("unitPrice"),
        size: 120,
        meta: rightMeta,
        cell: ({ row }) => (
          <UnitPriceCell
            form={form}
            index={row.index}
            disabled={disabled || isLocked(row.index)}
            autoFocus={row.id === autoFocusPriceId}
            onCommit={() => qtyRefFor(row.id).current?.focus()}
          />
        ),
      },
      {
        id: "subtotal",
        header: tfl("subtotal"),
        size: 100,
        meta: rightMeta,
        cell: ({ row }) => (
          <GrnAmountCell form={form} index={row.index} field="subtotal" />
        ),
      },
      {
        id: "discount",
        header: tfl("discount"),
        size: isView ? 96 : 190,
        meta: rightMeta,
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <GrnItemDiscountCell
              form={form}
              index={row.index}
              editable={!isView && !isLocked(row.index)}
            />
          </div>
        ),
      },
      {
        id: "net",
        header: tfl("net"),
        size: 92,
        meta: rightMeta,
        cell: ({ row }) => (
          <GrnAmountCell form={form} index={row.index} field="netAmount" />
        ),
      },
      {
        id: "tax",
        header: tfl("tax"),
        size: isView ? 96 : 190,
        meta: rightMeta,
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <GrnItemTaxCell
              form={form}
              index={row.index}
              editable={!isView && !isLocked(row.index)}
            />
          </div>
        ),
      },
      {
        id: "amount",
        header: tfl("total"),
        size: 104,
        meta: rightMeta,
        cell: ({ row }) => (
          <GrnAmountCell
            form={form}
            index={row.index}
            field="totalPrice"
            bold
          />
        ),
      },
    ];

    // โหมดอ่าน = ปุ่มดูเอกสารต้นทาง (PO/CN ที่บรรทัดนี้อ้างถึง) · โหมดแก้ = ปุ่มลบ
    // สองอย่างนี้ไม่มีวันอยู่ด้วยกัน จึงใช้คอลัมน์เดียวกันสลับกันไป
    const actionColumn: ColumnDef<GrnItemField> = {
      id: "action",
      header: () => "",
      cell: ({ row }) => {
        const lockReasons = lockReasonsOf(row.index);
        // บรรทัดที่ถูกอ้างอิงลบไม่ได้ — แสดงกุญแจพร้อมเหตุแทนปุ่มลบ ผู้ใช้จะได้รู้ก่อนกรอก
        // ว่าทำไมช่องปิดอยู่ ไม่ใช่ไปเจอ error ตอนบันทึก
        if (!isView && lockReasons?.length) {
          return (
            <div className="flex items-center justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex size-6 items-center justify-center text-muted-foreground"
                    aria-label={t("stockLocked")}
                    tabIndex={0}
                  >
                    <Lock className="size-3.5" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  <p className="font-medium">{t("stockLocked")}</p>
                  {lockReasons.map((reason) => (
                    <p key={reason}>{t(`stockLockReason.${reason}`)}</p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        }
        return (
        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              {isView ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("refDocs")}
                >
                  <GitBranch className="size-3.5" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("deleteProductLine")}
                  onClick={() => onDeleteItem(row.index)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {isView ? t("refDocsComingSoon") : t("deleteProductLine")}
            </TooltipContent>
          </Tooltip>
        </div>
        );
      },
      enableSorting: false,
      enableResizing: false,
      size: isView ? 48 : 64,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center",
      },
    };

    const baseCols = [indexColumn, ...dataColumns, actionColumn];

    return baseCols.map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        cellClassName: cn(
          "py-2.5",
          !isView && "min-h-11",
          col.meta?.cellClassName,
        ),
      },
    }));
  }, [
    form,
    disabled,
    isView,
    isPo,
    openProductId,
    autoFocusPriceId,
    onProductOpenChange,
    onLocationPicked,
    onProductPicked,
    onDeleteItem,
    qtyRefFor,
    lockedLines,
    tfl,
    t,
  ]);

  return useReactTable({
    data: itemFields,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });
}
