import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { SettingSection } from "@/components/ui/setting-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Certification } from "@/types/certification";
import { useCertification } from "../shared/use-certification";
import {
  useDeleteVendorCertificate,
  useVendorCertificates,
} from "./use-vendor-certificate";
import type { VendorCertificate } from "@/types/vendor-certificate";
import { VendorCertificateDialog } from "./vendor-certificate-dialog";
import { VendorEmptySection } from "./vendor-empty-section";

/** ใบรับรองที่เหลืออายุไม่เกินนี้ (วัน) ขึ้นคำเตือนใต้วันหมดอายุ */
const EXPIRY_WARN_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * จำนวนวันปฏิทินจากวันนี้ถึงวันหมดอายุ (0 = หมดวันนี้, ติดลบ = หมดแล้ว)
 * นับตามเวลาเครื่องให้ตรงกับวันที่ที่ formatDate แสดงในคอลัมน์เดียวกัน
 */
function daysUntil(iso: string, now: Date = new Date()): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.round((end - today) / DAY_MS);
}

interface VendorCertificateSectionProps {
  readonly vendorId: string;
  readonly readOnly?: boolean;
}

export function VendorCertificateSection({
  vendorId,
  readOnly,
}: VendorCertificateSectionProps) {
  const t = useTranslations("vendorManagement.vendor");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const { dateFormat } = useProfile();

  const { data, isLoading } = useVendorCertificates(vendorId);
  // **ต้อง memo** — `data?.data ?? []` สร้าง array ใหม่ทุก render แล้ว
  // `useReactTable({ data: items })` จะ sync state ไม่จบ · เจอจริงหลังเซฟ vendor
  // สำเร็จ (onSuccess → form.reset + setMode("view")) section นี้ re-render
  // 245,156 รอบใน 60 วิ หน้าค้างสนิท · ใส่ memo แล้วเหลือ 5 รอบ 22ms
  const items = useMemo(() => data?.data ?? [], [data]);
  // master เฉพาะที่แถวของ vendor นี้อ้างถึง (ดึงตาม id) · memo บน `items` /
  // `masters` ที่ reference นิ่ง — masterMap เป็น dep ของ columns ถ้าสร้างใหม่ทุก
  // render section นี้จะวน render แบบเดียวกับบั๊ก 245,156 รอบข้างบน
  const masterIds = useMemo(
    () => items.map((i) => i.master_certificate_id),
    [items],
  );
  const { items: masters } = useEntitiesByIds<Certification>({
    useListHook: useCertification,
    ids: masterIds,
  });
  const masterMap = useMemo(
    () => new Map(masters.map((c) => [c.id, c] as const)),
    [masters],
  );

  const deleteCert = useDeleteVendorCertificate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<VendorCertificate | null>(null);
  const [deleteItem, setDeleteItem] = useState<VendorCertificate | null>(null);

  const handleAdd = () => {
    setEditItem(null);
    setDialogOpen(true);
  };
  const handleEdit = (item: VendorCertificate) => {
    setEditItem(item);
    setDialogOpen(true);
  };
  const handleConfirmDelete = () => {
    if (!deleteItem) return;
    deleteCert.mutate(deleteItem.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: tfl("certificate") }));
        setDeleteItem(null);
      },
    });
  };

  const columns = useMemo<ColumnDef<VendorCertificate>[]>(
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
        size: 120,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.certificate_no}
          </span>
        ),
      },
      {
        id: "certificate",
        header: tfl("certificate"),
        size: 200,
        cell: ({ row }) => (
          <span className="font-medium">
            {masterMap.get(row.original.master_certificate_id)?.name ?? ""}
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
        cell: ({ row }) => {
          const expiry = row.original.expiry_date;
          if (!expiry) return "—";
          const days = daysUntil(expiry);
          // เงียบไว้เมื่อยังไกล — บอกเฉพาะใบที่ใกล้หมด/หมดแล้ว ซึ่งฝ่ายจัดซื้อต้องรู้ก่อนออก PO
          const hint =
            days === null || days > EXPIRY_WARN_DAYS ? null : days < 0 ? (
              <span className="text-destructive">{t("certExpired")}</span>
            ) : (
              <span className="text-warning-ink">
                {t("certExpiresIn", { count: days })}
              </span>
            );
          return (
            // data-slot กัน DataGrid ใส่ line-clamp ให้ลูกของเซลล์ (มันจับ
            // `:not([data-slot])` แล้วเปลี่ยน display ทับ flex-col จนสองบรรทัดชนกัน)
            <div data-slot="cert-expiry" className="flex flex-col">
              <span>{formatDate(expiry, dateFormat)}</span>
              {hint && <span className="text-micro font-medium">{hint}</span>}
            </div>
          );
        },
        meta: { cellClassName: "tabular-nums" },
      },
      {
        id: "status",
        header: tfl("status"),
        size: 100,
        cell: ({ row }) => <StatusBadge active={!!row.original.is_active} />,
        enableSorting: false,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
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
              size: 72,
              meta: {
                headerClassName: "text-right",
                cellClassName: "text-right",
              },
            } as ColumnDef<VendorCertificate>,
          ]),
    ],
    [readOnly, dateFormat, t, tfl, tc, masterMap],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <SettingSection
      wide
      frameless
      title={t("certificatesTitle")}
      description={t("certificatesDesc")}
      count={items.length}
      action={
        !readOnly ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAdd}
          >
            <Plus />
            {t("addCertificate")}
          </Button>
        ) : undefined
      }
    >
      <DataGrid
        table={table}
        recordCount={items.length}
        isLoading={isLoading}
        emptyMessage={
          <VendorEmptySection
            compact={readOnly}
            icon={Award}
            title={t("noCertificates")}
            description={t("noCertificatesDesc")}
          />
        }
      >
        <DataGridContainer>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>

      <VendorCertificateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendorId={vendorId}
        certificate={editItem}
      />

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) =>
          !open && !deleteCert.isPending && setDeleteItem(null)
        }
        title={t("deleteCertificateTitle")}
        description={t("deleteCertificateConfirm", {
          no: deleteItem?.certificate_no ?? "",
        })}
        isPending={deleteCert.isPending}
        onConfirm={handleConfirmDelete}
      />
    </SettingSection>
  );
}
