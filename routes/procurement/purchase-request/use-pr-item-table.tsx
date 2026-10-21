import { type UseFormReturn, type FieldArrayWithId } from "react-hook-form";
import { STAGE_ROLE } from "@/types/stage-role";
import { isPriceHidden, type HiddenPriceField } from "@/types/workflows";
import { PR_STATUS, PR_ITEM_STAGE_STATUS } from "@/types/purchase-request";
import type { PrItemFilter } from "./use-pr-item-filter";
import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { cn } from "@/lib/utils";
import type { PrFormValues } from "./pr-form-schema";
import { PrItemExpand } from "./pr-item-expand";
import { PrPricelistCompare } from "./pr-pricelist-compare";
import { ItemHistorySheet } from "@/components/share/item-history-sheet";
import {} from "@/constant/purchase-request";
import { ITEM_HISTORY_STATUS_CONFIG } from "@/constant/item-history";
import { isRowLocked } from "./pr-item-cells/helpers";
import {
  SelectCell,
  StatusCell,
  AmountCell,
  LocationCell,
  ProductCell,
  CurrencyCell,
  DeliveryPointCell,
  RequestedCell,
  ApprovedCell,
  FocCell,
  DeliveryDateCell,
  CommentFooterRow,
  DeleteCell,
} from "./pr-item-cells";

export type ItemField = FieldArrayWithId<PrFormValues, "items", "id">;

/**
 * ความกว้างเท่ากันของคอลัมน์แคบ 3 ตัว (select / expand / index)
 *
 * ต้องใช้ค่าเดียวกันทั้งสาม + `enableResizing: false` เพราะ table นี้เปิด
 * `columnsResizable` → th ได้ `width: getSize()` ตรงตาม `size` (px). ถ้าใส่ค่า
 * ต่างกัน (เดิม 80/60/40) UI จึงกว้างไม่เท่ากัน
 */
const NARROW_COL_SIZE = 35;

/**
 * ความกว้างคอลัมน์ที่มีช่องกรอก (Requested / Approved / FOC / Delivery Point)
 *
 * view mode เหลือแค่ข้อความ ไม่มี input กับ dropdown จึงไม่ต้องกว้างเท่าโหมด
 * แก้ไข — คืนที่ให้คอลัมน์อื่นไป
 */
const INPUT_COL_SIZE = 150;
const INPUT_COL_SIZE_VIEW = 120;

const ACTION_COL_SIZE = 60;
const ACTION_COL_SIZE_VIEW = 40;

type PrItem = PrFormValues["items"][number];

/**
 * ค่าปัจจุบันของแถว — อ่านจากฟอร์มตรง ๆ ไม่ใช่จาก `row.original`
 *
 * `fields` ของ useFieldArray เป็น snapshot ตอน mount/reset ไม่ขยับตาม `setValue`
 * ที่ cell เขียนลงไป · เปลี่ยนสินค้าในแถวแล้วค้น/เรียงด้วย `row.original`
 * จะได้ชื่อเก่า
 */
function liveItem(
  form: UseFormReturn<PrFormValues>,
  index: number,
): PrItem | undefined {
  return form.getValues(`items.${index}`);
}

function baseAmountOf(item: PrItem | undefined): number {
  return Number(item?.total_price ?? 0) * Number(item?.exchange_rate ?? 1);
}

interface UsePrItemTableOptions {
  form: UseFormReturn<PrFormValues>;
  itemFields: ItemField[];
  isDisabled: boolean;
  prStatus?: string;
  role?: string;
  dateFormat: string;
  buCode?: string;
  baseCurrencyCode?: string;
  onDelete: (index: number) => void;
  filter: PrItemFilter;
  /** `hidden_fields` ของใบ — ราคาที่ stage ปัจจุบันซ่อนจากผู้ใช้ */
  hiddenFields?: readonly HiddenPriceField[];
}

