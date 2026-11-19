import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputQty } from "@/components/ui/input/input-qty";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { LookupProductUnit } from "@/components/lookup/lookup-product-unit";
import { LookupWorkflow } from "@/components/lookup/lookup-workflow";
import { useCreateStockReplPr } from "./use-stock-replenishment";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { Location, ProductLocation } from "@/types/stock-replenishment";

export interface StockReplPrRow {
  readonly location: Location;
  readonly product: ProductLocation;
}

interface StockReplPrWizardProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly rows: readonly StockReplPrRow[];
  readonly onCreated?: () => void;
}

const rowKey = (row: StockReplPrRow) =>
  `${row.location.location_id}:${row.product.id}`;

interface RowDraft {
  qty: number;
  unitId: string;
}

type PrTableRow = StockReplPrRow & { readonly draft: RowDraft };

/**
 * Wizard สร้างใบขอซื้อจากรายการที่ติ๊กในหน้า Stock Replenishment
 *
 * หน้าเดียวจบ: เลือก workflow แล้วทบทวนรายการในตารางเดียวกัน (แก้จำนวน เลือกหน่วย
 * ตัดแถวออก) แล้วยิง `POST /stock-replenishments/pr` — ต้องผ่าน endpoint นี้เท่านั้น
 * ไม่ใช่ประกอบใบเองแล้วส่งเข้า endpoint สร้าง PR ปกติ เพราะ `verify()` ฝั่งหลังบ้าน
 * ตรวจให้ด้วยว่า workflow/สินค้า/คลัง เข้ากันไหม และผู้ใช้มีสิทธิ์ในคลังนั้นจริงไหม
 *
 * ติ๊กข้ามคลังได้ — ใบหนึ่งผูกคลังเดียว wizard จึงยิงทีละคลังตามลำดับ ได้ใบขอซื้อคลังละใบ
 *
 * จำนวนตั้งต้นคือ `reorder_qty` (ส่วนที่ขาดจากเกณฑ์ par) ส่วนหน่วยปล่อยให้
 * `LookupProductUnit` auto-select หน่วยแรกของสินค้าให้เอง
 *
 * @param props - คุณสมบัติของ wizard
 * @param props.open - เปิดอยู่หรือไม่
 * @param props.onOpenChange - callback เปลี่ยนสถานะเปิด/ปิด
 * @param props.rows - รายการที่ติ๊กไว้พร้อมคลังของแต่ละแถว
 * @param props.onCreated - เรียกเมื่อสร้างสำเร็จ
 * @returns React element ของ wizard
 */
