import { Link } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import type { NotificationTemplate } from "@/types/noti-tmpl";
import { TemplateText } from "./noti-tmpl-preview";

interface UseNotiTmplTableOptions {
  readonly data: NotificationTemplate[];
  readonly totalRecords: number;
  readonly params: ParamsDto;
  readonly tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
}

export function useNotiTmplTable({
  data,
  totalRecords,
  params,
  tableConfig,
}: UseNotiTmplTableOptions) {
  const t = useTranslations("systemAdmin.notificationTemplate");

  const columns: ColumnDef<NotificationTemplate>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("colName")} />
      ),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <Link
            to={`/system-admin/notification-template/${row.original.id}`}
            state={listReturnState().state}
            className="focus-visible:ring-ring/50 text-primary font-semibold hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {row.original.name || "..."}
          </Link>
          {row.original.code && (
            <Badge variant="secondary" size="xs">
              {t("systemDefault")}
            </Badge>
          )}
        </span>
      ),
      meta: { headerTitle: t("colName"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "body",
      enableSorting: false,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("colMessage")} />
      ),
      // เดิมคอลัมน์นี้คือ Subject ซึ่งว่างทุกแถวของช่องทางแอป (หัวเรื่องเป็นของ
      // อีเมลที่เลิกใช้แล้ว) — เนื้อหาข้อความคือสิ่งที่คนมาหน้านี้ตามหาจริง
      cell: ({ row }) => (
        <span className="text-muted-foreground block max-w-[36rem]">
          <TemplateText text={row.original.body || "—"} />
        </span>
      ),
      meta: { headerTitle: t("colMessage"), skeleton: columnSkeletons.text },
    },
  ];

  return useConfigTable<NotificationTemplate>({
    data,
    columns,
    totalRecords,
    params,
    tableConfig,
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
