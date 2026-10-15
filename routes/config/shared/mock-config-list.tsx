import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { toast } from "sonner";
import SearchInput from "@/components/search-input";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { ListCard, ListCardActiveRow } from "@/components/share/list-card";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/components/ui/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import { DataGridSortMenu } from "@/components/ui/data-grid/data-grid-sort-menu";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import {
  columnSkeletons,
  selectColumn,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { StatusFilter } from "@/components/ui/status-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildXlsxFileName,
  downloadXlsx,
  type XlsxColumn,
} from "@/lib/xlsx-utils";

export interface MockConfigRow {
  id: string;
  code: string;
  description: string;
  is_active: boolean;
}

interface MockConfigListProps<T extends MockConfigRow> {
  readonly title: string;
  readonly description: string;
  readonly addLabel: string;
  /** ชื่อ sheet + prefix ของไฟล์ export */
  readonly exportName: string;
  readonly items: T[];
  /** ข้อความที่ใช้ค้นหา — default คือ code + description */
  readonly searchText?: (item: T) => string;
  /** คอลัมน์เฉพาะของหน้า แทรกระหว่าง # กับ Status (คอลัมน์ code ใช้ `mockCodeColumn`) */
  readonly columns: ColumnDef<T>[];
  readonly exportColumns: XlsxColumn<T>[];
  /** แถวในการ์ด (โหมด grid / mobile) — แถว Active ใส่ให้เอง */
  readonly renderCardRows: (item: T) => ReactNode;
  readonly onAdd: () => void;
  readonly onEdit: (item: T) => void;
  readonly onDelete: (item: T) => void;
  /** dialog ของหน้า (เพิ่ม/แก้ไข/ลบ/เตือน) */
  readonly children?: ReactNode;
}

/**
 * หน้า list ของ master ที่ยังอ่านจาก `accounting-master-mock` — หน้าตาเดียวกับ
 * `ConfigListTemplate` (ใช้ตัวนั้นตรง ๆ ไม่ได้เพราะผูกกับ query/mutation hook ของ API)
 * ค้นหา/กรอง/เรียง/แบ่งหน้าทำฝั่ง client ทั้งหมด
 */
export function MockConfigList<T extends MockConfigRow>({
  title,
  description,
  addLabel,
  exportName,
  items,
  searchText = (item) => `${item.code} ${item.description}`,
  columns,
  exportColumns,
  renderCardRows,
  onAdd,
  onEdit,
  onDelete,
  children,
}: MockConfigListProps<T>) {
  // แบ่งหน้า/เรียงด้วย state ของ TanStack — กันคอมไพเลอร์แช่ JSX ของหน้าไว้ที่
  // หน้าแรก (ดู routes/CLAUDE.md)
  "use no memo";

  const isMobile = useIsMobile();
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const isGridMode = isMobile || displayMode === "grid";

  const rows = items.filter((item) => {
    const matchesSearch = searchText(item)
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      !status || (status === "active" ? item.is_active : !item.is_active);
    return matchesSearch && matchesStatus;
  });

  const allColumns = useMemo<ColumnDef<T>[]>(
    () => [
      selectColumn<T>(),
      {
        id: "index",
        header: "#",
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination;
          const position = table
            .getRowModel()
            .rows.findIndex((r) => r.id === row.id);
          return pageIndex * pageSize + position + 1;
        },
        enableSorting: false,
        enableHiding: false,
        size: 60,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
          skeleton: columnSkeletons.checkbox,
        },
      },
      ...columns,
      statusColumn<T>(tfl),
      {
        id: "action",
        header: () => "",
        cell: ({ row }) => (
          <DataGridRowActions onDelete={() => onDelete(row.original)} />
        ),
        enableSorting: false,
        size: 60,
        meta: {
          headerClassName: "text-right print:hidden",
          cellClassName: "text-right print:hidden",
          skeleton: null,
        },
      },
    ],
    [columns, onDelete, tfl],
  );

  const table = useReactTable({
    data: rows,
    columns: allColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      sorting: [{ id: "code", desc: false }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    // ปิด auto reset — `rows` เป็น array ใหม่ทุก render (searchText มาเป็น inline fn
    // จึง memo ไม่ได้) ถ้าเปิดไว้ TanStack จะ reset หน้า → setState → render ใหม่
    // วนไม่จบตั้งแต่ re-render ครั้งที่สอง (เปิด dialog แล้วหน้าค้าง) · กลับหน้าแรกเอง
    // ตอนเปลี่ยนคำค้น/สถานะแทน
    autoResetPageIndex: false,
  });

  const handleExport = () => {
    if (rows.length === 0) {
      toast.warning("No data to export");
      return;
    }
    void downloadXlsx({
      rows,
      columns: exportColumns,
      sheetName: exportName,
      fileName: buildXlsxFileName(
        exportName.toLowerCase().replace(/\s+/g, "-"),
      ),
    }).then(() => toast.success(`Exported ${rows.length} rows`));
  };

  return (
    <ListPageShell
      title={title}
      mock
      description={description}
      actions={
        <DocumentListActions
          onAdd={onAdd}
          addLabel={addLabel}
          onExport={handleExport}
        />
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
            <div className="flex-1 sm:flex-initial">
              <SearchInput
                defaultValue={search}
                onSearch={(value) => {
                  setSearch(value);
                  table.setPageIndex(0);
                }}
              />
            </div>
            <span className="bg-border hidden h-4 w-px sm:block" />
            <StatusFilter
              value={status}
              onChange={(value) => {
                setStatus(value);
                table.setPageIndex(0);
              }}
              placeholder="Status"
              defaultLabel="All statuses"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              className="w-36"
            />
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <DataGridSortMenu table={table} />
            {!isGridMode && (
              <DataGridColumnVisibility
                table={table}
                trigger={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Toggle columns"
                  >
                    <Columns3 className="size-4" />
                  </Button>
                }
              />
            )}
            <DisplayModeToggle value={displayMode} onChange={setDisplayMode} />
          </div>
        </div>
      }
    >
      {isGridMode ? (
        rows.length === 0 ? (
          <EmptyComponent />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {table.getSortedRowModel().rows.map(({ original: item }) => (
              <ListCard
                key={item.id}
                title={item.code}
                onOpen={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              >
                {renderCardRows(item)}
                <ListCardActiveRow active={item.is_active} />
              </ListCard>
            ))}
          </div>
        )
      ) : (
        <DataGrid
          table={table}
          recordCount={rows.length}
          emptyMessage={<EmptyComponent />}
          tableLayout={{ headerSticky: true }}
        >
          <DataGridContainer className={`flex flex-col ${listGridMaxH(false)}`}>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}
      {children}
    </ListPageShell>
  );
}
