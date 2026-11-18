import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { StatusChip } from "@/components/ui/status-chip";
import {
  actionColumn,
  auditColumns,
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { useProfile } from "@/hooks/use-profile";
import type { PriceList, PriceListStatus } from "@/types/price-list";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { PlPeriodCell } from "./pl-period-cell";

interface UsePriceListTableOptions {
  priceLists: PriceList[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (priceList: PriceList) => void;
  onVoid: (priceList: PriceList) => void;
  /** แท็บหมดช่วงแล้ว — ส่งต่อให้ PlPeriodCell */
  quietExpired?: boolean;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * ชื่อรับที่เหลือ (`meta.grow`) คอลัมน์อื่นกว้างคงที่ — เดิมแบ่งสัดส่วน ที่ tablet เลขที่ ช่วงวันที่
 * และชิปสถานะล้นเซลล์ ส่วนบน Full HD ชื่อกับผู้ขายกว้าง 364px ห่างจากค่าของมันเอง
 * ความกว้างขั้นต่ำของตาราง = ผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *   ครบ             55+48+130+180+200+200+120+60 = 993
 *   ไม่มีผู้ขาย                                    = 793
 *   ไม่มีชื่อ                                     = 613  (กล่องที่จอ 768 = 662)
 * `#` แสดงตลอดทุกขั้น (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน) — ไม่อยู่ในขั้นที่ซ่อน
 * ขั้นสุดท้ายเลขที่ (ลิงก์ของแถว) กลายเป็นคอลัมน์ยืดแทนชื่อ · จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 35px
 * ของที่ซ่อนยังเห็น: ผู้ขายลงบรรทัดรองใต้ชื่อ · ชื่อ (+ผู้ขาย) ลงบรรทัดรองใต้เลขที่
 * คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (created, updated) ไม่นับในงบ — เกินกล่องก็เลื่อนแนวนอนในกรอบเอง
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showVendor: w >= 1030,
    showName: w >= 830,
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

export function usePriceListTable({
  priceLists,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onVoid,
  quietExpired = false,
  containerWidth,
}: UsePriceListTableOptions) {
  "use no memo";
  const { dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const t = useTranslations("vendorManagement.priceList");
  const deleteGate = useDeleteGate();
  const { showVendor, showName } = columnTier(containerWidth);

  const dataColumns: ColumnDef<PriceList>[] = [
    {
      // id = ชื่อ column จริงของ backend (`pricelist_no`) เพื่อให้ sort ส่ง field ถูกต้อง;
      // response ส่งค่ามาใน field `no` (backend alias) จึงอ่านค่าจาก row.no
      id: "pricelist_no",
      accessorFn: (row) => row.no,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("no")} />
      ),
      // กล่องแคบสุด: ชื่อ (และผู้ขาย) ที่ถูกซ่อนลงมาเป็นบรรทัดรองใต้เลขที่
      cell: ({ row }) => (
        <div className="min-w-0">
          <CellAction
            onClick={() => onEdit(row.original)}
            className="whitespace-nowrap"
          >
            {row.original.no}
          </CellAction>
          {!showName &&
            subLine(
              [row.original.name, row.original.vendor?.name]
                .filter(Boolean)
                .join(" · "),
            )}
        </div>
      ),
      size: 130,
      meta: {
        headerTitle: tfl("no"),
        skeleton: columnSkeletons.textShort,
        grow: !showName,
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // กล่องกลาง: ผู้ขายที่ถูกซ่อนลงมาเป็นบรรทัดรองใต้ชื่อ
      cell: ({ row }) => (
        <div className="min-w-0">
          <span
            className="block truncate"
            title={row.original.name || undefined}
          >
            {row.original.name}
          </span>
          {!showVendor && subLine(row.original.vendor?.name ?? "")}
        </div>
      ),
      meta: {
        headerTitle: tfl("name"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
      size: 180,
    },
    {
      id: "vendor_name",
      accessorFn: (row) => row.vendor?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      cell: ({ row }) => {
        const name = row.original.vendor?.name;
        if (!name) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="block truncate" title={name}>
            {name}
          </span>
        );
      },
      meta: { headerTitle: tfl("vendor"), skeleton: columnSkeletons.text },
      size: 200,
    },
    {
      // id เป็นชื่อคอลัมน์จริงใน DB เพื่อให้ sort ฝั่ง server ได้ (เรียงช่วงเวลา = เรียงวันเริ่ม)
      id: "effective_from_date",
      accessorKey: "effectivePeriod",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("effectivePeriod")} />
      ),
      cell: ({ row }) => (
        <PlPeriodCell
          period={row.getValue("effective_from_date")}
          compact
          quietExpired={quietExpired}
        />
      ),
      meta: {
        headerTitle: tfl("effectivePeriod"),
        skeleton: columnSkeletons.text,
      },
      size: 200,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("status");
        return (
          <StatusChip
            status={status}
            // ป้ายมาจาก i18n ไม่ใช่ PL_STATUS_CONFIG ที่เป็นอังกฤษล้วน — หน้านี้มีไทย
            // อยู่แล้ว ไม่ถอยไปเป็นอังกฤษเพื่อให้เหมือน PR
            label={ts(status as PriceListStatus)}
          />
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
      },
    },
    ...auditColumns<PriceList>(tfl, dateTimeFormat),
  ];

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น · ตัดออกจากรายการเลย เมนู Toggle Columns ของผู้ใช้จึงไม่ถูกทับ
  const hidden = new Set([
    ...(showVendor ? [] : ["vendor_name"]),
    ...(showName ? [] : ["name"]),
  ]);
  const visibleDataColumns = dataColumns.filter((c) => {
    const key =
      c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
    return !key || !hidden.has(key);
  });

  const allColumns: ColumnDef<PriceList>[] = [
    selectColumn<PriceList>(),
    indexColumn<PriceList>(params),
    ...visibleDataColumns,
    actionColumn<PriceList>(onVoid, {
      ...deleteGate,
      deleteLabel: t("void"),
      deleteDisabledTitle: (r) =>
        r.status === "voided" ? t("alreadyVoided") : undefined,
      activity: { id: (r) => r.id, label: (r) => r.no },
    }),
  ];

  return useReactTable({
    data: priceLists,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
