import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { Certification } from "@/types/certification";
import { CertificationHoldings } from "./certification-holdings";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseCertificationTableOptions {
  data: Certification[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (certification: Certification) => void;
  onDelete: (certification: Certification) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * คำอธิบายรับที่เหลือ (`meta.grow`) คอลัมน์อื่นกว้างคงที่ — เดิมแบ่งสัดส่วน ที่ tablet ชิปสถานะ
 * ถูกบีบเหลือ 34px ส่วนบน Full HD คำอธิบายกว้าง 486px ห่างจากค่าอื่น
 * ความกว้างขั้นต่ำของตาราง = ผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *   ครบ             55+48+110+200+180+200+100+60 = 953
 *   ไม่มีคำอธิบาย                                 = 773  (ชื่อยืดแทน)
 *   ไม่มีชื่อ                                     = 573  (รหัสยืดแทน · กล่องที่จอ 768 = 662)
 * `#` แสดงตลอดทุกขั้น (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน) — ไม่อยู่ในขั้นที่ซ่อน
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 35px
 * ของที่ซ่อนยังเห็น: คำอธิบายลงบรรทัดรองใต้ชื่อ · ชื่อ (+คำอธิบาย) ลงบรรทัดรองใต้รหัส
 * คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (created, updated) ไม่นับในงบ — เกินกล่องก็เลื่อนแนวนอนในกรอบเอง
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showDescription: w >= 990,
    showName: w >= 810,
  };
}

/** บรรทัดรองสีจางใต้ค่าหลักของเซลล์ — ใช้แทนคอลัมน์ที่ถูกซ่อน */
function subLine(text: string) {
  if (!text) return null;
  return (
    <span className="text-muted-foreground block truncate text-xs" title={text}>
      {text}
    </span>
  );
}

export function useCertificationTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseCertificationTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const t = useTranslations("vendorManagement.certification");
  const { dateTimeFormat } = useProfile();
  const { showDescription, showName } = columnTier(containerWidth);
  const columns: ColumnDef<Certification>[] = [
    {
      accessorKey: "code",
      size: 110,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      // กล่องแคบสุด: ชื่อ (และคำอธิบาย) ที่ถูกซ่อนลงมาเป็นบรรทัดรองใต้รหัส
      cell: ({ row }) => (
        <div className="min-w-0">
          <CellAction onClick={() => onEdit(row.original)}>
            {row.getValue("code")}
          </CellAction>
          {!showName &&
            subLine(
              [row.original.name, row.original.description]
                .filter(Boolean)
                .join(" · "),
            )}
        </div>
      ),
      meta: {
        headerTitle: tfl("code"),
        skeleton: columnSkeletons.text,
        grow: !showName,
      },
    },
    {
      accessorKey: "name",
      size: 200,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // กล่องกลาง: คำอธิบายที่ถูกซ่อนลงมาเป็นบรรทัดรองใต้ชื่อ
      cell: ({ row }) => (
        <div className="min-w-0">
          <span
            className="block truncate"
            title={row.original.name || undefined}
          >
            {row.original.name || "..."}
          </span>
          {!showDescription && subLine(row.original.description ?? "")}
        </div>
      ),
      meta: {
        headerTitle: tfl("name"),
        skeleton: columnSkeletons.text,
        grow: !showDescription,
      },
    },
    {
      accessorKey: "description",
      size: 180,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      // ข้อความยาวรับที่ว่างที่เหลือ — คอลัมน์สั้นจึงอยู่ชิดกันบนจอกว้าง
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description || "—"}
        </span>
      ),
      enableSorting: false,
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      // นับฝั่ง server ต่อหน้า ไม่ใช่คอลัมน์ใน DB จึงเรียงไม่ได้
      id: "vendor_count",
      size: 200,
      accessorFn: (row) => row.vendor_count,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("vendorsHolding")} />
      ),
      cell: ({ row }) => <CertificationHoldings item={row.original} />,
      enableSorting: false,
      meta: {
        headerTitle: t("vendorsHolding"),
        skeleton: columnSkeletons.textShort,
      },
    },
    statusColumn<Certification>(tfl),
    ...auditColumns<Certification>(tfl, dateTimeFormat),
  ];

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น · ตัดออกจากรายการเลย เมนู Toggle Columns ของผู้ใช้จึงไม่ถูกทับ
  const hidden = new Set([
    ...(showDescription ? [] : ["description"]),
    ...(showName ? [] : ["name"]),
  ]);
  const visibleColumns = columns.filter((c) => {
    const key =
      c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
    return !key || !hidden.has(key);
  });

  return useConfigTable<Certification>({
    data,
    columns: visibleColumns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
  });
}
