import { memo, useMemo } from "react";
import { useTranslations } from "use-intl";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { selectColumn } from "@/components/ui/data-grid/columns";
import {
  CommentFooterRow,
  FocQtyCell,
  ItemDiscountCell,
  ItemTaxCell,
  LocationCell,
  QtyUnitCell,
  ComputedPricingCell,
  type PrSource,
} from "./po-item-cells";
import { PriceCell, ProductHeaderCell, StatusCell } from "./po-item-cells";
import { ItemHistorySheet } from "@/components/share/item-history-sheet";
import { ITEM_HISTORY_STATUS_CONFIG } from "@/constant/item-history";
import type { PoFormValues } from "./po-form-schema";
import { isPriceHidden, type HiddenPriceField } from "@/types/workflows";
import type { FieldArrayWithId } from "react-hook-form";

export type PoItemField = FieldArrayWithId<PoFormValues, "items", "id">;

const ProductCol = memo(function ProductCol({
  form,
  index,
  disabled,
  readOnly,
}: {
  form: UseFormReturn<PoFormValues>;
  index: number;
  disabled: boolean;
  readOnly: boolean;
}) {
  "use no memo";
  const isFoc = useWatch({
    control: form.control,
    name: `items.${index}.is_foc`,
  });
  return (
    <ProductHeaderCell
      form={form}
      index={index}
      disabled={disabled}
      readOnly={readOnly}
      isFoc={!!isFoc}
    />
  );
});

const PoItemHistoryButton = memo(function PoItemHistoryButton({
  item,
}: {
  item?: PoItemField;
}) {
  "use no memo";
  const t = useTranslations("procurement.purchaseOrder");
  if ((item?.history?.length ?? 0) === 0) return null;
  return (
    <ItemHistorySheet
      history={item?.history ?? []}
      productName={item?.product_name}
      statusConfig={ITEM_HISTORY_STATUS_CONFIG}
      label={t("tabWorkflowHistory")}
    />
  );
});

/** ปุ่มลบแถว — ย้ายมาอยู่แนวคอลัมน์ # ของแถวหมายเหตุ ไม่ใช่คอลัมน์ action ท้ายตาราง */
const PoItemDeleteButton = memo(function PoItemDeleteButton({
  index,
  onDelete,
}: {
  index: number;
  onDelete: (index: number) => void;
}) {
  const t = useTranslations("procurement.purchaseOrder");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("deleteProductLine")}
          onClick={() => onDelete(index)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("deleteProductLine")}</TooltipContent>
    </Tooltip>
  );
});

interface UsePoItemTableOptions {
  form: UseFormReturn<PoFormValues>;
  itemFields: PoItemField[];
  disabled: boolean;
  locationsDisabled: boolean;
  readOnly: boolean;
  showApproveCheckbox: boolean;
  showStatusBadge: boolean;
  canResetStatus: boolean;
  isViewMode: boolean;
  /** id ของแถว PO → ใบขอซื้อต้นทาง (อ่านจาก response ของ GET ไม่ใช่จากฟอร์ม) */
  prSourcesByDetailId: Map<string, PrSource[]>;
  /** id ของแถว PO → ใบรับสินค้าที่รับของแถวนี้เข้ามา (ที่มาเดียวกัน) */
  grnSourcesByDetailId: Map<string, PrSource[]>;
  onDelete: (index: number) => void;
  /** `hidden_fields` ของใบ — ราคาที่ stage ปัจจุบันซ่อนจากผู้ใช้ */
  hiddenFields?: readonly HiddenPriceField[];
}

const PO_LEADING_COL = 33;

