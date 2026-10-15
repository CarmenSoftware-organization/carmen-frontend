import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { Badge } from "@/components/ui/badge";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { Vendor } from "@/types/vendor";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

// list API ส่ง `contacts` — `tb_vendor_contact` เป็นชื่อเก่า เก็บ fallback ไว้
function primaryContactOf(vendor: Vendor) {
  const contacts = vendor.contacts ?? vendor.tb_vendor_contact ?? [];
  return contacts.find((c) => c.is_primary) ?? contacts[0];
}

interface UseVendorTableOptions {
  vendors: Vendor[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}

export function useVendorTable({
  vendors,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseVendorTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<Vendor>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction
          onClick={() => onEdit(row.original)}
          className="whitespace-nowrap"
        >
          {row.original.code}
        </CellAction>
      ),
      size: 90,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.name || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
      size: 200,
    },

    {
      id: "business_type_names",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("businessType")} />
      ),
      accessorFn: (row) =>
        row.business_type?.map((bt) => bt.name).join(", ") ?? "",
      cell: ({ row }) => {
        const types = row.original.business_type ?? [];
        if (types.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        // แถวเดียวเสมอ: ป้ายแรก + "+N" — รายชื่อเต็มอยู่ใน title
        const [first, ...rest] = types;
        return (
          <div
            className="flex min-w-0 items-center gap-1"
            title={types.map((bt) => bt.name).join(", ")}
          >
            <Badge variant="outline" className="min-w-0 truncate">
              {first.name}
            </Badge>
            {rest.length > 0 && (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                +{rest.length}
              </span>
            )}
          </div>
        );
      },
      size: 170,
      enableSorting: false,
      meta: {
        headerTitle: tfl("businessType"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      // ผู้ติดต่อหลัก + เบอร์ ซ้อนในเซลล์เดียว — จัดซื้อเปิดหน้านี้เพื่อหาว่าจะโทรหาใคร
      id: "primary_contact",
      accessorFn: (row) => primaryContactOf(row)?.name ?? "",
      header: tfl("contact"),
      cell: ({ row }) => {
        const contact = primaryContactOf(row.original);
        if (!contact?.name && !contact?.phone) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="min-w-0">
            <span className="block truncate" title={contact.name || undefined}>
              {contact.name || "—"}
            </span>
            {contact.phone && (
              <span className="text-muted-foreground block truncate text-xs tabular-nums">
                {contact.phone}
              </span>
            )}
          </div>
        );
      },
      size: 200,
      enableSorting: false,
      meta: { headerTitle: tfl("contact"), skeleton: columnSkeletons.text },
    },
    {
      // ซ่อนเป็นค่าเริ่มต้น เปิดได้จากเมนูคอลัมน์ — ไม่เรียงเพราะเป็นชื่อจาก relation
      id: "credit_term",
      accessorFn: (row) => row.credit_term_name ?? "",
      header: tfl("creditTerm"),
      cell: ({ row }) => {
        const { credit_term_name: name, credit_term_days: days } = row.original;
        if (!name && days == null) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="block truncate whitespace-nowrap tabular-nums">
            {name || days}
          </span>
        );
      },
      size: 130,
      enableSorting: false,
      meta: { headerTitle: tfl("creditTerm"), skeleton: columnSkeletons.text },
    },
    // status column แทรกเองก่อน created/updated (useConfigTable ส่ง hideStatus)
    statusColumn<Vendor>(),
    ...auditColumns<Vendor>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Vendor>({
    data: vendors,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    // คอลัมน์ audit ซ่อนเป็น default (เปิดได้จากเมนู Toggle Columns)
    initialState: {
      columnVisibility: {
        credit_term: false,
        created_at: false,
        updated_at: false,
      },
    },
    activity: { id: (r) => r.id, label: (r) => r.code },
  });
}
