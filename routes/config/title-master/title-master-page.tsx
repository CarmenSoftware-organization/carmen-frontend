import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Columns3, UserRound } from "lucide-react";
import { toast } from "sonner";
import SearchInput from "@/components/search-input";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { DocumentListActions } from "@/components/share/document-list-actions";
import {
  ListCard,
  ListCardActiveRow,
  ListCardRow,
} from "@/components/share/list-card";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
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
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { StatusFilter } from "@/components/ui/status-filter";
import { StatusSwitch } from "@/components/ui/status-switch";
import { WarningDialog } from "@/components/ui/warning-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildXlsxFileName, downloadXlsx } from "@/lib/xlsx-utils";
import {
  type TitleMaster,
  useAccountingMasterMock,
} from "../accounting-master-mock";

export default function TitleMasterPage() {
  // ตารางนี้แบ่งหน้า/เรียงฝั่ง client ผ่าน state ของ TanStack — กันคอมไพเลอร์แช่ JSX
  // ของหน้าไว้ที่หน้าแรก (ดู routes/CLAUDE.md)
  "use no memo";

  const store = useAccountingMasterMock();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [editing, setEditing] = useState<TitleMaster | null | undefined>();
  const [deleting, setDeleting] = useState<TitleMaster | null>(null);
  const [warning, setWarning] = useState("");
  const isGridMode = isMobile || displayMode === "grid";

  const rows = useMemo(
    () =>
      store.titles.filter((item) => {
        const matchesSearch = `${item.code} ${item.description}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus =
          !status || (status === "active" ? item.is_active : !item.is_active);
        return matchesSearch && matchesStatus;
      }),
    [search, status, store.titles],
  );

  const columns = useMemo<ColumnDef<TitleMaster>[]>(
    () => [
      selectColumn<TitleMaster>(),
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
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Title Code" />
        ),
        cell: ({ row }) => (
          <CellAction onClick={() => setEditing(row.original)}>
            {row.original.code}
          </CellAction>
        ),
        meta: { headerTitle: "Title Code", skeleton: columnSkeletons.text },
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Description" />
        ),
        meta: { headerTitle: "Description", skeleton: columnSkeletons.text },
      },
      {
        accessorKey: "reference_count",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Linked records"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.reference_count}</span>
        ),
        size: 140,
        meta: {
          headerTitle: "Linked records",
          headerClassName: "text-right",
          cellClassName: "text-right",
          skeleton: columnSkeletons.number,
        },
      },
      statusColumn<TitleMaster>(),
      {
        id: "action",
        header: () => "",
        cell: ({ row }) => (
          <DataGridRowActions onDelete={() => setDeleting(row.original)} />
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
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      sorting: [{ id: "code", desc: false }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    autoResetPageIndex: true,
  });

  const handleExport = () => {
    if (rows.length === 0) {
      toast.warning("No data to export");
      return;
    }
    void downloadXlsx({
      rows,
      columns: [
        { header: "Title Code", value: (r) => r.code, width: 14 },
        { header: "Description", value: (r) => r.description, width: 32 },
        {
          header: "Linked records",
          value: (r) => r.reference_count,
          width: 14,
        },
        {
          header: "Status",
          value: (r) => (r.is_active ? "Active" : "Inactive"),
          width: 10,
        },
      ],
      sheetName: "Title Master",
      fileName: buildXlsxFileName("title-master"),
    }).then(() => toast.success(`Exported ${rows.length} rows`));
  };

  const remove = () => {
    if (!deleting) return;
    try {
      store.deleteTitle(deleting);
      toast.success("Title deleted");
      setDeleting(null);
    } catch (error) {
      setDeleting(null);
      setWarning(
        error instanceof Error ? error.message : "Unable to delete title",
      );
    }
  };

  return (
    <ListPageShell
      title="Title Master"
      description="Honorifics used by customer, guest and accounting profiles"
      actions={
        <DocumentListActions
          onAdd={() => setEditing(null)}
          addLabel="Add Title"
          onExport={handleExport}
        />
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
            <div className="flex-1 sm:flex-initial">
              <SearchInput defaultValue={search} onSearch={setSearch} />
            </div>
            <span className="bg-border hidden h-4 w-px sm:block" />
            <StatusFilter
              value={status}
              onChange={setStatus}
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
                onOpen={() => setEditing(item)}
                onDelete={() => setDeleting(item)}
              >
                <ListCardRow label="Description">
                  {item.description}
                </ListCardRow>
                <ListCardRow label="Linked">{item.reference_count}</ListCardRow>
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
      <TitleDialog
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onSave={(values) => {
          try {
            store.saveTitle(values, editing?.id);
            toast.success(editing ? "Title updated" : "Title created");
            setEditing(undefined);
          } catch (error) {
            setWarning(
              error instanceof Error ? error.message : "Unable to save title",
            );
          }
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete title?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={remove}
      />
      <WarningDialog
        open={!!warning}
        title="Action blocked"
        description={warning}
        onConfirm={() => setWarning("")}
      />
    </ListPageShell>
  );
}

/** หน้าตาเดียวกับ `ConfigEntityDialog` — ใช้ตัวนั้นตรง ๆ ไม่ได้เพราะผูกกับ mutation hook ของ API */
function TitleDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: TitleMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: {
    code: string;
    description: string;
    is_active: boolean;
  }) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.is_active ?? true);
  const canSubmit = !!code.trim() && !!description.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-[425px]"
        showCloseButton={false}
      >
        <div className="border-border/60 bg-popover/80 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-3xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onSave({ code, description, is_active: active });
            }}
            className="relative flex flex-col"
          >
            <div className="border-border/40 bg-background/40 border-b px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="text-primary bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm">
                  <UserRound className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <DialogTitle className="text-foreground text-xl font-bold tracking-tight">
                    {item ? "Edit Title" : "Add Title"}
                  </DialogTitle>
                  <p className="text-muted-foreground text-xs">
                    Code is locked after the title is created.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="title-code" required>
                    Title Code
                  </FieldLabel>
                  <FieldInput
                    id="title-code"
                    className="h-8"
                    value={code}
                    disabled={!!item}
                    maxLength={15}
                    onChange={(event) =>
                      setCode(event.target.value.toUpperCase())
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="title-description" required>
                    Description
                  </FieldLabel>
                  <FieldInput
                    id="title-description"
                    className="h-8"
                    value={description}
                    maxLength={50}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <StatusSwitch
                  id="title-active"
                  checked={active}
                  onCheckedChange={setActive}
                />
              </FieldGroup>
            </div>

            <div className="border-border/40 bg-background/40 flex justify-end gap-3 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl font-bold shadow-lg backdrop-blur-md transition-all"
              >
                {item ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
