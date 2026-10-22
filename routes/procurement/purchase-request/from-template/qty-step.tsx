import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import {
  type ColumnDef,
  type SortingState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixQty,
} from "@/components/ui/input/input-suffix";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import type {
  PurchaseRequestTemplate,
  PurchaseRequestTemplateDetail,
} from "@/types/purchase-request";

const buildQtyColumns = (
  tfl: ReturnType<typeof useTranslations>,
  onQtyChange: (id: string, qty: number) => void,
): ColumnDef<PurchaseRequestTemplateDetail>[] => [
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
    id: "location_name",
    accessorFn: (row) => row.location?.name,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={tfl("location")} />
    ),
    // ชื่อคลังเป็นข้อความ — localeCompare ให้ไทย/อังกฤษเรียงตามภาษา ไม่ใช่ code point
    sortingFn: (a, b) =>
      (a.original.location?.name ?? "").localeCompare(
        b.original.location?.name ?? "",
      ),
    size: 180,
    cell: ({ row }) => (
      <NameWithSubtext
        primary={row.original.location?.name || "—"}
        secondary={row.original.location?.code ?? undefined}
      />
    ),
  },
  {
    id: "product_name",
    accessorFn: (row) => row.product?.name,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={tfl("product")} />
    ),
    sortingFn: (a, b) =>
      (a.original.product?.name ?? "").localeCompare(
        b.original.product?.name ?? "",
      ),
    size: 320,
    cell: ({ row }) => (
      <NameWithSubtext
        primary={row.original.product?.name || "—"}
        secondary={row.original.product?.local_name ?? undefined}
      />
    ),
  },
  {
    id: "requested",
    header: tfl("requested"),
    enableSorting: false,
    size: 180,
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => {
      const d = row.original;
      return (
        <InputSuffixField>
          <InputSuffixQty
            aria-label={`${tfl("requested")} ${d.product?.name ?? ""}`}
            defaultValue={d.requested_qty ?? 0}
            className="tabular-nums"
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              onQtyChange(d.id, Number.isNaN(n) ? 0 : n);
            }}
          />
          <InputSuffixAddon className="w-16">
            {/* flex-1 ก่อน ไม่งั้น span กว้างเท่าตัวอักษร แล้ว text-right ไม่มีที่ให้จัด
                (addon เป็น flex container ที่ w-16 อยู่กับกล่องนอก ไม่ใช่ตัว span) */}
            <span className="text-muted-foreground flex-1 px-2 text-right text-xs">
              {d.requested_unit?.name}
            </span>
          </InputSuffixAddon>
        </InputSuffixField>
      );
    },
  },
  {
    id: "currency_code",
    accessorFn: (row) => row.currency?.code,
    header: tfl("currency"),
    enableSorting: false,
    size: 90,
    meta: {
      headerClassName: "text-center",
      cellClassName: "text-center text-muted-foreground",
    },
    cell: ({ row }) => row.original.currency?.code || "—",
  },
  {
    id: "delivery_point_name",
    accessorFn: (row) => row.delivery_point?.name,
    header: tfl("deliveryPoint"),
    enableSorting: false,
    size: 160,
    meta: { cellClassName: "text-muted-foreground" },
    cell: ({ row }) => row.original.delivery_point?.name || "—",
  },
];

interface QtyStepProps {
  readonly template: PurchaseRequestTemplate;
  readonly onBack: () => void;
  readonly onContinue: (items: PurchaseRequestTemplateDetail[]) => void;
}

/**
 * ขั้นที่สองของการสร้างใบจากเทมเพลต — กรอกจำนวนที่ต้องการรอบนี้ ตั้ง 0 = ไม่เอา
 *
 * จำนวนเป็น state ของขั้นนี้เอง ข้างนอกรู้แค่ผลลัพธ์ตอนกดต่อ — ผู้เรียกต้องใส่
 * `key={template.id}` เพื่อให้เปลี่ยนเทมเพลตแล้วค่าที่กรอกค้างไม่ตามมาด้วย
 */
