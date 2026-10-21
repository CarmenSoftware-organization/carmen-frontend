import type { Column, ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/ui/data-grid/data-grid-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditCell } from "@/components/share/audit-cell";
import { SendBackStatus } from "@/components/share/sendback-status";
import { isSentBack } from "@/constant/last-action";
import type { RowWithLastAction } from "@/constant/last-action";
import type { Permission } from "@/constant/permissions";
import type { ParamsDto } from "@/types/params";
import type { AuditEntry } from "@/types/audit";

export const columnSkeletons = {
  checkbox: <Skeleton className="mx-auto h-2.5 w-2.5 rounded" />,
  number: <Skeleton className="h-2 w-5" />,
  text: <Skeleton className="h-2 w-3/4" />,
  textShort: <Skeleton className="h-2 w-1/2" />,
  badge: <Skeleton className="mx-auto h-3 w-12 rounded-full" />,
};

export function selectColumn<T>(): ColumnDef<T> {
  return {
    id: "select",
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => <DataGridTableRowSelect row={row} />,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 55,
    meta: {
      headerClassName: "text-center print:hidden",
      cellClassName: "text-center print:hidden",
      skeleton: columnSkeletons.checkbox,
    },
  };
}

export function indexColumn<T>(params: ParamsDto): ColumnDef<T> {
  return {
    id: "index",
    header: "#",
    cell: ({ row }) =>
      row.index +
      1 +
      ((Number(params.page) || 1) - 1) * (Number(params.perpage) || 10),
    enableSorting: false,
    enableHiding: false,
    size: 60,
    meta: {
      headerClassName: "text-center",
      cellClassName: "text-center",
      skeleton: columnSkeletons.checkbox,
    },
  };
}

function StatusColumnHeader<T>({ column }: { column: Column<T, unknown> }) {
  const tfl = useTranslations("field");
  return (
    <DataGridColumnHeader
      column={column}
      title={tfl("status")}
      className="justify-center"
    />
  );
}

type FieldTranslator = (key: "created" | "updated" | "status") => string;

// tfl ใช้แค่ตั้ง headerTitle — เมนูเลือกคอลัมน์/เรียงลำดับอ่านจาก meta ไม่ได้อ่าน header
// ไม่ส่งมาเมื่อไรเมนูจะโชว์ id ดิบ `is_active`
export function statusColumn<T>(tfl: FieldTranslator): ColumnDef<T> {
  return {
    accessorKey: "is_active",
    header: ({ column }) => <StatusColumnHeader<T> column={column} />,
    cell: ({ row }) => (
      <StatusBadge active={Boolean(row.getValue("is_active"))} />
    ),
    size: 100,
    meta: {
      cellClassName: "text-center",
      headerClassName: "text-center",
      headerTitle: tfl("status"),
      skeleton: columnSkeletons.badge,
    },
  };
}

export interface ActionColumnActivity<T> {
  id: (row: T) => string | undefined;
  label?: (row: T) => string | undefined;
}

/**
 * เมนู Edit ในแถว (อยู่บนสุดของเมนู ⋯) — ไม่ส่ง = ไม่มีเมนูนี้ ตารางเดิมจึงเหมือนเดิมทุกตัว
 * ผู้เรียกคุมสิทธิ์เอง (ไม่มีสิทธิ์ = ไม่ส่ง) · สัญญาหมดอายุปิดเมนูให้ผ่าน `writeDisabled`
 */
export interface ActionColumnEdit<T> {
  onClick: (item: T) => void;
}

export function actionColumn<T>(
  onDelete: (item: T) => void,
  options?: {
    deleteDenied?: boolean;
    deletePermission?: Permission;
    writeDisabled?: boolean;
    writeDisabledTitle?: string;
    /** คืนเหตุผลเมื่อแถวนี้ลบไม่ได้ (ปุ่มลบปิด + title) · คืน undefined = ลบได้ */
    deleteDisabledTitle?: (item: T) => string | undefined;
    /** ข้อความเมนูลบแทน "ลบ" (เช่น void) — ไม่ส่ง = เดิม */
    deleteLabel?: string;
    activity?: ActionColumnActivity<T>;
    edit?: ActionColumnEdit<T>;
  },
): ColumnDef<T> {
  return {
    id: "action",
    header: () => "",
    cell: ({ row }) => {
      const activityId = options?.activity?.id(row.original);
      const edit = options?.edit;
      return (
        <DataGridRowActions
          onEdit={edit ? () => edit.onClick(row.original) : undefined}
          onDelete={() => onDelete(row.original)}
          deleteDenied={options?.deleteDenied}
          deletePermission={options?.deletePermission}
          writeDisabled={options?.writeDisabled}
          writeDisabledTitle={options?.writeDisabledTitle}
          deleteDisabledTitle={options?.deleteDisabledTitle?.(row.original)}
          deleteLabel={options?.deleteLabel}
          activity={
            activityId
              ? {
                  id: activityId,
                  label: options?.activity?.label?.(row.original),
                }
              : undefined
          }
        />
      );
    },
    enableSorting: false,
    size: 60,
    meta: {
      headerClassName: "text-right print:hidden",
      cellClassName: "text-right print:hidden",
      skeleton: null,
    },
  };
}

interface RowWithAudit {
  audit?: { created?: AuditEntry; updated?: AuditEntry };
}

export function auditColumns<T extends RowWithAudit>(
  tfl: FieldTranslator,
  dateTimeFormat: string,
  options?: { size?: number },
): ColumnDef<T>[] {
  const size = options?.size ?? 160;

  return (["created", "updated"] as const).map((which) => ({
    id: `${which}_at`,
    accessorFn: (row: T) => row.audit?.[which]?.at ?? "",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={tfl(which)} />
    ),
    cell: ({ row }) => (
      <AuditCell
        entry={row.original.audit?.[which]}
        dateTimeFormat={dateTimeFormat}
      />
    ),
    size,
    meta: { headerTitle: tfl(which), skeleton: columnSkeletons.text },
  }));
}

export function sendbackColumn<T extends RowWithLastAction>(
  title: string,
  options?: { size?: number },
): ColumnDef<T> {
  return {
    id: "last_action",
    // accessorFn คืนข้อความ ไม่ใช่ boolean — column visibility menu กับการคัดลอก
    // ค่าจากตารางจะได้อ่านรู้เรื่อง ไม่ใช่ "true"/"false"
    accessorFn: (row: T) => (isSentBack(row.last_action) ? title : ""),
    header: ({ column }) => (
      <DataGridColumnHeader
        column={column}
        title={title}
        className="justify-center"
      />
    ),
    cell: ({ row }) => (
      <SendBackStatus
        lastAction={row.original.last_action}
        // คอลัมน์นี้จัดกลาง — ป้ายเป็น inline-flex ซึ่ง `text-center` ของเซลล์
        // เอื้อมไม่ถึงเมื่ออยู่ในกล่อง clamp ของ DataGrid (ท่าเดียวกับคอลัมน์สถานะ)
        className="flex w-full justify-center"
      />
    ),
    size: options?.size ?? 110,
    meta: {
      headerTitle: title,
      skeleton: columnSkeletons.badge,
      cellClassName: "text-center",
      headerClassName: "text-center",
    },
  };
}

export function customActionColumn<T>(
  cell: NonNullable<ColumnDef<T>["cell"]>,
): ColumnDef<T> {
  return {
    id: "action",
    header: () => "",
    cell,
    enableSorting: false,
    size: 60,
    meta: {
      headerClassName: "text-right print:hidden",
      cellClassName: "text-right print:hidden",
      skeleton: null,
    },
  };
}
