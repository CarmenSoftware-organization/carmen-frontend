import {
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import {
  selectColumn,
  indexColumn,
  actionColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import type { DocumentFile } from "@/types/document";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatFileSize } from "@/lib/format-file-size";
import { DocumentReference } from "./document-reference";
import { getFileTypeInfo } from "./document-file-type";

interface UseDocumentTableOptions {
  documents: DocumentFile[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onDelete: (doc: DocumentFile) => void;
  /** เลือกแถว — key ด้วย fileToken เพื่อให้การเลือกข้ามหน้าได้ */
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

export function useDocumentTable({
  documents,
  totalRecords,
  params,
  tableConfig,
  onDelete,
  rowSelection,
  onRowSelectionChange,
}: UseDocumentTableOptions) {
  "use no memo";

  const { dateFormat } = useProfile();
  const t = useTranslations("systemAdmin.document");
  const tfl = useTranslations("field");
  const deleteGate = useDeleteGate();

  const columns: ColumnDef<DocumentFile>[] = [
    selectColumn<DocumentFile>(),
    indexColumn<DocumentFile>(params),
    {
      accessorKey: "originalName",
      enableSorting: false,
      header: () => (
        <span className="text-xs font-medium">{tfl("fileName")}</span>
      ),
      cell: ({ row }) => (
        <span
          className="block max-w-100 truncate text-xs font-semibold"
          title={row.getValue("originalName")}
        >
          {row.getValue("originalName")}
        </span>
      ),
      size: 300,
    },
    {
      accessorKey: "contentType",
      enableSorting: false,
      header: () => <span className="text-xs font-medium">{tfl("type")}</span>,
      cell: ({ row }) => {
        const contentType: string = row.getValue("contentType");
        const {
          icon: Icon,
          labelKey,
          className,
        } = getFileTypeInfo(contentType);
        return (
          // data-slot: ไม่งั้น wrapper ของ DataGridTable ใส่ line-clamp-2 ทับ flex → ไอคอนตกไปอยู่บนบรรทัดแยก
          <div data-slot="cell-icon" className="flex items-center gap-1.5">
            <Icon className={`size-3.5 shrink-0 ${className}`} />
            <span className="text-xs">{t(labelKey)}</span>
          </div>
        );
      },
      size: 110,
    },
    {
      accessorKey: "size",
      enableSorting: false,
      header: () => <span className="text-xs font-medium">{tfl("size")}</span>,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatFileSize(row.getValue("size"))}
        </span>
      ),
      size: 100,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "reference",
      header: () => (
        <span className="text-xs font-medium">{t("attachedFrom")}</span>
      ),
      enableSorting: false,
      cell: ({ row }) => <DocumentReference doc={row.original} />,
      size: 220,
    },
    {
      id: "uploader",
      header: () => (
        <span className="text-xs font-medium">{t("uploadedBy")}</span>
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.audit?.created?.name || "—"}
        </span>
      ),
      size: 150,
    },
    {
      id: "createdAt",
      // วันที่อัปโหลดจริงอยู่ที่ audit.created.at (lastModified ของ storage เปลี่ยนตามการเขียนทับ)
      // ปิด sort: ยังไม่ยืนยันว่า backend รับ sort key นี้
      enableSorting: false,
      header: () => (
        <span className="text-xs font-medium">{t("uploadedAt")}</span>
      ),
      cell: ({ row }) => {
        const at = row.original.audit?.created?.at ?? row.original.lastModified;
        return (
          <span className="text-xs tabular-nums">
            {at ? formatDate(at, dateFormat) : "—"}
          </span>
        );
      },
      size: 120,
    },
    actionColumn<DocumentFile>(onDelete, deleteGate),
  ];

  return useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    getRowId: (row) => row.fileToken,
    enableRowSelection: true,
    onRowSelectionChange,
    state: { ...tableConfig.state, rowSelection },
    pageCount: Math.ceil(totalRecords / (params.perpage as number)),
  });
}
