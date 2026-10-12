import {
  Controller,
  useWatch,
  type UseFormReturn,
  type Control,
  type FieldArrayWithId,
} from "react-hook-form";
import {
  type ColumnDef,
  type Row,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuantityFormatter } from "@/hooks/use-number-formatter";
import { LookupLocationPairProduct } from "@/components/lookup/lookup-location-pair-product";
import { InventoryDialog } from "@/components/share/inventory-dialog";
import { OnHandDialog } from "@/components/share/on-hand-dialog";
import { OnOrderDialog } from "@/components/share/on-order-dialog";
import { useBuCode } from "@/hooks/use-bu-code";
import { fieldFocusRef } from "@/lib/field-focus";
import { formatCurrency } from "@/lib/currency-utils";
import { STAGE_ROLE } from "@/types/stage-role";
import type { StoreRequisitionStatus } from "@/types/store-requisition";
import { SR_ITEM_STAGE, type SrFormValues } from "./sr-form-schema";
import { SR_ITEM_STATUS_CONFIG } from "@/constant/store-requisition";
import { ItemHistorySheet } from "@/components/share/item-history-sheet";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { cn } from "@/lib/utils";
import { ItemStatusDot } from "@/components/share/item-status-dot";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixPlain,
  InputSuffixQty,
} from "@/components/ui/input/input-suffix";
import { coerceNumberInput } from "@/lib/form-helpers";

