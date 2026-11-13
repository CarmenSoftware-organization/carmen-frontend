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
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
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
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * คอลัมน์สั้นกว้างคงที่ ชื่อไฟล์รับที่เหลือ (`meta.grow`) ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`:
 * ครบ 980 · ไม่มีผู้อัปโหลด 840 · ไม่มีชนิด 740 · ไม่มีเลขลำดับและ "แนบมาจาก" เหลือ 160 = 640
 * (กล่องที่จอ 768 = 662) จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวมนั้นโดยตั้งใจ — คอลัมน์รองกลับมาเมื่อ
 * ชื่อไฟล์ได้ที่ราว 230–250px แล้วเท่านั้น ไม่งั้นพอข้ามขั้นชื่อไฟล์จะหดเหลือขั้นต่ำ 170px
 * ของที่ซ่อนยังดูได้: ชนิด = ไอคอนหน้าชื่อไฟล์ · ผู้อัปโหลด = มุมมอง preview
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showUploader: w >= 1060,
    showType: w >= 890,
    showIndex: w >= 800,
  };
}

export function useDocumentTable({
  documents,
  totalRecords,
  params,
  tableConfig,
  onDelete,
  rowSelection,
  onRowSelectionChange,
  containerWidth,
}: UseDocumentTableOptions) {
  "use no memo";

  const { dateFormat } = useProfile();
  const t = useTranslations("systemAdmin.document");
  const tfl = useTranslations("field");
  const deleteGate = useDeleteGate();
  const { showUploader, showType, showIndex } = columnTier(containerWidth);

  const columns: ColumnDef<DocumentFile>[] = [
    selectColumn<DocumentFile>(),
    indexColumn<DocumentFile>(params),
    {
      accessorKey: "originalName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("fileName")} />
      ),
      cell: ({ row }) => {
        const name: string = row.getValue("originalName");
        const { icon: Icon, className } = getFileTypeInfo(
          row.original.contentType,
        );
        return (
          // data-slot: ไม่งั้น wrapper ของ DataGridTable ใส่ line-clamp-2 ทับ flex
          <div
            data-slot="cell-icon"
            className="flex min-w-0 items-center gap-1.5"
          >
            {/* คอลัมน์ชนิดถูกซ่อนบนกล่องแคบ — ไอคอนชนิดย้ายมาอยู่หน้าชื่อแทน */}
            {!showType && (
              <Icon className={`size-3.5 shrink-0 ${className}`} aria-hidden />
            )}
            <span className="truncate text-xs font-semibold" title={name}>
              {name}
            </span>
          </div>
        );
      },
      // คอลัมน์ข้อความยาวตัวเดียวของตาราง รับความกว้างที่เหลือ — `size` คือขั้นต่ำ
      // ชื่อตัดตามความกว้างจริงของคอลัมน์ ไม่ใช่ที่ 25rem ตายตัว
      size: 170,
      meta: { grow: true },
    },
    {
      accessorKey: "contentType",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
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
      size: 100,
    },
    {
      accessorKey: "size",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("size")} />
      ),
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatFileSize(row.getValue("size"))}
        </span>
      ),
      size: 85,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "reference",
      // คอลัมน์ที่มีแค่ id (ไม่มี accessor) TanStack ปิด sort ให้เอง — ต้องมี accessorFn หัวคอลัมน์จึงกดเรียงได้
      accessorFn: (row) => row.reference_type ?? "",
      // เรียงตาม reference_type (คีย์ดิบ) ฝั่ง server ไม่ใช่ชื่อโมดูลที่แปลแล้ว — กลุ่มเดียวกันอยู่ติดกัน
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("attachedFrom")} />
      ),
      // max-w-full: ตัดตามความกว้างคอลัมน์ ไม่ใช่ที่ 16rem ของค่าเริ่มต้น
      cell: ({ row }) => (
        <DocumentReference doc={row.original} className="max-w-full" />
      ),
      size: showIndex ? 200 : 160,
    },
    {
      id: "uploader",
      header: () => (
        <span className="text-xs font-medium">{t("uploadedBy")}</span>
      ),
      // ชื่อผู้อัปโหลดอยู่นอก tb_file_tag (gateway เติมให้ทีหลัง) server จึงเรียงไม่ได้
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.audit?.created?.name || "—"}
        </span>
      ),
      size: 140,
    },
    {
      id: "createdAt",
      accessorFn: (row) => row.audit?.created?.at ?? row.lastModified,
      // วันที่อัปโหลดจริงอยู่ที่ audit.created.at (lastModified ของ storage เปลี่ยนตามการเขียนทับ)
      // sort key createdAt = tb_file_tag.created_at (micro-file buildFileSearchOrderBy)
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("uploadedAt")} />
      ),
      cell: ({ row }) => {
        const at = row.original.audit?.created?.at ?? row.original.lastModified;
        return (
          <span className="text-xs tabular-nums">
            {at ? formatDate(at, dateFormat) : "—"}
          </span>
        );
      },
      size: 110,
    },
    actionColumn<DocumentFile>(onDelete, {
      ...deleteGate,
      deleteDisabledTitle: (doc) =>
        doc.delete_blocked ? t("deleteBlocked") : undefined,
    }),
  ];

  return useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    getRowId: (row) => row.fileToken,
    // ไฟล์ที่ยังถูกใช้ติ๊กไม่ได้ — ไม่งั้นลบหลายรายการแล้วได้ผล "ลบไม่ได้" กลับมาเป็นก้อน
    enableRowSelection: (row) => !row.original.delete_blocked,
    onRowSelectionChange,
    state: {
      ...tableConfig.state,
      rowSelection,
      columnVisibility: {
        index: showIndex,
        contentType: showType,
        uploader: showUploader,
      },
    },
    pageCount: Math.ceil(totalRecords / (params.perpage as number)),
  });
}
