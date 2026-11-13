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
import { Skeleton } from "@/components/ui/skeleton";
import { CompactSection } from "@/components/share/compact-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/date-utils";
import { useElementWidth } from "@/hooks/use-element-width";
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

  // กล่องกว้างพอ → คอลัมน์กว้างคงที่ สถานะรับที่เหลือ (ชิดซ้าย) คอลัมน์จึงอยู่ติดกัน ไม่กระจายห่างกัน
  // เป็นพันพิกเซลบนจอกว้าง · กล่องแคบกว่าผลรวมคอลัมน์ (# 32 · เลขที่ 120 · ชื่อ 220 · วันที่ 100×2 ·
  // สถานะ 100 = 672, โหมดแก้ + ปุ่มของแถว 84 = 756) → กลับไปแบ่งตามสัดส่วนเหมือนเดิม ไม่งั้นตารางล้น
  // กล่อง (คอลัมน์ยืดล็อกความกว้างขั้นต่ำของตารางไว้ที่ผลรวม) · จุดเปลี่ยนสูงกว่าผลรวมเล็กน้อย
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const fixedColumns =
    (gridBoxWidth ?? Number.POSITIVE_INFINITY) >= (readOnly ? 690 : 775);
  // กล่องแคบ (มือถือ ~300px) → การ์ดทีละใบแทนตาราง: ตาราง 6–7 คอลัมน์บีบลงกล่อง 300px แล้วหัวคอลัมน์
  // กับวันที่ตัดบรรทัดจนอ่านไม่ออก (ผู้ใช้สั่ง 2026-11-13) · undefined = ยังไม่ได้วัด ใช้ตารางไปก่อน
  const asCards = gridBoxWidth !== undefined && gridBoxWidth < 560;

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
        size: 220,
        cell: ({ row }) => (
          <span className="font-medium">
            {masterMap.get(row.original.master_certificate_id)?.name ?? ""}
          </span>
        ),
      },
      {
        id: "issued_date",
        header: tfl("issuedDate"),
        size: 100,
        cell: ({ row }) =>
          row.original.issued_date
            ? formatDate(row.original.issued_date, dateFormat)
            : "—",
        meta: { cellClassName: "tabular-nums" },
      },
      {
        id: "expiry_date",
        header: tfl("expiryDate"),
        size: 100,
        cell: ({ row }) => {
          const expiry = row.original.expiry_date;
          if (!expiry) return "—";
          return (
            // data-slot กัน DataGrid ใส่ line-clamp ให้ลูกของเซลล์ (มันจับ
            // `:not([data-slot])` แล้วเปลี่ยน display ทับ flex-col จนสองบรรทัดชนกัน)
            <div data-slot="cert-expiry" className="flex flex-col">
              <span>{formatDate(expiry, dateFormat)}</span>
              <ExpiryHint expiry={expiry} />
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
        meta: fixedColumns
          ? { grow: true }
          : { headerClassName: "text-center", cellClassName: "text-center" },
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
              // 84 ไม่ใช่ 72: ปุ่ม 24px สองปุ่ม + ช่องไฟ 4 + padding เซลล์ 24 = 76 — ที่ 72 ปุ่มตกเป็นสองบรรทัด
              size: 84,
              meta: {
                headerClassName: "text-right",
                cellClassName: "text-right",
              },
            } as ColumnDef<VendorCertificate>,
          ]),
    ],
    [readOnly, dateFormat, tfl, tc, masterMap, fixedColumns],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <CompactSection
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
      <div ref={setGridBox}>
        {asCards ? (
          <CertificateCards
            items={items}
            isLoading={isLoading}
            readOnly={readOnly}
            masterMap={masterMap}
            dateFormat={dateFormat}
            onEdit={handleEdit}
            onDelete={setDeleteItem}
          />
        ) : (
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
        )}
      </div>

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
    </CompactSection>
  );
}

/** บอกเฉพาะใบที่ใกล้หมด/หมดแล้ว ซึ่งฝ่ายจัดซื้อต้องรู้ก่อนออก PO — ยังไกลอยู่ไม่แสดงอะไร */
function ExpiryHint({ expiry }: { readonly expiry: string }) {
  const t = useTranslations("vendorManagement.vendor");
  const days = daysUntil(expiry);
  if (days === null || days > EXPIRY_WARN_DAYS) return null;
  return (
    <span className="text-micro font-medium">
      {days < 0 ? (
        <span className="text-destructive">{t("certExpired")}</span>
      ) : (
        <span className="text-warning-ink">
          {t("certExpiresIn", { count: days })}
        </span>
      )}
    </span>
  );
}

/**
 * ใบรับรองแบบการ์ด — ใช้เมื่อกล่องแคบกว่าที่ตารางจะอ่านออก
 *
 * ข้อมูลชุดเดียวกับตารางทุกช่อง: ชื่อใบรับรอง + สถานะ · เลขที่ · วันออก · วันหมดอายุ (พร้อมคำเตือน)
 * และปุ่มแก้/ลบในโหมดแก้ ปุ่มสูง 32px (ใหญ่กว่าในตาราง) เพราะเป็นจอสัมผัส
 */
function CertificateCards({
  items,
  isLoading,
  readOnly,
  masterMap,
  dateFormat,
  onEdit,
  onDelete,
}: {
  readonly items: readonly VendorCertificate[];
  readonly isLoading: boolean;
  readonly readOnly?: boolean;
  readonly masterMap: ReadonlyMap<string, Certification>;
  readonly dateFormat: string;
  readonly onEdit: (item: VendorCertificate) => void;
  readonly onDelete: (item: VendorCertificate) => void;
}) {
  const t = useTranslations("vendorManagement.vendor");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (items.length === 0)
    return (
      <VendorEmptySection
        compact={readOnly}
        icon={Award}
        title={t("noCertificates")}
        description={t("noCertificatesDesc")}
      />
    );

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-border/60 bg-card rounded-lg border p-3 text-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium break-words">
                {masterMap.get(item.master_certificate_id)?.name ?? ""}
              </div>
              <div className="text-muted-foreground break-all">
                {item.certificate_no}
              </div>
            </div>
            <StatusBadge active={!!item.is_active} className="shrink-0" />
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <dl className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
              <div>
                <dt className="text-muted-foreground">{tfl("issuedDate")}</dt>
                <dd>
                  {item.issued_date
                    ? formatDate(item.issued_date, dateFormat)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{tfl("expiryDate")}</dt>
                <dd className="flex flex-col">
                  {item.expiry_date ? (
                    <>
                      <span>{formatDate(item.expiry_date, dateFormat)}</span>
                      <ExpiryHint expiry={item.expiry_date} />
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            {!readOnly && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("edit")}
                  onClick={() => onEdit(item)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("delete")}
                  onClick={() => onDelete(item)}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