const ProductCell = memo(function ProductCell({
  control,
  form,
  index,
  disabled,
  fromLocationId,
  toLocationId,
  workflowId,
  statusSlot,
}: {
  control: Control<SrFormValues>;
  form: UseFormReturn<SrFormValues>;
  index: number;
  disabled: boolean;
  fromLocationId: string;
  toLocationId: string;
  workflowId: string;
  /** จุดสถานะของแถว — ท้ายช่องแรกของแถว ทรงเดียวกับช่องคลังของ PR/PO */
  statusSlot?: ReactNode;
}) {
  "use no memo";
  const buCode = useBuCode();
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  const unitName =
    useWatch({ control, name: `items.${index}.unit_name` }) ?? "";
  const [onHandOpen, setOnHandOpen] = useState(false);
  const [onOrderOpen, setOnOrderOpen] = useState(false);

  // ยอดคงเหลือ/กำลังสั่ง — hover แล้วยิง API เหมือนหน้า PR (กด label ใน tooltip
  // เปิด dialog รายละเอียดต่อได้) SR ไม่มีคลังรายแถว ยอดจึงอ้างคลังปลายทาง (to) ของใบ
  // ผู้ขอเบิกดูว่าคลังตัวเองเหลือเท่าไร
  const inventory = (
    <>
      <InventoryDialog
        buCode={buCode}
        locationId={toLocationId}
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

  if (disabled) {
    return (
      // ชิดบน ไม่ใช่กึ่งกลาง — ไอคอนสต็อกเป็นปุ่มสูง 24px ดันกล่อง flex ให้สูงกว่า
      // ตัวหนังสือ `items-center` เลยดันชื่อสินค้าลงมาต่ำกว่าคอลัมน์อื่นทั้งแถว
      // ซึ่งทำให้ `cellAlign: "top"` ของตารางไม่มีผลที่เห็นได้เลย
      <div className="flex items-start gap-0.5">
        <div className="min-w-0 flex-1">
          <NameWithSubtext primary={productName} secondary={productLocalName} />
        </div>
        {inventory}
        {/* สูงเท่าปุ่มสต็อก (24px) จุดจะได้อยู่แนวเดียวกับไอคอนข้าง ๆ แม้กล่องชิดบน */}
        {statusSlot && <span className="flex h-6 items-center">{statusSlot}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <div className="min-w-0 flex-1">
        <Controller
          control={control}
          name={`items.${index}.product_id`}
          render={({ field, fieldState }) => (
            <LookupLocationPairProduct
              value={field.value ?? ""}
              onValueChange={(value, product) => {
                field.onChange(value);
                if (product) {
                  form.setValue(
                    `items.${index}.product_name`,
                    product.product_name,
                  );
                  form.setValue(
                    `items.${index}.unit_name`,
                    product.inventory_unit_name,
                  );
                }
              }}
              fromLocationId={fromLocationId}
              toLocationId={toLocationId}
              workflowId={workflowId}
              defaultLabel={productName || undefined}
              disabled={disabled}
              // ใช้ error ของ RHF ตรง ๆ (กรอบแดง + ไอคอน + tooltip เหมือนทุก lookup
              // ในแอป) — ของเดิมต่อ string เองแล้วลืมเว้นวรรค ได้ class
              // "text-xsring-destructive" ซึ่งไม่มีอยู่จริง กรอบแดงเลยไม่เคยขึ้น
              error={fieldState.error?.message}
              // เลือกสินค้าเสร็จ → เด้งไปช่องจำนวนที่ขอของแถวเดียวกันต่อเลย
              // (SR ไม่มีสถานที่รายแถว มาจากหัวเอกสาร จำนวนจึงเป็นช่องถัดไปจริง ๆ)
              nextFocusRef={fieldFocusRef(`items.${index}.requested_qty`)}
            />
          )}
        />
      </div>
      {inventory}
      {statusSlot}
    </div>
  );
});

function SrSelectCell({
  control,
  index,
  row,
}: Readonly<{
  control: Control<SrFormValues>;
  index: number;
  row: Row<SrItemField>;
}>) {
  "use no memo";
  const stageStatus =
    useWatch({ control, name: `items.${index}.stage_status` }) ?? "";
  const currentStatus =
    useWatch({ control, name: `items.${index}.current_stage_status` }) ?? "";
  const isLocked = isItemLocked(stageStatus, currentStatus);
  if (isLocked) return null;
  const isSelected = row.getIsSelected();
  const canSelect = row.getCanSelect();
  return (
    <>
      {isSelected && (
        <div className="bg-primary absolute inset-s-0 top-0 bottom-0 w-0.5 rounded-full" />
      )}
      <Checkbox
        checked={isSelected}
        disabled={!canSelect}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="align-[inherit]"
      />
    </>
  );
}

const FINAL_STATUSES = new Set<StoreRequisitionStatus>([
  "completed",
  "cancelled",
  "voided",
]);

const isFinalStatus = (status: string) => {
  return FINAL_STATUSES.has(status as StoreRequisitionStatus);
};

const isItemLocked = (stageStatus: string, currentStatus: string) => {
  return isFinalStatus(stageStatus) || isFinalStatus(currentStatus);
};

/**
 * ค่าสถานะแถวของ SR → ชุดสถานะของ `ItemStatusDot` (pending/approved/rejected/review)
 * SR เก็บเป็นคำกริยา (approve/reject) และ "submit" คือส่งแล้วรอคนอนุมัติ = รอ
 */
const SR_ITEM_DOT_STATUS: Record<string, string> = {
  [SR_ITEM_STAGE.PENDING]: "pending",
  submit: "pending",
  [SR_ITEM_STAGE.APPROVE]: "approved",
  [SR_ITEM_STAGE.REJECT]: "rejected",
  [SR_ITEM_STAGE.REVIEW]: "review",
};

const StatusCell = memo(function StatusCell({
  control,
  form,
  index,
  translate,
  role,
  disabled,
}: {
  control: Control<SrFormValues>;
  form?: UseFormReturn<SrFormValues>;
  index: number;
  translate: (value?: string) => string | undefined;
  role?: string;
  disabled?: boolean;
}) {
  "use no memo";
  const stageStatus =
    useWatch({ control, name: `items.${index}.stage_status` }) ?? "";
  const currentStatus =
    useWatch({ control, name: `items.${index}.current_stage_status` }) ?? "";
  const initialStatus =
    useWatch({ control, name: `items.${index}._initial_stage_status` }) ?? "";
  const effective = stageStatus || currentStatus;
  // approver/issuer แก้สถานะได้ เฉพาะตอนอยู่โหมดแก้ไข; และล็อกถ้า server ส่งมา
  // แล้วเป็น approve/reject — เกณฑ์เดียวกับ PR/PO
  const canEdit =
    !!form &&
    !disabled &&
    (role === STAGE_ROLE.APPROVE || role === STAGE_ROLE.ISSUE);
  const isLockedFromServer =
    initialStatus === SR_ITEM_STAGE.APPROVE ||
    initialStatus === SR_ITEM_STAGE.REJECT;
  const showReset =
    canEdit &&
    !isLockedFromServer &&
    (effective === SR_ITEM_STAGE.APPROVE ||
      effective === SR_ITEM_STAGE.REJECT ||
      effective === SR_ITEM_STAGE.REVIEW);

  const handleReset = () => {
    form?.setValue(`items.${index}.stage_status`, SR_ITEM_STAGE.PENDING);
    form?.setValue(
      `items.${index}.current_stage_status`,
      SR_ITEM_STAGE.PENDING,
    );
  };

  // จุดสถานะตัวเดียวกับ PR/PO — ชื่อสถานะกับปุ่มล้างอยู่ใน tooltip
  return (
    <ItemStatusDot
      status={SR_ITEM_DOT_STATUS[effective] ?? "pending"}
      label={translate(effective) ?? ""}
      tooltipExtra={
        showReset && (
          <button
            type="button"
            aria-label="Reset status"
            title="Clear"
            className="text-muted-foreground hover:text-foreground inline-flex items-center rounded focus-visible:outline-none"
            onClick={handleReset}
          >
            <X className="size-3.5" />
          </button>
        )
      }
    />
  );
});

type SrQtyField = "requested_qty" | "approved_qty" | "issued_qty";

/**
 * จำนวน + หน่วย ในกล่องเดียว (ทรงเดียวกับ PO/GRN)
 *
 * เดิมหน่วยเป็นคอลัมน์ของตัวเองคั่นอยู่ระหว่างสินค้ากับจำนวน — อ่านแล้วต้องกวาดตา
 * กลับไปดูว่าเลขในแต่ละคอลัมน์นับเป็นหน่วยอะไร ทั้งที่ทั้งสามคอลัมน์ใช้หน่วยเดียวกัน
 * เอามาต่อท้ายเลขแทน คอลัมน์เลยหายไปหนึ่งช่องและอ่านจบในตัว
 */
const QtyUnitCell = memo(function QtyUnitCell({
  control,
  form,
  index,
  field,
  readOnly,
}: {
  control: Control<SrFormValues>;
  form: UseFormReturn<SrFormValues>;
  index: number;
  field: SrQtyField;
  readOnly: boolean;
}) {
  "use no memo";
  const qty = useWatch({ control, name: `items.${index}.${field}` });
  const unitName =
    useWatch({ control, name: `items.${index}.unit_name` }) ?? "";
  // ไม่ส่ง decimals — SR ไม่มี unit_id ราย item (มีแต่ unit_name) จึงหา decimal_place
  // ของหน่วยไม่ได้ ทั้งฝั่งอ่านและฝั่งกรอกจึงตกที่ DEFAULT_QTY_DECIMALS ตัวเดียวกัน
  const formatQty = useQuantityFormatter();
  const tfl = useTranslations("field");
  const name = `items.${index}.${field}` as const;

  if (readOnly) {
    return (
      <InputSuffixPlain
        className="block w-full text-right"
        value={qty == null ? "" : formatQty(Number(qty))}
        suffix={unitName}
        suffixClassName="text-right"
      />
    );
  }

  const error = form.formState.errors.items?.[index]?.[field]?.message;
  return (
    <InputSuffixField className="w-full" error={!!error}>
      <InputSuffixQty
        placeholder={tfl("qty")}
        defaultValue={qty == null ? undefined : Number(qty)}
        // setValueAs ต้องมี — onBlur ของ register เขียนค่าดิบ (string) ทับ number
        // ที่ onChange set ไว้ แล้ว Save ร่างส่งไป 400 (ดู coerceNumberInput)
        {...form.register(name, { setValueAs: coerceNumberInput })}
        onChange={(e) => {
          // ลบเลขจนช่องว่าง = NaN ซึ่ง zod ตีเป็น "ไม่ใช่ตัวเลข" แล้วขอบแดงค้าง
          // แม้พิมพ์ 0 กลับเข้าไป (ท่าเดียวกับ PO/PRT)
          const n = e.target.valueAsNumber;
          form.setValue(name, Number.isNaN(n) ? 0 : n, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />
      {unitName && (
        <InputSuffixAddon>
          <span className="text-muted-foreground px-2 text-xs">{unitName}</span>
        </InputSuffixAddon>
      )}
    </InputSuffixField>
  );
});

const SR_NARROW_COL = 28;

/**
 * ยอดเงินของแถว — อ่าน `total_cost` ที่ `SrItemCostSync` เขียนไว้
 *
 * ต้อง `useWatch` ไม่ใช่ `getValues` เพราะค่ามาทีหลัง (หลัง API ตอบ) ถ้าอ่านครั้ง
 * เดียวตอน render เซลล์จะค้างที่ 0 ตลอด
 */
const AmountCell = memo(function AmountCell({
  control,
  index,
}: {
  control: Control<SrFormValues>;
  index: number;
}) {
  "use no memo";
  const total = useWatch({ control, name: `items.${index}.total_cost` });
  return (
    <NameWithSubtext align="end" primary={formatCurrency(Number(total) || 0)} />
  );
});

export type SrItemField = FieldArrayWithId<SrFormValues, "items", "id">;

interface UseSrItemTableOptions {
  form: UseFormReturn<SrFormValues>;
  itemFields: SrItemField[];
  disabled: boolean;
  onDelete: (index: number) => void;
  fromLocationId: string;
  toLocationId: string;
  workflowId: string;
  role?: string;
}

export function useSrItemTable({
  form,
  itemFields,
  disabled,
  onDelete,
  fromLocationId,
  toLocationId,
  workflowId,
  role,
}: UseSrItemTableOptions) {
  "use no memo";
  const t = useTranslations("storeOperation.storeRequisition");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);

  const allCount = itemFields.length;
  const pendingCount = itemFields.filter((item) => {
    const status = item.current_stage_status ?? "";
    return !status || status === "pending";
  }).length;

  const translateStageStatus = useCallback(
    (value?: string) => {
      const v = value?.trim();
      if (!v || v === "pending") return ts("pending");
      // ช่องนี้เป็น "สถานะของแถว" ไม่ใช่ปุ่ม — ใช้คำบอกสถานะ ("ส่งแล้ว") ไม่ใช่
      // คำสั่งบนปุ่ม ซึ่งตอนนี้ยาวขึ้นเป็น "ส่งเพื่ออนุมัติ" และอ่านเป็นคำสั่ง
      if (v === "submit") return ts("submitted");
      if (v === "approve") return tc("approve");
      if (v === "reject") return tc("reject");
      if (v === "review") return tc("review");
      return v;
    },
    [tc, ts],
  );

  const isApproverOnly = role === STAGE_ROLE.APPROVE;
  const isIssuerOnly = role === STAGE_ROLE.ISSUE;
  const isViewOnly = role === STAGE_ROLE.VIEW_ONLY;
  const lockNonApproved = isApproverOnly || isIssuerOnly || isViewOnly;
  const lockNonIssued = isApproverOnly || isViewOnly;
  const lockApproved = isIssuerOnly || isViewOnly;
  const lockIssued = isViewOnly;

  const allColumns = useMemo<ColumnDef<SrItemField>[]>(() => {
    const indexColumn: ColumnDef<SrItemField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      // checkbox กับ # กว้างเท่ากัน (SR_NARROW_COL) — สองช่องนี้อยู่ติดกันหัวตาราง
      // กว้างไม่เท่ากันเห็นชัดว่าเบี้ยว และไม่ต้องเผื่อที่ให้อะไรมากกว่านี้
      size: SR_NARROW_COL,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const dataColumns: ColumnDef<SrItemField>[] = [
      {
        accessorKey: "product_id",
        header: tfl("product"),
        cell: ({ row }) => {
          return (
            <div data-product-cell-index={row.index}>
              <ProductCell
                control={form.control}
                form={form}
                index={row.index}
                disabled={disabled || lockNonApproved}
                fromLocationId={fromLocationId}
                toLocationId={toLocationId}
                workflowId={workflowId}
                statusSlot={
                  <StatusCell
                    control={form.control}
                    form={form}
                    index={row.index}
                    translate={translateStageStatus}
                    role={role}
                    disabled={disabled}
                  />
                }
              />
            </div>
          );
        },
        // เผื่อที่ปุ่มยอดคงเหลือ + จุดสถานะท้ายเซลล์ ไม่ให้ไปบีบกล่องเลือกสินค้า
        size: 220,
      },
      {
        accessorKey: "requested_qty",
        header: tfl("requested"),
        cell: ({ row }) => (
          <QtyUnitCell
            control={form.control}
            form={form}
            index={row.index}
            field="requested_qty"
            readOnly={disabled || lockNonApproved}
          />
        ),
        size: 128,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      ...(role === STAGE_ROLE.CREATE
        ? []
        : ([
            {
              accessorKey: "approved_qty",
              header: tfl("approved"),
              cell: ({ row }) => (
                <QtyUnitCell
                  control={form.control}
                  form={form}
                  index={row.index}
                  field="approved_qty"
                  readOnly={disabled || lockApproved}
                />
              ),
              size: 128,
              meta: {
                headerClassName: "text-right",
                cellClassName: "text-right",
              },
            },
          ] satisfies ColumnDef<SrItemField>[])),
      ...(lockNonIssued || role === STAGE_ROLE.CREATE
        ? []
        : ([
            {
              accessorKey: "issued_qty",
              header: tfl("issued"),
              cell: ({ row }) => (
                <QtyUnitCell
                  control={form.control}
                  form={form}
                  index={row.index}
                  field="issued_qty"
                  readOnly={disabled || lockIssued}
                />
              ),
              size: 128,
              meta: {
                headerClassName: "text-right",
                cellClassName: "text-right",
              },
            },
          ] satisfies ColumnDef<SrItemField>[])),
      {
        id: "amount",
        header: tfl("total"),
        cell: ({ row }) => (
          <AmountCell control={form.control} index={row.index} />
        ),
        size: 110,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
    ];

    const canDelete = !(disabled || lockNonApproved);
    const actionColumn: ColumnDef<SrItemField> = {
      id: "action",
      header: () => "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          {(row.original.history?.length ?? 0) > 0 && (
            <ItemHistorySheet
              history={row.original.history ?? []}
              productName={row.original.product_name}
              statusConfig={SR_ITEM_STATUS_CONFIG}
              label={t("tabWorkflowHistory")}
            />
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={tc("delete")}
              onClick={() => onDelete(row.index)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
      size: 64,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    };

    const normalizedRole = (role ?? "").toLowerCase();
    const showSelect =
      !disabled &&
      normalizedRole !== STAGE_ROLE.CREATE &&
      normalizedRole !== STAGE_ROLE.VIEW_ONLY;

    const srSelectColumn: ColumnDef<SrItemField> = {
      id: "select",
      header: ({ table: t }) => {
        const isAllSelected = t.getIsAllPageRowsSelected();
        const isSomeSelected = t.getIsSomePageRowsSelected();
        return (
          <Checkbox
            checked={
              isSomeSelected && !isAllSelected ? "indeterminate" : isAllSelected
            }
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectDialogOpen(true);
              } else {
                t.toggleAllPageRowsSelected(false);
              }
            }}
            aria-label="Select all"
            className="align-[inherit]"
          />
        );
      },
      cell: ({ row }) => (
        <SrSelectCell control={form.control} index={row.index} row={row} />
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      size: SR_NARROW_COL,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center",
      },
    };

    // แสดงคอลัมน์ action เมื่อแก้ไขได้ หรือมีรายการใดมีประวัติ workflow (ปุ่ม history)
    const hasAnyHistory = itemFields.some(
      (item) => (item.history?.length ?? 0) > 0,
    );

    // ระยะในเซลล์เท่ากับ PO/GRN/CN — ของกลางให้มาแค่ `py-1` ซึ่งแน่นกว่าตารางรายการ
    // โมดูลอื่นอยู่จุดเดียวในแอป อ่านสลับหน้ากันแล้วรู้สึกเหมือนคนละระบบ
    return [
      ...(showSelect ? [srSelectColumn] : []),
      indexColumn,
      ...dataColumns,
      ...(canDelete || hasAnyHistory ? [actionColumn] : []),
    ].map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        cellClassName: cn("py-2.5", col.meta?.cellClassName),
      },
    }));
  }, [
    form,
    disabled,
    lockNonApproved,
    lockApproved,
    lockIssued,
    lockNonIssued,
    onDelete,
    fromLocationId,
    toLocationId,
    workflowId,
    role,
    t,
    tfl,
    tc,
    translateStageStatus,
    itemFields,
  ]);

  const table = useReactTable({
    data: itemFields,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: (row) =>
      !isItemLocked(
        row.original.stage_status ?? "",
        row.original.current_stage_status ?? "",
      ),
  });

  const handleSelectAll = () => {
    table.toggleAllPageRowsSelected(true);
    setSelectDialogOpen(false);
  };

  const handleSelectPending = () => {
    const selection: Record<string, boolean> = {};
    for (const field of itemFields) {
      const status = field.current_stage_status ?? "";
      if (!status || status === "pending") {
        selection[field.id] = true;
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