export function usePrItemTable({
  form,
  itemFields,
  isDisabled,
  prStatus,
  role,
  buCode,
  baseCurrencyCode,
  dateFormat,
  onDelete,
  filter,
  hiddenFields,
}: UsePrItemTableOptions) {
  "use no memo";
  const t = useTranslations("procurement.purchaseRequest");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  // นับเฉพาะแถวที่ติ๊กได้จริง — แถวที่ถูกตัดสินมาแล้วไม่มี checkbox ให้กด
  // นับรวมไปก็หลอกตาว่าจะเลือกได้มากกว่าที่เลือกได้จริง
  const selectableItems = itemFields.filter((item) => !isRowLocked(item, role));
  const allCount = selectableItems.length;
  const pendingCount = selectableItems.filter((item) => {
    const status = item.current_stage_status ?? "";
    return !status || status === PR_ITEM_STAGE_STATUS.PENDING;
  }).length;

  const today = useMemo(() => new Date(), []);

  const isLockedAfterCreate =
    isDisabled || (!!role && role !== STAGE_ROLE.CREATE);

  // boolean ไม่ใช่ตัว array — ใช้เป็น dep ของ useMemo คอลัมน์ได้นิ่ง ๆ
  const hidePrice = isPriceHidden(hiddenFields, "price_per_unit");
  const hideTotal = isPriceHidden(hiddenFields, "total_price");
  const anyPriceHidden = hidePrice || hideTotal;

  const allColumns = useMemo<ColumnDef<ItemField>[]>(() => {
    const inputColSize = isDisabled ? INPUT_COL_SIZE_VIEW : INPUT_COL_SIZE;
    const prSelectColumn: ColumnDef<ItemField> = {
      id: "select",
      header: ({ table: t }) => {
        if (isDisabled) return null;
        const isAllSelected = t.getIsAllPageRowsSelected();
        const isSomeSelected = t.getIsSomePageRowsSelected();
        return (
          <Checkbox
            checked={
              isSomeSelected && !isAllSelected ? "indeterminate" : isAllSelected
            }
            onCheckedChange={(checked) => {
              if (!checked) {
                t.toggleAllPageRowsSelected(false);
                return;
              }
              // ถามว่า "ทั้งหมด หรือเฉพาะที่ยังรอ" ก็ต่อเมื่อสองอย่างนี้ไม่เท่ากัน
              // ที่ stage purchase ทุกใบผ่าน approve มาแล้ว ที่ยังรอจึงเป็นศูนย์
              // ถามไปก็มีคำตอบเดียว เลือกให้เลยดีกว่า
              if (pendingCount === 0 || pendingCount === allCount) {
                t.toggleAllPageRowsSelected(true);
                return;
              }
              setSelectDialogOpen(true);
            }}
            aria-label={tc("aria.selectAll")}
            className="align-[inherit]"
          />
        );
      },
      // checkbox ด้านบน + expand chevron ด้านล่าง ในคอลัมน์เดียว
      // (view mode: SelectCell ซ่อนตัวเอง เหลือแค่ chevron)
      cell: ({ row }) => (
        // 1 element (view: chevron เดียว) → center · 2 elements (edit:
        // checkbox+chevron) → ดันลงล่าง (justify-end + chevron only:my-auto)
        <div className="inset-0 flex flex-col items-center justify-end gap-0.5 px-2 py-1">
          <SelectCell
            control={form.control}
            index={row.index}
            row={row}
            isHidden={isDisabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="only:my-auto"
            aria-label={
              row.getIsExpanded()
                ? tc("aria.collapseRow")
                : tc("aria.expandRow")
            }
            onClick={() => row.toggleExpanded()}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      size: NARROW_COL_SIZE,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center",
        // คอลัมน์ select ถือ chevron ด้วย — expand content เริ่มที่ Location
        // (เว้น select + index) ไม่มีคอลัมน์ expand แยกแล้ว
        expandedColStart: 2,
        // ปุ่ม compare pricelist วางใน gutter ซ้าย ตรงแถว Pricelist (แถวแรก)
        // stage ซ่อนราคา = ไม่มีปุ่มเทียบราคา (ในกล่องเทียบมีราคาทุกเจ้า)
        expandedLeading: (row) =>
          anyPriceHidden ? null : (
            <PrPricelistCompare
              control={form.control}
              form={form}
              index={row.index}
              role={role}
              isDisabled={isDisabled}
            />
          ),
        expandedContent: (item: ItemField) => (
          <PrItemExpand
            item={item}
            form={form}
            isDisabled={isDisabled || role !== STAGE_ROLE.PURCHASE}
            itemFields={itemFields}
            buCode={buCode}
            baseCurrencyCode={baseCurrencyCode}
            hidePrice={hidePrice}
            hideTotal={hideTotal}
          />
        ),
      },
    };

    const indexColumn: ColumnDef<ItemField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      enableResizing: false,
      size: NARROW_COL_SIZE,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const dataColumns: ColumnDef<ItemField>[] = [
      {
        accessorKey: "location_id",
        // เรียงตามชื่อคลัง ไม่ใช่ค่าใน accessor (location_id เป็น uuid เรียงแล้วมั่ว)
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("location")} />
        ),
        sortingFn: (a, b) =>
          (liveItem(form, a.index)?.location_name ?? "").localeCompare(
            liveItem(form, b.index)?.location_name ?? "",
          ),
        cell: ({ row }) => (
          <LocationCell
            control={form.control}
            form={form}
            index={row.index}
            isDisabled={isLockedAfterCreate}
            statusSlot={
              <StatusCell
                control={form.control}
                form={form}
                index={row.index}
                role={role}
                isDisabled={isDisabled}
              />
            }
          />
        ),
        size: 200,
        meta: {
          footerContent: (item: ItemField) => (
            <CommentFooterRow
              form={form}
              itemFields={itemFields}
              item={item}
              isDisabled={isDisabled}
              placeholder={tfl("comment")}
            />
          ),
          footerColSpan: 1,
        },
      },
      {
        accessorKey: "product_id",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("product")} />
        ),
        sortingFn: (a, b) =>
          (liveItem(form, a.index)?.product_name ?? "").localeCompare(
            liveItem(form, b.index)?.product_name ?? "",
          ),
        cell: ({ row }) => (
          <ProductCell
            control={form.control}
            form={form}
            index={row.index}
            isDisabled={isLockedAfterCreate}
            buCode={buCode}
          />
        ),
        size: 220,
      },
      {
        id: "requested",
        header: tfl("requested"),
        cell: ({ row }) => (
          <RequestedCell
            control={form.control}
            form={form}
            index={row.index}
            isDisabled={isLockedAfterCreate}
          />
        ),
        size: inputColSize,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        id: "approved",
        header: tfl("approved"),
        cell: ({ row }) => (
          <ApprovedCell
            control={form.control}
            form={form}
            index={row.index}
            isQtyDisabled={isDisabled}
            isUnitDisabled={isLockedAfterCreate}
          />
        ),
        size: inputColSize,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        id: "foc",
        header: tfl("foc"),
        cell: ({ row }) => (
          <FocCell
            control={form.control}
            form={form}
            index={row.index}
            isQtyDisabled={isDisabled}
            isUnitDisabled={isLockedAfterCreate}
          />
        ),
        size: inputColSize,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        id: "amount",
        // TanStack ยอมให้ sort เฉพาะคอลัมน์ที่มี accessorFn — คอลัมน์นี้เดิมเป็น
        // display ล้วน ต้องมี accessor ถึงจะกดเรียงได้ (ค่าจริงใช้ sortingFn ข้างล่าง)
        accessorFn: (item) => item.total_price,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={tfl("amountCur")}
            className="justify-end"
          />
        ),
        // เทียบเป็นสกุลฐาน ไม่งั้นใบที่มีหลายสกุลจะเรียงเลขที่คนละหน่วยกัน
        sortingFn: (a, b) =>
          baseAmountOf(liveItem(form, a.index)) -
          baseAmountOf(liveItem(form, b.index)),
        cell: ({ row }) => (
          <AmountCell
            control={form.control}
            index={row.index}
            baseCurrencyCode={baseCurrencyCode}
            isDisabled={isDisabled}
            isHidden={hideTotal}
            currencySlot={
              <CurrencyCell
                control={form.control}
                form={form}
                index={row.index}
                // currency_id เป็น key แหล่งราคา — stage ซ่อนราคาไม่ส่งกลับ แก้ไปก็ไม่มีผล
                isDisabled={isDisabled || anyPriceHidden}
              />
            }
          />
        ),
        size: 160,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "delivery_point_id",
        header: tfl("deliveryPoint"),
        cell: ({ row }) => (
          <DeliveryPointCell
            control={form.control}
            form={form}
            index={row.index}
            isDisabled={isDisabled}
          />
        ),
        // 110 เดิมแคบสุดในตาราง ชื่อจุดส่งของยาวกว่านั้นเกือบทุกอัน
        size: inputColSize,
      },
      {
        accessorKey: "delivery_date",
        header: tfl("deliveryDate"),
        cell: ({ row }) => (
          <DeliveryDateCell
            control={form.control}
            index={row.index}
            isDisabled={isDisabled}
            today={today}
            dateFormat={dateFormat}
          />
        ),
        size: 150,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
    ];

    const actionColumn: ColumnDef<ItemField> = {
      id: "action",
      header: () => "",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          {(row.original.history?.length ?? 0) > 0 && (
            <ItemHistorySheet
              history={row.original.history ?? []}
              productName={row.original.product_name}
              statusConfig={ITEM_HISTORY_STATUS_CONFIG}
              label={t("tabWorkflowHistory")}
            />
          )}
          {!isDisabled && (
            <DeleteCell
              control={form.control}
              index={row.index}
              onDelete={onDelete}
            />
          )}
        </div>
      ),
      enableSorting: false,
      enableResizing: false,
      size: isDisabled ? ACTION_COL_SIZE_VIEW : ACTION_COL_SIZE,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    };

    const isDraft = !prStatus || prStatus === PR_STATUS.DRAFT;
    const isCreateRole = role === STAGE_ROLE.CREATE;
    // FOC ไม่อยู่ในนี้แล้ว — ของแถมเป็นสิ่งที่ "คนขอ" ขอมาตั้งแต่ต้น ไม่ใช่
    // ผลการตัดสินของผู้อนุมัติแบบ Approved จึงต้องเห็นและกรอกได้ตั้งแต่ draft
    // เหมือนคอลัมน์ Requested (FocCell ปิดตามโหมด view ของฟอร์ม ไม่ผูกกับ role
    // อยู่แล้ว โชว์ออกมาแล้วพิมพ์ได้จริง)
    const hiddenInDraft = new Set(["approved"]);
    // ในโหมด view (isDisabled) ยังต้องโชว์คอลัมน์ action ถ้ามีรายการที่มีประวัติ
    // เพื่อให้ปุ่ม history แสดงได้ (ปุ่ม delete จะถูกซ่อนเองภายใน cell)
    const hasAnyHistory = itemFields.some(
      (item) => (item.history?.length ?? 0) > 0,
    );

    const visibleDataColumns =
      isDraft || isCreateRole
        ? dataColumns.filter((col) => !hiddenInDraft.has(col.id ?? ""))
        : dataColumns;

    const baseCols = [
      // select column ถือทั้ง checkbox + expand chevron — แสดงเมื่อไม่ใช่
      // draft/create (view mode ก็แสดง แต่ SelectCell ซ่อน checkbox เหลือ chevron)
      ...(isDraft || isCreateRole ? [] : [prSelectColumn]),
      indexColumn,
      ...visibleDataColumns,
      ...(isDisabled && !hasAnyHistory ? [] : [actionColumn]),
    ];

    // Comment footer starts at location_id and spans through the delivery_point
    // column so the comment input matches the Delivery Point column's right edge
    // (delivery_date + action keep their own footer cells).
    const locationColIdx = baseCols.findIndex(
      (c) => "accessorKey" in c && c.accessorKey === "location_id",
    );
    const deliveryPointColIdx = baseCols.findIndex(
      (c) => "accessorKey" in c && c.accessorKey === "delivery_point_id",
    );
    const footerSpan =
      locationColIdx >= 0 && deliveryPointColIdx >= locationColIdx
        ? deliveryPointColIdx - locationColIdx + 1
        : 1;

    const locationCol = visibleDataColumns.find(
      (c) => "accessorKey" in c && c.accessorKey === "location_id",
    );
    if (locationCol?.meta) {
      locationCol.meta.footerColSpan = footerSpan;
    }

    const allCols = baseCols.map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        // การจัดแนวตั้งอยู่ที่ `cellAlign` ของ DataGrid แล้ว (ดู pr-item-fields)
        cellClassName: cn("py-2", col.meta?.cellClassName),
      },
    }));

    return allCols;
  }, [
    form,
    isDisabled,
    prStatus,
    role,
    buCode,
    baseCurrencyCode,
    dateFormat,
    itemFields,
    onDelete,
    setSelectDialogOpen,
    allCount,
    pendingCount,
    today,
    isLockedAfterCreate,
    hidePrice,
    hideTotal,
    anyPriceHidden,
    t,
    tfl,
    tc,
  ]);

  const table = useReactTable({
    data: itemFields,
    columns: allColumns,
    // กรองที่ table ด้วยเหตุผลเดียวกับ sorting — ตัดแถวออกจาก `data` แล้ว `row.index`
    // จะไม่ตรงกับ index ใน form array อีก · `globalFilter` เป็นแค่ลายเซ็นของค่าที่
    // เลือกไว้ (ว่าง = TanStack ข้าม filter model ทั้งก้อน) ตัวตัดสินจริงคือ
    // `filter.matches(row.index)` ซึ่งอ่านค่าสด ๆ จากฟอร์ม ไม่ใช่จาก accessor
    state: { sorting, globalFilter: filter.signature },
    globalFilterFn: (row) => filter.matches(row.index),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    // เรียงที่ table ไม่ใช่ที่ `data` เพราะ `row.index` ต้องคงเป็น index ใน form
    // array (ทุก cell ผูก `items.${index}` ไว้)
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    // แถวที่ถูกตัดสินมาแล้วไม่มี checkbox ให้กด แต่ toggleAllPageRowsSelected ไม่รู้
    // เรื่องนั้น — ถ้าไม่บอกไว้ "เลือกทั้งหมด" จะกวาดแถวที่ผู้ใช้มองไม่เห็นและ
    // เอาออกเองไม่ได้เข้าไปใน bulk action ด้วย
    enableRowSelection: (row) => !isRowLocked(row.original, role),
  });

  // Auto-expand แถวที่มี validation error เมื่อ submit fail
  // เพื่อให้ user มองเห็น field ที่ผิด (อยู่ในส่วน expand) + ทำงานคู่กับ scrollToFirstInvalidField
  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (!submitCount) return;
    const itemErrors = form.formState.errors.items;
    if (!itemErrors) return;
    const next: Record<string, boolean> = {};
    if (Array.isArray(itemErrors)) {
      itemErrors.forEach((err, i) => {
        if (err) next[String(i)] = true;
      });
    } else {
      for (const k of Object.keys(itemErrors)) {
        const i = Number(k);
        if (!Number.isNaN(i)) next[String(i)] = true;
      }
    }
    if (Object.keys(next).length === 0) return;
    table.setExpanded((prev) => ({
      ...(typeof prev === "object" ? prev : {}),
      ...next,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  const handleSelectAll = () => {
    table.toggleAllPageRowsSelected(true);
    setSelectDialogOpen(false);
  };

  const handleSelectPending = () => {
    const selection: Record<string, boolean> = {};
    for (let i = 0; i < itemFields.length; i++) {
      const status = itemFields[i].current_stage_status ?? "";
      if (!status || status === PR_ITEM_STAGE_STATUS.PENDING) {
        selection[i] = true;
      }
    }
    table.setRowSelection(selection);
    setSelectDialogOpen(false);
  };

  return {
    table,
    selectDialogOpen,
    setSelectDialogOpen,
    allCount,
    pendingCount,
    handleSelectAll,
    handleSelectPending,
  };
}
