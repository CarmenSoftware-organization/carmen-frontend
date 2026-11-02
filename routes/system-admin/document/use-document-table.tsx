import {
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  FileSpreadsheet,
  FileText,
  FileImage,
  File,
  FileArchive,
  FileCode,
} from "lucide-react";
import { Link } from "react-router";
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
import { documentReferenceLabel } from "./document-reference-labels";
import { documentReferenceHref } from "./document-reference-link";

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

const getFileTypeInfo = (contentType: string) => {
  if (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType.includes("csv")
  )
    return {
      icon: FileSpreadsheet,
      labelKey: "xls" as const,
      className: "text-green-600",
    };
  if (contentType.includes("pdf"))
    return {
      icon: FileText,
      labelKey: "pdf" as const,
      className: "text-red-500",
    };
  if (contentType.includes("image"))
    return {
      icon: FileImage,
      labelKey: "image" as const,
      className: "text-blue-500",
    };
  if (
    contentType.includes("zip") ||
    contentType.includes("rar") ||
    contentType.includes("compressed")
  )
    return {
      icon: FileArchive,
      labelKey: "archive" as const,
      className: "text-amber-500",
    };
  if (contentType.includes("text/plain"))
    return {
      icon: FileText,
      labelKey: "txt" as const,
      className: "text-gray-500",
    };
  if (contentType.includes("word") || contentType.includes("document"))
    return {
      icon: FileText,
      labelKey: "doc" as const,
      className: "text-blue-600",
    };
  if (
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("html")
  )
    return {
      icon: FileCode,
      labelKey: "code" as const,
      className: "text-purple-500",
    };
  return {
    icon: File,
    labelKey: "file" as const,
    className: "text-muted-foreground",
  };
};

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
  const tm = useTranslations("modules");
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
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${className}`} />
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
      cell: ({ row }) => formatFileSize(row.getValue("size")),
      size: 100,
    },
    {
      id: "reference",
      header: () => (
        <span className="text-xs font-medium">{t("attachedFrom")}</span>
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const doc = row.original;
        const type = doc.reference_type ?? null;
        // ตรวจ reference_type ก่อน: reference_exists เป็น null ทั้งตอนไม่มีที่มาและตอน lookup ล้มเหลว
        if (type == null) {
          return <span className="text-xs">{t("summary.directUpload")}</span>;
        }
        if (doc.reference_exists === false) {
          return (
            <span className="text-muted-foreground text-xs">
              {t("referenceDeleted")}
            </span>
          );
        }
        const moduleLabel = documentReferenceLabel(
          type,
          tm,
          t("summary.directUpload"),
        );
        const text = doc.reference_no
          ? `${moduleLabel} · ${doc.reference_no}`
          : moduleLabel;
        const href = documentReferenceHref(
          type,
          doc.reference_parent_id ?? null,
          doc.reference_id ?? null,
        );
        if (href) {
          return (
            <Link
              to={href}
              className="text-primary block max-w-64 truncate text-xs font-medium underline-offset-2 hover:underline"
              title={text}
            >
              {text}
            </Link>
          );
        }
        if (!doc.reference_id) {
          return (
            <span className="text-muted-foreground text-xs">
              {t("referenceUnknown")}
            </span>
          );
        }
        return (
          <span className="block max-w-64 truncate text-xs" title={text}>
            {text}
          </span>
        );
      },
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
        return at ? formatDate(at, dateFormat) : "—";
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
