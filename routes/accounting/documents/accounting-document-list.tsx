import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Columns3, FileDown, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import SearchInput from "@/components/search-input";
import EmptyComponent from "@/components/empty-component";
import { CellAction } from "@/components/ui/cell-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridColumnVisibility } from "@/components/ui/data-grid/data-grid-column-visibility";
import { DataGridSortMenu } from "@/components/ui/data-grid/data-grid-sort-menu";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { StatusFilter } from "@/components/ui/status-filter";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { STATUS_DOT_CHIP, createStatusConfig } from "@/constant/status-config";
import {
  accountingDocumentFromPath,
  documentsFor,
  type AccountingDocument,
} from "./accounting-document-model";

const ACCOUNTING_STATUS = createStatusConfig(
  ["draft", "pending", "approved", "posted", "paid", "overdue"] as const,
  {
    posted: {
      className: `${STATUS_DOT_CHIP} before:bg-[var(--status-completed)]`,
    },
    paid: {
      className: `${STATUS_DOT_CHIP} before:bg-[var(--status-approved)]`,
    },
    overdue: {
      className: `${STATUS_DOT_CHIP} before:bg-[var(--status-rejected)]`,
    },
  },
);

function statusConfig(status: AccountingDocument["status"]) {
  return ACCOUNTING_STATUS[status.toLowerCase()];
}

export default function AccountingDocumentList() {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const t = useTranslations("accounting.documents");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const config = accountingDocumentFromPath(pathname);
  const documents = useMemo(
    () =>
      documentsFor(config).filter((item) => {
        const matchesSearch = `${item.number} ${item.description} ${item.party}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return (
          matchesSearch && (!status || item.status.toLowerCase() === status)
        );
      }),
    [config, search, status],
  );

  const columns = useMemo<ColumnDef<AccountingDocument>[]>(
    () => [
      {
        accessorKey: "number",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("number")} />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() => navigate(`${config.path}/${row.original.id}`)}
          >
            {row.original.number}
          </CellAction>
        ),
        enableHiding: false,
        meta: { headerTitle: t("number") },
      },
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("date")} />
        ),
        meta: {
          headerTitle: t("date"),
          cellClassName: "tabular-nums",
        },
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("description")} />
        ),
        cell: ({ row }) => (
          <span
            className="block max-w-64 truncate"
            title={row.original.description}
          >
            {row.original.description}
          </span>
        ),
        meta: { headerTitle: t("description") },
      },
      {
        accessorKey: "party",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("party")} />
        ),
        cell: ({ row }) => (
          <span className="block max-w-48 truncate" title={row.original.party}>
            {row.original.party}
          </span>
        ),
        meta: { headerTitle: t("party") },
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => {
          const badge = statusConfig(row.original.status);
          return (
            <Badge size="sm" className={badge.className}>
              {row.original.status}
            </Badge>
          );
        },
        meta: {
          headerTitle: t("status"),
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("amount")}
            className="justify-end"
          />
        ),
        cell: ({ row }) =>
          `฿${row.original.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}`,
        meta: {
          headerTitle: t("amount"),
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
      },
    ],
    [config.path, navigate, t],
  );

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const openDocument = (document: AccountingDocument) =>
    navigate(`${config.path}/${document.id}`);

  return (
    <ListPageShell
      title={t(`${config.kind}.title`)}
      // ทุกชนิดมาจาก documentsFor() (ข้อมูลปลอม) — JV มีหน้า list ของตัวเองที่อ่าน API จริง
      mock={config.kind !== "journalVoucher"}
      description={t(`${config.kind}.description`)}
      count={documents.length}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileDown className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
          <Button size="sm" onClick={() => navigate(`${config.path}/new`)}>
            <Plus className="size-4" aria-hidden="true" />
            {t("new")}
          </Button>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
            <div className="flex-1 sm:flex-initial">
              <SearchInput
                defaultValue={search}
                onSearch={setSearch}
                onInputChange={setSearch}
              />
            </div>
            <span className="bg-border hidden h-4 w-px sm:block" />
            <StatusFilter
              value={status}
              onChange={setStatus}
              placeholder={t("status")}
              defaultLabel={t("allStatuses")}
              className="w-36 text-xs"
              options={Object.keys(ACCOUNTING_STATUS).map((value) => ({
                value,
                label: ACCOUNTING_STATUS[value].label,
              }))}
            />
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <DataGridSortMenu table={table} />
            {displayMode === "list" && (
              <DataGridColumnVisibility
                table={table}
                trigger={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={tc("aria.toggleColumns")}
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
      <div className="mt-3">
        {!isGridMode && (
          <DataGrid
            table={table}
            recordCount={documents.length}
            tableLayout={{ headerSticky: true, width: "auto" }}
            tableClassNames={{ bodyRow: "h-10" }}
            emptyMessage={<EmptyComponent />}
          >
            <DataGridContainer className={listGridMaxH(false)}>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        )}

        {isGridMode && (
          <>
            {documents.length === 0 ? (
              <EmptyComponent />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((document) => {
                  const badge = statusConfig(document.status);
                  return (
                    <ListCard
                      key={document.id}
                      title={document.number}
                      badge={
                        <Badge size="xs" className={badge.className}>
                          {document.status}
                        </Badge>
                      }
                      onOpen={() => openDocument(document)}
                    >
                      <ListCardRow label={t("date")}>
                        <span className="tabular-nums">{document.date}</span>
                      </ListCardRow>
                      <ListCardRow label={t("party")}>
                        {document.party}
                      </ListCardRow>
                      <ListCardRow label={t("description")}>
                        {document.description}
                      </ListCardRow>
                      <ListCardRow label={t("amount")}>
                        <span className="font-semibold tabular-nums">
                          ฿
                          {document.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </ListCardRow>
                    </ListCard>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ListPageShell>
  );
}