export function usePoItemTable({
  form,
  itemFields,
  disabled,
  locationsDisabled,
  readOnly,
  showApproveCheckbox,
  showStatusBadge,
  canResetStatus,
  isViewMode,
  prSourcesByDetailId,
  grnSourcesByDetailId,
  onDelete,
  hiddenFields,
}: UsePoItemTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  // boolean ไม่ใช่ตัว array — ใช้เป็น dep ของ useMemo คอลัมน์ได้นิ่ง ๆ
  const hidePrice = isPriceHidden(hiddenFields, "price_per_unit");
  const hideTotal = isPriceHidden(hiddenFields, "total_price");
  const showAction = !disabled && !readOnly;

  // แถวแก้ไม่ได้ = ทุกเซลล์เป็นตัวหนังสือ ไม่มี control ให้เผื่อที่
  const viewMode = !showAction;

  const columns = useMemo<ColumnDef<PoItemField>[]>(() => {
    const indexColumn: ColumnDef<PoItemField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      enableResizing: false,
      size: PO_LEADING_COL,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
        // แถวหมายเหตุเริ่มที่คอลัมน์ # เพื่อให้ปุ่มของแถว (ลบ/ประวัติ) ยืนตรงแนว
        // เลขลำดับ แล้วกินความกว้างต่อไปอีก 3 คอลัมน์ให้ช่องหมายเหตุ
        footerContent: (item: PoItemField) => (
          <CommentFooterRow
            form={form}
            itemFields={itemFields}
            item={item}
            isDisabled={viewMode}
            placeholder={tfl("comment")}
            leadingWidth={PO_LEADING_COL}
            prSourcesByDetailId={prSourcesByDetailId}
            grnSourcesByDetailId={grnSourcesByDetailId}
            renderLeading={(index) =>
              // โหมดแก้ไข = ปุ่มลบ · โหมดอ่าน = ประวัติของแถว (ถ้ามี)
              // สองอย่างนี้ไม่มีวันต้องใช้พร้อมกัน จึงใช้ที่เดียวกันสลับกันไป
              showAction ? (
                <PoItemDeleteButton index={index} onDelete={onDelete} />
              ) : (
                <PoItemHistoryButton item={itemFields[index]} />
              )
            }
          />
        ),
        footerColSpan: 4,
      },
    };

    const rightMeta = {
      headerClassName: "text-right",
      cellClassName: "text-right",
    };

    const dataColumns: ColumnDef<PoItemField>[] = [
      {
        accessorKey: "location_id",
        header: tfl("location"),
        size: 200,
        cell: ({ row }) => (
          <LocationCell
            form={form}
            index={row.index}
            disabled={locationsDisabled}
            statusSlot={
              showStatusBadge ? (
                <StatusCell
                  control={form.control}
                  form={form}
                  index={row.index}
                  canReset={canResetStatus}
                />
              ) : undefined
            }
          />
        ),
      },
      {
        accessorKey: "product_id",
        header: tfl("product"),
        size: 200,
        cell: ({ row }) => (
          <ProductCol
            form={form}
            index={row.index}
            disabled={disabled}
            readOnly={readOnly}
          />
        ),
      },
      {
        id: "order",
        header: tfl("orderGrn"),
        size: viewMode ? 104 : 140,
        meta: rightMeta,
        cell: ({ row }) => (
          <QtyUnitCell
            control={form.control}
            form={form}
            index={row.index}
            disabled={disabled}
            readOnly={readOnly}
            // ยอดที่รับแล้วโชว์เฉพาะโหมดอ่าน — ตอนกรอก (add/edit) ตัวเลข GRN
            // ใต้ช่องอ่านปนกับสิ่งที่ตัวเองเพิ่งพิมพ์ และใบที่เพิ่งสร้างก็เป็น 0
            // ทุกแถวอยู่แล้ว
            showReceived={isViewMode}
          />
        ),
      },
      {
        id: "foc",
        header: tfl("focGrn"),
        size: viewMode ? 104 : 140,
        meta: rightMeta,
        cell: ({ row }) => (
          <FocQtyCell
            control={form.control}
            form={form}
            index={row.index}
            disabled={disabled}
            readOnly={readOnly}
            // ยอดที่รับแล้วโชว์เฉพาะโหมดอ่าน เกณฑ์เดียวกับคอลัมน์ Order / GRN
            showReceived={isViewMode}
          />
        ),
      },
      {
        accessorKey: "price",
        header: tfl("unitPrice"),
        size: viewMode ? 104 : 140,
        meta: rightMeta,
        cell: ({ row }) => (
          <PriceCell
            form={form}
            index={row.index}
            disabled={disabled}
            readOnly={readOnly}
            isHidden={hidePrice}
          />
        ),
      },
      {
        id: "subtotal",
        header: tfl("subtotal"),
        size: 100,
        meta: rightMeta,
        cell: ({ row }) => (
          <ComputedPricingCell
            control={form.control}
            index={row.index}
            field="sub_total_price"
            isHidden={hideTotal}
          />
        ),
      },
      {
        id: "discount",
        header: tfl("discount"),
        size: viewMode ? 80 : 200,
        meta: rightMeta,
        cell: ({ row }) => (
          <ItemDiscountCell
            form={form}
            itemIndex={row.index}
            editable={!disabled && !readOnly}
            isHidden={hideTotal}
          />
        ),
      },
      {
        id: "net",
        header: tfl("net"),
        size: 105,
        meta: rightMeta,
        cell: ({ row }) => (
          <ComputedPricingCell
            control={form.control}
            index={row.index}
            field="net_amount"
            isHidden={hideTotal}
          />
        ),
      },
      {
        id: "tax",
        header: tfl("tax"),
        size: viewMode ? 80 : 200,
        meta: rightMeta,
        cell: ({ row }) => (
          <ItemTaxCell
            form={form}
            itemIndex={row.index}
            editable={!disabled && !readOnly}
            isHidden={hideTotal}
          />
        ),
      },
      {
        id: "amount",
        header: tfl("total"),
        size: 105,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right font-semibold tabular-nums",
        },
        cell: ({ row }) => (
          <ComputedPricingCell
            control={form.control}
            index={row.index}
            field="total_price"
            isHidden={hideTotal}
          />
        ),
      },
    ];

    const baseCols = [
      ...(showApproveCheckbox
        ? [
            {
              ...selectColumn<PoItemField>(),
              size: PO_LEADING_COL,
            } as ColumnDef<PoItemField>,
          ]
        : []),
      indexColumn,
      ...dataColumns,
    ];

    return baseCols.map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        cellClassName: cn(
          "py-2.5",
          !viewMode && "min-h-11",
          col.meta?.cellClassName,
        ),
      },
    }));
  }, [
    form,
    itemFields,
    viewMode,
    disabled,
    locationsDisabled,
    readOnly,
    showApproveCheckbox,
    showStatusBadge,
    canResetStatus,
    isViewMode,
    onDelete,
    tfl,
    showAction,
    hidePrice,
    hideTotal,
  ]);

  return useReactTable({
    data: itemFields,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: showApproveCheckbox,
    // ไม่ให้ลากขอบหัวคอลัมน์ — ความกว้างที่ลากไม่ถูกจำ ออกจากหน้าแล้วกลับมาได้
    // ค่าเดิมทุกครั้ง · `columnsResizable` ของ DataGrid ยังต้องเปิดไว้เพราะมัน
    // คุมอีกเรื่องด้วย: table width = getTotalSize() (คอลัมน์กว้างตาม size px
    // แล้วเลื่อนแนวนอน) ปิดไปตารางจะกลับเป็น w-full บีบ 11 คอลัมน์ลงในจอ
    enableColumnResizing: false,
  });
}
