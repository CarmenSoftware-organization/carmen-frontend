import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import type {
  InventoryPeriod,
  InventoryPeriodStatus,
} from "@/types/inventory-period";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import { StatusChip } from "@/components/ui/status-chip";
import { INVENTORY_PERIOD_STATUS_CONFIG } from "@/constant/inventory-period";
import { getInventoryPeriodPhase } from "./inventory-period-phase";

interface UseInventoryPeriodTableOptions {
  periods: InventoryPeriod[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  /** id ของรอบปัจจุบันจาก `useProfile().currentPeriod` */
  currentPeriodId?: string;
  /** วันนี้ `YYYY-MM-DD` ใช้ตัดสินว่ารอบไหนค้างปิด */
  today: string;
}

export function useInventoryPeriodTable({
  periods,
  totalRecords,
  params,
  tableConfig,
  currentPeriodId,
  today,
}: UseInventoryPeriodTableOptions) {
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const { dateFormat } = useProfile();

  const columns: ColumnDef<InventoryPeriod>[] = [
    {
      accessorKey: "period",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("period")} />
      ),
      cell: ({ row }) => {
        const p = row.original;
        const isCurrent = p.id === currentPeriodId;
        const isOverdue = getInventoryPeriodPhase(p, today) === "overdue";
        return (
          // data-slot = หลุดจาก line-clamp ของ DataGrid ซึ่งตั้งลูกเป็น -webkit-box
          // จน flex/gap หาย (data-grid-table.tsx ตัวครอบ clamp)
          <div data-slot="period-cell" className="flex items-center gap-2">
            <span className="tabular-nums">{p.period}</span>
            {isCurrent && (
              <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                {t("current")}
              </span>
            )}
            {isOverdue && (
              <span className="text-warning-ink inline-flex items-center gap-1 text-xs font-medium">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {t("overdue")}
              </span>
            )}
          </div>
        );
      },
      size: 240,
    },
    {
      // ปี/เดือนบัญชีซ้ำกับรหัสรอบ (`2026-05`) จึงไม่มีคอลัมน์ของตัวเอง — ยังอยู่ใน
      // export ครบ ส่วนช่วงวันที่รวมเป็นคอลัมน์เดียว sort ตาม start_at
      accessorKey: "start_at",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("dateRange")} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatDate(row.original.start_at, dateFormat)}
          <span className="text-muted-foreground px-1.5">–</span>
          {formatDate(row.original.end_at, dateFormat)}
        </span>
      ),
      // 195 ไม่ใช่ 220: คอลัมน์สถานะ (grow) กว้างขั้นต่ำ ~165px ที่จอ tablet (เนื้อที่ตาราง 662px)
      // 60 + 240 + 195 + 165 = 660 พอดี ถ้ากว้างกว่านี้ตารางล้นแนวนอน
      size: 195,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("status")} />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as InventoryPeriodStatus;
        const config =
          INVENTORY_PERIOD_STATUS_CONFIG[status] ??
          INVENTORY_PERIOD_STATUS_CONFIG.open;
        return <StatusChip status={status} label={config.label} />;
      },
      size: 110,
      // คอลัมน์สุดท้ายรับความกว้างที่เหลือ — `meta.grow` ทำให้สองคอลัมน์ข้างหน้ากว้างคงที่ตาม
      // `size` ตารางนี้มีข้อมูลแค่ 3 คอลัมน์สั้น ๆ ถ้าปล่อยแบ่งตามสัดส่วน บนจอกว้างรหัสรอบ
      // ช่วงวันที่ และสถานะจะห่างกันเป็นคืบ (จอ 4K ห่างกันราว 1,300px) เนื้อหาชิดซ้ายจึงยัง
      // อยู่ติดช่วงวันที่ (skill carmen-blue-ui-design ข้อ 2)
      // ลองคอลัมน์ว่างต่อท้ายแล้วไม่ได้: มันกว้างขั้นต่ำ 75px ตารางจึงล้นบนจอ tablet
      meta: { grow: true },
    },
  ];

  return useConfigTable<InventoryPeriod>({
    data: periods,
    columns,
    totalRecords,
    params,
    tableConfig,
    hideStatus: true,
  });
}
