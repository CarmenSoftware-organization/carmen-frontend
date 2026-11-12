import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { ActivityActionLabel } from "../shared/activity-action-label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getLogCreatedAt, type ActivityLog } from "@/types/activity-log";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

function formatEntityType(value: string): string {
  if (!value) return "";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface UseActivityLogTableOptions {
  logs: ActivityLog[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * คอลัมน์สั้นกว้างคงที่ Description (ข้อความยาวตัวเดียวของตาราง) รับที่เหลือ (`meta.grow`)
 * ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *
 * - ครบ: 55+60+110+100+170+140+220+90+125 = 1070
 * - ไม่มี Record ID: 980
 * - ไม่มี Record ID และ IP Address: 855
 * - ไม่มี Record ID, IP Address และ Description (User ยืดแทน ขั้นต่ำ 170): 635
 *   (กล่องที่จอ 768 = 662)
 *
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวมโดยตั้งใจ ให้ Description ได้ที่ราว 230–245px ก่อนคอลัมน์รองจะ
 * กลับมา · Record ID ซ่อนก่อนเพราะโชว์ได้แค่ 8 ตัวแรกของ uuid · Description ซ่อนที่ขั้นแคบสุด
 * เพราะเนื้อหาส่วนใหญ่ซ้ำกับ Action + Record Type ("update on tb_…")
 * คอลัมน์ที่ซ่อนถูกถอดออกจากรายการคอลัมน์ ไม่ใช่ปิดผ่าน columnVisibility เพราะสถานะนั้นเป็นของ
 * เมนู Toggle Columns ของผู้ใช้ · ของที่ซ่อนยังดูได้: คลิกแถวเปิดแผงรายละเอียด
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showRecordId: w >= 1080,
    showIpAddress: w >= 1000,
    showDescription: w >= 880,
  };
}

export function useActivityLogTable({
  logs,
  totalRecords,
  params,
  tableConfig,
  containerWidth,
}: UseActivityLogTableOptions) {
  "use no memo";
  const t = useTranslations("systemAdmin.activityLog");
  const { dateFormat } = useProfile();
  const { showRecordId, showIpAddress, showDescription } =
    columnTier(containerWidth);

  const columns: ColumnDef<ActivityLog>[] = [
    {
      id: "created_at",
      accessorFn: (row) => getLogCreatedAt(row),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("timestamp")} />
      ),
      cell: ({ row }) => {
        const iso: string = row.getValue("created_at");
        const date = formatDate(iso, dateFormat);
        const time = formatDate(iso, "HH:mm:ss");
        return (
          <div className="leading-tight whitespace-nowrap tabular-nums">
            <p className="text-xs">{date}</p>
            <p className="text-muted-foreground text-micro">{time}</p>
          </div>
        );
      },
      meta: { headerTitle: t("timestamp") },
      size: 110,
    },
    {
      accessorKey: "action",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("action")} />
      ),
      cell: ({ row }) => (
        <ActivityActionLabel action={row.getValue("action")} />
      ),
      meta: { headerTitle: t("action") },
      size: 100,
    },
    {
      id: "actor_user",
      accessorFn: (row) => {
        const parts = [
          row.actor_firstname,
          row.actor_middlename,
          row.actor_lastname,
        ].filter(Boolean);
        return parts.length > 0
          ? parts.join(" ")
          : (row.actor_username ?? row.actor_id ?? "");
      },
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("user")} />
      ),
      cell: ({ row }) => {
        const fullName = row.getValue("actor_user") as string;
        const username = row.original.actor_username;
        return (
          // data-slot: ไม่งั้น wrapper ของ DataGridTable ใส่ line-clamp-2 ทับ แล้วสองบรรทัดนี้
          // (ชื่อ + username) จะตัดกลางคำแทนที่จะตัดท้ายบรรทัดด้วย …
          <div data-slot="cell-stack" className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold" title={fullName}>
              {fullName || "—"}
            </p>
            {username && fullName !== username && (
              <p
                className="text-muted-foreground text-micro truncate"
                title={username}
              >
                {username}
              </p>
            )}
          </div>
        );
      },
      // กล่องแคบสุดไม่มี Description — User เป็นตัวรับที่เหลือแทน
      meta: { headerTitle: t("user"), grow: !showDescription },
      size: 170,
    },
    {
      accessorKey: "entity_type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("entityType")} />
      ),
      cell: ({ row }) => (
        <span className="text-xs">
          {formatEntityType(row.getValue("entity_type")) || "—"}
        </span>
      ),
      meta: { headerTitle: t("entityType") },
      size: 140,
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("description")} />
      ),
      cell: ({ row }) => {
        const desc: string = row.getValue("description") ?? "";
        return (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground block cursor-default truncate text-xs">
                {desc || "—"}
              </span>
            </TooltipTrigger>
            {desc.length > 40 && (
              <TooltipContent side="top" className="max-w-[20rem]">
                <p className="text-xs leading-snug">{desc}</p>
              </TooltipContent>
            )}
          </Tooltip>
        );
      },
      // ตัดตามความกว้างจริงของคอลัมน์ ไม่ใช่ที่ 18rem ตายตัว — `size` คือขั้นต่ำ
      meta: { headerTitle: t("description"), grow: true },
      size: 220,
    },
    {
      accessorKey: "entity_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("entityId")} />
      ),
      cell: ({ row }) => {
        const id: string = row.getValue("entity_id") ?? "";
        return (
          <span className="text-muted-foreground text-micro block truncate">
            {id ? `${id.slice(0, 8)}…` : "—"}
          </span>
        );
      },
      meta: { headerTitle: t("entityId") },
      size: 90,
    },
    {
      accessorKey: "ip_address",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("ipAddress")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-micro">
          {row.getValue("ip_address") || "—"}
        </span>
      ),
      meta: { headerTitle: t("ipAddress") },
      size: 125,
    },
  ];

  const hidden = new Set<string>();
  if (!showRecordId) hidden.add("entity_id");
  if (!showIpAddress) hidden.add("ip_address");
  if (!showDescription) hidden.add("description");
  const visibleColumns = columns.filter((c) => {
    const key = "accessorKey" in c ? String(c.accessorKey) : c.id;
    return !key || !hidden.has(key);
  });

  return useConfigTable<ActivityLog>({
    data: logs,
    columns: visibleColumns,
    totalRecords,
    params,
    tableConfig,
    hideStatus: true,
  });
}
