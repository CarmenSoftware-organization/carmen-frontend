import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { ActivityActionLabel } from "../shared/activity-action-label";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getLogCreatedAt, type ActivityLog } from "@/types/activity-log";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseUserActivityTableOptions {
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
 * คอลัมน์สั้นกว้างคงที่ คอลัมน์ข้อความยาวตัวสุดท้ายรับที่เหลือ (`meta.grow`) ตารางจึงกว้างขั้นต่ำ
 * เท่าผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *
 * - ครบ (User Agent ยืด): 55+60+110+95+190+260+130+160 = 1060
 * - ไม่มี Description (User Agent ยืด): 800
 * - ไม่มี Description และ User Agent (User ยืด ขั้นต่ำ 170): 620 (กล่องที่จอ 768 = 662)
 *
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวมโดยตั้งใจ ให้คอลัมน์ที่ยืดได้ที่พอก่อนคอลัมน์รองจะกลับมา
 * Description ซ่อนก่อนเพราะซ้ำกับ Action + User ("User x logged in") · คอลัมน์ที่ซ่อนถูกถอดออกจาก
 * รายการคอลัมน์ ไม่ใช่ปิดผ่าน columnVisibility เพราะสถานะนั้นเป็นของเมนู Toggle Columns ของผู้ใช้
 * ของที่ซ่อนยังดูได้: คลิกแถวเปิดแผงรายละเอียด
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return { showDescription: w >= 1080, showUserAgent: w >= 860 };
}

export function useUserActivityTable({
  logs,
  totalRecords,
  params,
  tableConfig,
  containerWidth,
}: UseUserActivityTableOptions) {
  "use no memo";
  const t = useTranslations("systemAdmin.userActivity");
  const { dateFormat } = useProfile();
  const { showDescription, showUserAgent } = columnTier(containerWidth);

  const descriptionColumn: ColumnDef<ActivityLog> = {
    accessorKey: "description",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={t("description")} />
    ),
    cell: ({ row }) => {
      const desc: string = row.getValue("description") ?? "";
      return (
        <span
          className="text-muted-foreground block truncate text-xs"
          title={desc || undefined}
        >
          {desc || "—"}
        </span>
      );
    },
    meta: { headerTitle: t("description") },
    size: 260,
  };

  const userAgentColumn: ColumnDef<ActivityLog> = {
    accessorKey: "user_agent",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={t("userAgent")} />
    ),
    cell: ({ row }) => {
      const ua: string | null = row.original.user_agent;
      return (
        <span
          className="text-muted-foreground text-micro block truncate"
          title={ua || undefined}
        >
          {ua || "—"}
        </span>
      );
    },
    // คอลัมน์ข้อความยาวตัวสุดท้าย รับความกว้างที่เหลือ — `size` คือขั้นต่ำ
    meta: { headerTitle: t("userAgent"), grow: true },
    size: 160,
  };

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
      size: 95,
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
      // กล่องแคบไม่มี User Agent — User เป็นตัวรับที่เหลือแทน (ขั้นต่ำ 170)
      meta: { headerTitle: t("user"), grow: !showUserAgent },
      size: showUserAgent ? 190 : 170,
    },
    ...(showDescription ? [descriptionColumn] : []),
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
      size: 130,
    },
    ...(showUserAgent ? [userAgentColumn] : []),
  ];

  return useConfigTable<ActivityLog>({
    data: logs,
    columns,
    totalRecords,
    params,
    tableConfig,
    hideStatus: true,
  });
}