export function StockReplPrWizard({
  open,
  onOpenChange,
  rows,
  onCreated,
}: StockReplPrWizardProps) {
  // React Compiler แช่ JSX ของ DataGrid ได้ (table เป็น ref คงที่) — พิมพ์จำนวนแล้วตารางจะไม่ขยับ
  "use no memo";
  const t = useTranslations("storeOperation.stockReplenishment");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const createPr = useCreateStockReplPr();

  const [workflowId, setWorkflowId] = useState("");
  const [drafts, setDrafts] = useState<Map<string, RowDraft>>(new Map());
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  // ตั้งค่าตั้งต้นใหม่ทุกครั้งที่เปิด — ของที่ติ๊กไว้เปลี่ยนได้ระหว่างที่ dialog ปิดอยู่
  useEffect(() => {
    if (!open) return;
    setWorkflowId("");
    setRemoved(new Set());
    setDrafts(
      new Map(
        rows.map((row) => [
          rowKey(row),
          { qty: row.product.reorder_qty, unitId: "" },
        ]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งค่าตอนเปิดเท่านั้น
  }, [open]);

  const activeRows = rows.filter((row) => !removed.has(rowKey(row)));
  const draftOf = (row: StockReplPrRow): RowDraft =>
    drafts.get(rowKey(row)) ?? { qty: row.product.reorder_qty, unitId: "" };

  // functional update → ไม่ต้องรู้ค่า drafts ปัจจุบัน identity จึงคงที่ตลอดชีวิต dialog
  const patchDraft = useCallback(
    (row: StockReplPrRow, patch: Partial<RowDraft>) => {
      const key = rowKey(row);
      setDrafts((prev) => {
        const next = new Map(prev);
        next.set(key, {
          ...(prev.get(key) ?? { qty: row.product.reorder_qty, unitId: "" }),
          ...patch,
        });
        return next;
      });
    },
    [],
  );

  const handleRemove = useCallback((row: StockReplPrRow) => {
    setRemoved((prev) => new Set(prev).add(rowKey(row)));
  }, []);

  // `data` ต้อง identity คงที่ — ไฟล์นี้ปิด React Compiler ไว้ ไม่มีใครจำให้ ถ้าส่ง array
  // ใหม่ทุก render getCoreRowModel จะเรียก `_autoResetPageIndex` → setState pagination
  // (object ใหม่เสมอ) → render ใหม่ → array ใหม่ วนไม่จบ หน้าค้างทั้งแท็บโดยไม่มี error
  const tableRows = useMemo<PrTableRow[]>(
    () =>
      rows
        .filter((row) => !removed.has(rowKey(row)))
        .map((row) => ({
          ...row,
          draft: drafts.get(rowKey(row)) ?? {
            qty: row.product.reorder_qty,
            unitId: "",
          },
        })),
    [rows, removed, drafts],
  );

  const columns = useMemo<ColumnDef<PrTableRow>[]>(
    () => [
      {
        id: "index",
        header: "#",
        size: 48,
        enableSorting: false,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center text-muted-foreground tabular-nums",
        },
        cell: ({ row }) => row.index + 1,
      },
      {
        id: "location",
        header: tfl("location"),
        size: 160,
        enableSorting: false,
        meta: { cellClassName: "text-muted-foreground" },
        cell: ({ row }) => row.original.location.location_name,
      },
      {
        id: "product",
        header: tfl("product"),
        size: 260,
        enableSorting: false,
        cell: ({ row }) => (
          <NameWithSubtext
            primary={row.original.product.name}
            secondary={row.original.product.code}
          />
        ),
      },
      {
        id: "qty",
        header: t("requestQty"),
        size: 150,
        enableSorting: false,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => (
          <InputQty
            aria-label={`${t("requestQty")} ${row.original.product.name}`}
            value={row.original.draft.qty}
            onChange={(e) =>
              patchDraft(row.original, {
                qty: e.currentTarget.valueAsNumber || 0,
              })
            }
            className="ms-auto h-7 w-24 text-right text-xs"
          />
        ),
      },
      {
        id: "unit",
        header: tfl("unit"),
        size: 170,
        enableSorting: false,
        cell: ({ row }) => (
          <LookupProductUnit
            productId={row.original.product.id}
            value={row.original.draft.unitId}
            onValueChange={(unitId) => patchDraft(row.original, { unitId })}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        size: 56,
        enableSorting: false,
        meta: { cellClassName: "text-center" },
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => handleRemove(row.original)}
            aria-label={tc("delete")}
          >
            <Trash2 className="text-destructive size-3.5" />
          </Button>
        ),
      },
    ],
    [t, tfl, tc, patchDraft, handleRemove],
  );

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => rowKey(row),
  });

  // แถวที่จำนวนเป็น 0/ติดลบ หรือยังไม่มีหน่วย backend ปฏิเสธที่ DTO อยู่แล้ว
  const canContinue =
    !!workflowId &&
    activeRows.length > 0 &&
    activeRows.every((row) => {
      const draft = draftOf(row);
      return draft.qty > 0 && !!draft.unitId;
    });

  // payload รับ `location_id` เดียวและมันถูกประทับลงทุกบรรทัดของใบ (ดู
  // buildPurchaseRequestDraft) ติ๊กข้ามคลังจึงแปลว่าได้ใบขอซื้อคลังละใบ
  const byLocation = new Map<string, StockReplPrRow[]>();
  for (const row of activeRows) {
    const key = row.location.location_id;
    byLocation.set(key, [...(byLocation.get(key) ?? []), row]);
  }

  /**
   * ยิงทีละคลังตามลำดับ ไม่ขนาน — พังใบไหนหยุดตรงนั้น ใบก่อนหน้าที่สร้างไปแล้วยกเลิก
   * ให้ไม่ได้ (ไม่มี endpoint ถอน) จึงต้องบอกให้ชัดว่าได้ไปแล้วกี่ใบ ไม่ใช่ปล่อยให้
   * เห็นแต่ error แล้วเข้าใจว่าไม่มีอะไรเกิดขึ้น · error ของแต่ละใบ mutationCache
   * เด้ง toast ให้เองอยู่แล้ว ที่นี่จึงไม่ต้อง toast.error ซ้ำ
   */
  const handleSubmit = async () => {
    let created = 0;
    try {
      for (const [locationId, locationRows] of byLocation) {
        await createPr.mutateAsync({
          workflow_id: workflowId,
          location_id: locationId,
          products: locationRows.map((row) => ({
            id: row.product.id,
            request_unit_id: draftOf(row).unitId,
            request_qty: draftOf(row).qty,
          })),
        });
        created += 1;
      }
    } catch {
      // error ถูก toast ไปแล้วโดย mutationCache — ที่เหลือคือรายงานว่าได้ไปกี่ใบ
    }
    if (created > 0) {
      toast.success(t("createdNPr", { count: created }));
      onOpenChange(false);
      onCreated?.();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !createPr.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("createPrTitle")}</DialogTitle>
          <DialogDescription>{t("createPrDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field className="w-full sm:max-w-xs">
            <FieldLabel required>{tfl("workflow")}</FieldLabel>
            <LookupWorkflow
              value={workflowId}
              onValueChange={setWorkflowId}
              workflowType={WORKFLOW_TYPE.PR}
              creatableOnly
              className="text-xs"
            />
          </Field>
          <p className="text-muted-foreground pb-1.5 text-xs">
            {t("nItems", { count: activeRows.length })}
            {byLocation.size > 1 && (
              <>
                {" · "}
                {t("nDocumentsWillBeCreated", { count: byLocation.size })}
              </>
            )}
          </p>
        </div>

        <DataGrid
          table={table}
          recordCount={tableRows.length}
          tableLayout={{
            headerSticky: true,
            // เซลล์มี input/select — clamp ใช้ -webkit-box แล้วทำ layout ของ control เพี้ยน
            rowClamp: false,
          }}
          tableClassNames={{
            // header ทึบ ไม่งั้นแถวที่เลื่อนอยู่ใต้มันทะลุขึ้นมา (stripped ทำ header โปร่ง)
            headerRow: "bg-muted",
            headerSticky: "sticky top-0 z-10",
          }}
        >
          <DataGridContainer scroll className="max-h-96">
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createPr.isPending}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canContinue || createPr.isPending}
          >
            {createPr.isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {tc("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
