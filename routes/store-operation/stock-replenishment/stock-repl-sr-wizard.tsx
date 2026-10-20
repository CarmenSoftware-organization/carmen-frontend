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
import { LookupLocation } from "@/components/lookup/lookup-location";
import { LookupWorkflow } from "@/components/lookup/lookup-workflow";
import { useCreateStockReplSr } from "./use-stock-replenishment";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { Location, ProductLocation } from "@/types/stock-replenishment";

interface StockReplSrWizardProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly location?: Location;
  readonly products: readonly ProductLocation[];
  readonly onCreated?: () => void;
}

/**
 * Wizard สร้างใบเบิกของจากรายการที่ติ๊กในหน้า Stock Replenishment
 *
 * เลือกสายอนุมัติ + คลังต้นทาง แล้วทบทวนรายการในตารางเดียวกัน (แก้จำนวน ตัดแถวออก)
 * แล้วยิง `POST /stock-replenishments/sr` — ต้องผ่าน endpoint นี้เท่านั้น เพราะ
 * `verify()` ฝั่งหลังบ้านตรวจให้ด้วยว่า workflow/สินค้า/คลัง เข้ากันไหม และผู้ใช้มีสิทธิ์
 * ในคลังทั้งต้นทางและปลายทางจริงไหม
 *
 * ไม่มีคอลัมน์หน่วยเหมือนฝั่ง PR โดยตั้งใจ — ใบเบิกย้ายของที่เก็บเป็นหน่วยคลังของ
 * สินค้าอยู่แล้ว จึงไม่มีหน่วยให้เลือก (ตรงกับ DTO ฝั่ง backend ที่ SR ไม่มี
 * `request_unit_id`)
 *
 * @param props - คุณสมบัติของ wizard
 * @param props.open - เปิดอยู่หรือไม่
 * @param props.onOpenChange - callback เปลี่ยนสถานะเปิด/ปิด
 * @param props.location - คลังปลายทาง (คลังที่ของขาด)
 * @param props.products - รายการที่ติ๊กไว้
 * @param props.onCreated - เรียกเมื่อสร้างสำเร็จ
 * @returns React element ของ wizard
 */
export function StockReplSrWizard({
  open,
  onOpenChange,
  location,
  products,
  onCreated,
}: StockReplSrWizardProps) {
  // React Compiler แช่ JSX ของ DataGrid ได้ (table เป็น ref คงที่) — พิมพ์จำนวนแล้วตารางจะไม่ขยับ
  "use no memo";
  const t = useTranslations("storeOperation.stockReplenishment");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const tfl = useTranslations("field");
  const createSr = useCreateStockReplSr();

  const [workflowId, setWorkflowId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [qtys, setQtys] = useState<Map<string, number>>(new Map());
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  // ตั้งค่าตั้งต้นใหม่ทุกครั้งที่เปิด — ของที่ติ๊กไว้เปลี่ยนได้ระหว่างที่ dialog ปิดอยู่
  useEffect(() => {
    if (!open) return;
    setWorkflowId("");
    setFromLocationId("");
    setRemoved(new Set());
    setQtys(new Map(products.map((p) => [p.id, p.reorder_qty])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งค่าตอนเปิดเท่านั้น
  }, [open]);

  const activeProducts = products.filter((p) => !removed.has(p.id));
  const qtyOf = (product: ProductLocation) =>
    qtys.get(product.id) ?? product.reorder_qty;

  // functional update → ไม่ต้องรู้ค่า qtys ปัจจุบัน identity จึงคงที่ตลอดชีวิต dialog
  const setQty = useCallback((product: ProductLocation, qty: number) => {
    setQtys((prev) => new Map(prev).set(product.id, qty));
  }, []);

  const handleRemove = useCallback((product: ProductLocation) => {
    setRemoved((prev) => new Set(prev).add(product.id));
  }, []);

  const tableRows = activeProducts.map((product) => ({
    product,
    qty: qtyOf(product),
  }));
  type SrTableRow = (typeof tableRows)[number];

  const columns = useMemo<ColumnDef<SrTableRow>[]>(
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
        id: "product",
        header: tfl("product"),
        size: 360,
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
            value={row.original.qty}
            onChange={(e) =>
              setQty(row.original.product, e.currentTarget.valueAsNumber || 0)
            }
            className="ms-auto h-7 w-24 text-right text-xs"
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
            onClick={() => handleRemove(row.original.product)}
            aria-label={tc("delete")}
          >
            <Trash2 className="text-destructive size-3.5" />
          </Button>
        ),
      },
    ],
    [t, tfl, tc, setQty, handleRemove],
  );

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.product.id,
  });

  // แถวที่จำนวนเป็น 0/ติดลบ backend ปฏิเสธที่ DTO อยู่แล้ว
  const canContinue =
    !!workflowId &&
    !!fromLocationId &&
    !!location &&
    activeProducts.length > 0 &&
    activeProducts.every((p) => qtyOf(p) > 0);

  const handleSubmit = () => {
    if (!location) return;
    createSr.mutate(
      {
        workflow_id: workflowId,
        location_id: location.location_id,
        from_location: fromLocationId,
        products: activeProducts.map((product) => ({
          id: product.id,
          request_qty: qtyOf(product),
        })),
      },
      {
        onSuccess: () => {
          toast.success(tt("createSuccess", { entity: "SR" }));
          onOpenChange(false);
          onCreated?.();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !createSr.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("createSrTitle")}</DialogTitle>
          <DialogDescription>{t("createSrDesc")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel required>{tfl("workflow")}</FieldLabel>
            <LookupWorkflow
              value={workflowId}
              onValueChange={setWorkflowId}
              workflowType={WORKFLOW_TYPE.SR}
              creatableOnly
              className="text-xs"
            />
          </Field>
          <Field>
            <FieldLabel required>{tfl("fromLocation")}</FieldLabel>
            {/* เบิกจากคลังตัวเองไม่ได้ — ตัดปลายทางออกจากตัวเลือกไปเลย */}
            <LookupLocation
              value={fromLocationId}
              onValueChange={setFromLocationId}
              excludeIds={location ? [location.location_id] : undefined}
              className="text-xs"
              modal
            />
          </Field>
          {/* ปลายทางคือคลังที่ของขาด — ใช้ lookup ตัวเดียวกับต้นทางเพื่อให้สองช่อง
              หน้าตาเหมือนกัน แต่ปิดไว้ ค่ามาจากแถวที่ติ๊กเสมอ เลือกเองไม่ได้ */}
          <Field>
            <FieldLabel>{tfl("toLocation")}</FieldLabel>
            <LookupLocation
              value={location?.location_id ?? ""}
              defaultLabel={location?.location_name}
              onValueChange={() => {}}
              disabled
              className="text-xs"
              modal
            />
          </Field>
        </div>

        <DataGrid
          table={table}
          recordCount={tableRows.length}
          tableLayout={{
            headerSticky: true,
            // เซลล์มี input — clamp ใช้ -webkit-box แล้วทำ layout ของ control เพี้ยน
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
            disabled={createSr.isPending}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canContinue || createSr.isPending}
          >
            {createSr.isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {tc("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
