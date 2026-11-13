import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { CompactSection } from "@/components/share/compact-section";
import { useElementWidth } from "@/hooks/use-element-width";
import {
  ROW_CARDS_BELOW,
  RowCard,
  RowCardField,
  RowCards,
} from "./pd-row-cards";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import EmptyComponent from "@/components/empty-component";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { EcoLabel } from "@/types/eco-label";
import { useEcoLabel } from "../shared/use-eco-label";
import {
  useDeleteProductEcoLabel,
  useProductEcoLabels,
} from "./use-product-eco-label";
import type { ProductEcoLabel } from "@/types/product-eco-label";
import { ProductEcoLabelDialog } from "./pd-eco-label-dialog";

interface PdTabEcoProps {
  readonly productId: string;
  readonly readOnly?: boolean;
}

export function PdTabEco({ productId, readOnly }: PdTabEcoProps) {
  const t = useTranslations("productManagement.product");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tt = useTranslations("toast");
  const { dateFormat } = useProfile();

  const { data, isLoading } = useProductEcoLabels(productId);
  // TanStack ต้องได้ reference ที่นิ่ง — `data?.data ?? []` สร้าง array ใหม่ทุก
  // render แล้ว useReactTable จะ sync state ไม่จบ (เจอจริงที่ vendor-certificate-section
  // หลังเซฟ vendor สำเร็จ วนไป 245,156 รอบ)
  const items = useMemo(() => data?.data ?? [], [data]);
  // master เฉพาะที่แถวของสินค้านี้อ้างถึง (ดึงตาม id) · memo บน `items` / `masters`
  // ที่ reference นิ่ง — masterMap เป็น dep ของ columns ถ้าสร้างใหม่ทุก render
  // ตารางจะวน render (memory editable-datagrid-must-memoize-columns)
  const masterIds = useMemo(
    () => items.map((i) => i.master_eco_label_id),
    [items],
  );
  const { items: masters } = useEntitiesByIds<EcoLabel>({
    useListHook: useEcoLabel,
    ids: masterIds,
  });
  const masterMap = useMemo(
    () => new Map(masters.map((c) => [c.id, c] as const)),
    [masters],
  );

  const deleteEcoLabel = useDeleteProductEcoLabel();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductEcoLabel | null>(null);
  const [deleteItem, setDeleteItem] = useState<ProductEcoLabel | null>(null);

  const handleAdd = () => {
    setEditItem(null);
    setDialogOpen(true);
  };
  const handleEdit = (item: ProductEcoLabel) => {
    setEditItem(item);
    setDialogOpen(true);
  };
  const handleConfirmDelete = () => {
    if (!deleteItem) return;
    deleteEcoLabel.mutate(deleteItem.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: tfl("ecoLabel") }));
        setDeleteItem(null);
      },
    });
  };

  // กล่องกว้างพอ → คอลัมน์กว้างคงที่ คอลัมน์ชื่อฉลาก (ข้อความยาว) รับที่เหลือ · ผลรวมคอลัมน์:
  // # 32 · เลขที่ 250 · ฉลาก 250 · วันที่ 120×2 · สถานะ 100 = 872, โหมดแก้ + ปุ่มของแถว 84 = 956
  // กล่องแคบกว่านั้นแบ่งตามสัดส่วน · แคบกว่า 560 เป็นการ์ดทีละใบทั้งโหมดดูและแก้ (แก้ผ่าน dialog)
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const fixedColumns =
    (gridBoxWidth ?? Number.POSITIVE_INFINITY) >= (readOnly ? 890 : 975);
  const asCards = gridBoxWidth !== undefined && gridBoxWidth < ROW_CARDS_BELOW;

  const columns = useMemo<ColumnDef<ProductEcoLabel>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => row.index + 1,
        enableSorting: false,
        size: 32,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center text-muted-foreground",
        },
      },
      {
        id: "certificate_no",
        header: tfl("certificateNo"),
        size: 250,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.certificate_no}
          </span>
        ),
      },
      {
        id: "eco_label",
        header: tfl("ecoLabel"),
        size: 250,
        meta: fixedColumns ? { grow: true } : undefined,
        cell: ({ row }) => (
          <span className="font-medium">
            {masterMap.get(row.original.master_eco_label_id)?.name ?? ""}
          </span>
        ),
      },
      {
        id: "issued_date",
        header: tfl("issuedDate"),
        size: 120,
        cell: ({ row }) =>
          row.original.issued_date
            ? formatDate(row.original.issued_date, dateFormat)
            : "—",
        meta: { cellClassName: "tabular-nums" },
      },
      {
        id: "expiry_date",
        header: tfl("expiryDate"),
        size: 120,
        cell: ({ row }) =>
          row.original.expiry_date
            ? formatDate(row.original.expiry_date, dateFormat)
            : "—",
        meta: { cellClassName: "tabular-nums" },
      },
      {
        id: "status",
        header: tfl("status"),
        size: 100,
        cell: ({ row }) => (
          <StatusDotBadge tone={row.original.is_active ? "success" : "neutral"}>
            {row.original.is_active ? ts("active") : ts("inactive")}
          </StatusDotBadge>
        ),
        enableSorting: false,
      },
      ...(readOnly
        ? []
        : [
            {
              id: "action",
              header: () => "",
              cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={tc("edit")}
                    onClick={() => handleEdit(row.original)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={tc("delete")}
                    onClick={() => setDeleteItem(row.original)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ),
              enableSorting: false,
              // ปุ่ม 24px สองปุ่ม + gap 4 + padding เซลล์ 24 = 76 — 72 ทำให้ปุ่มขึ้นสองบรรทัด
              size: 84,
              meta: {
                headerClassName: "text-right",
                cellClassName: "text-right",
              },
            } as ColumnDef<ProductEcoLabel>,
          ]),
    ],
    [readOnly, dateFormat, tfl, tc, ts, masterMap, fixedColumns],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <CompactSection
      first
      frameless
      title={t("ecoLabelsTitle")}
      count={items.length}
      action={
        !readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAdd}
          >
            <Plus />
            {t("addEcoLabel")}
          </Button>
        ) : undefined
      }
    >
      <div ref={setGridBox}>
        {asCards ? (
          items.length === 0 ? (
            isLoading ? null : (
              <EmptyComponent title={t("noEcoLabels")} />
            )
          ) : (
            <RowCards>
              {items.map((item) => (
                <RowCard
                  key={item.id}
                  title={masterMap.get(item.master_eco_label_id)?.name ?? ""}
                  subtitle={item.certificate_no}
                  badge={
                    <StatusDotBadge
                      tone={item.is_active ? "success" : "neutral"}
                    >
                      {item.is_active ? ts("active") : ts("inactive")}
                    </StatusDotBadge>
                  }
                  actions={
                    readOnly ? undefined : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tc("edit")}
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tc("delete")}
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )
                  }
                >
                  <RowCardField label={tfl("issuedDate")}>
                    {item.issued_date
                      ? formatDate(item.issued_date, dateFormat)
                      : "—"}
                  </RowCardField>
                  <RowCardField label={tfl("expiryDate")}>
                    {item.expiry_date
                      ? formatDate(item.expiry_date, dateFormat)
                      : "—"}
                  </RowCardField>
                </RowCard>
              ))}
            </RowCards>
          )
        ) : (
          <DataGrid
            table={table}
            recordCount={items.length}
            isLoading={isLoading}
            // headerSticky: หัวตารางได้พื้นเดียวกับตารางหน้ารายการ (bg-background) ไม่งั้นหัวโปร่งเห็นพื้นขาวของกรอบ
            tableLayout={{ headerSticky: true }}
            emptyMessage={<EmptyComponent title={t("noEcoLabels")} />}
          >
            <DataGridContainer>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        )}
      </div>

      <ProductEcoLabelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
        ecoLabel={editItem}
      />

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) =>
          !open && !deleteEcoLabel.isPending && setDeleteItem(null)
        }
        title={t("deleteEcoLabelTitle")}
        description={t("deleteEcoLabelConfirm", {
          no: deleteItem?.certificate_no ?? "",
        })}
        isPending={deleteEcoLabel.isPending}
        onConfirm={handleConfirmDelete}
      />
    </CompactSection>
  );
}