export function QtyStep({ template, onBack, onContinue }: QtyStepProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const rows = template.purchase_request_template_detail;

  // ตั้งต้นด้วยจำนวนที่เทมเพลตเก็บไว้ — คนตั้งเทมเพลตใส่จำนวนที่สั่งประจำไว้แล้ว
  // ให้ปรับเฉพาะแถวที่รอบนี้ต่างออกไป เร็วกว่าเริ่มจากศูนย์ทุกแถว
  const [qtyById, setQtyById] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((d) => [d.id, d.requested_qty ?? 0])),
  );

  // functional update → ตัวนี้ไม่ต้องรู้ค่า qty ปัจจุบัน identity จึงคงที่ตลอดชีวิตหน้า
  const handleQtyChange = useCallback((id: string, qty: number) => {
    setQtyById((prev) => ({ ...prev, [id]: qty }));
  }, []);

  // columns ต้อง memo — ไม่งั้นทุกครั้งที่พิมพ์เลข cell renderer เป็นฟังก์ชันคนละตัว
  // React มองเป็นคอมโพเนนต์คนละชนิด แล้ว unmount/remount ช่องกรอกทิ้ง focus กลางคัน
  const columns = useMemo(
    () => buildQtyColumns(tfl, handleQtyChange),
    [tfl, handleQtyChange],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: rows,
    columns,
    // เรียงฝั่ง client ล้วน — ข้อมูลมาทั้งชุดกับเทมเพลตอยู่แล้ว ไม่มี query ให้ยิงซ้ำ
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const pickedItems = rows.filter((d) => (qtyById[d.id] ?? 0) > 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* workflow นำหน้าชื่อเทมเพลต — ใบที่กำลังจะเกิดเดินตาม workflow นี้
          และเปลี่ยนทีหลังไม่ได้ ต้องเห็นก่อนกรอกจำนวน ไม่ใช่ไปรู้ในฟอร์ม */}
      <DocFormHeader
        flush
        title={
          template.workflow?.name
            ? `${template.workflow.name} · ${template.name}`
            : template.name
        }
        subtitle={t("templateQtyDesc")}
        onBack={onBack}
        actions={
          <Button
            size="sm"
            onClick={() =>
              onContinue(
                pickedItems.map((d) => ({
                  ...d,
                  requested_qty: qtyById[d.id] ?? 0,
                })),
              )
            }
            disabled={pickedItems.length === 0}
          >
            {tc("next")}
            <ArrowRight />
          </Button>
        }
      />

      <div className="space-y-4">
        <DataGrid
          table={table}
          recordCount={rows.length}
          tableLayout={{
            headerBackground: true,
            rowBorder: true,
            // เซลล์มี input — clamp ใช้ -webkit-box แล้วทำ layout ของ control เพี้ยน
            rowClamp: false,
          }}
          tableClassNames={{
            // table-fixed แบ่งเป็น % — จอแคบกว่านี้ช่องจำนวนถูกบีบจนไม่เห็นตัวเลข
            // ตั้งขั้นต่ำแล้วให้ container เลื่อนแนวนอนแทน (ไม่ใช่ min-w-max: ดู
            // CONTENT_SIZED_TABLE ใน data-grid-table)
            base: "text-xs min-w-[44rem]",
            headerRow: "h-10",
            bodyRow: "h-14",
          }}
        >
          <DataGridContainer className="rounded-lg border">
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
        {/* บอกจำนวนที่จะเข้าใบจริง — ตั้ง 0 ไว้หลายแถวแล้วกดต่อต้องไม่เซอร์ไพรส์ */}
        <p className="text-muted-foreground text-micro tabular-nums">
          {t("nItems", { count: pickedItems.length })}
        </p>
      </div>
    </div>
  );
}
