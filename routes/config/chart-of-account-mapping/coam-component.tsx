"use no memo";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { CheckCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { setURLParams, useURL } from "@/hooks/use-url";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { cn } from "@/lib/utils";
import type {
  AccountMappingRow,
  MappingStatus,
  MappingType,
} from "@/types/chart-of-account-mapping";
import {
  EMPTY_COUNTS,
  useAccountMappingList,
  useReviewAccountMapping,
  type AccountMappingListParams,
} from "./use-account-mapping";
import { useCoamTable } from "./use-coam-table";
import { CoamEditSheet } from "./coam-edit-sheet";
import { CoamGenerateDialog } from "./coam-generate-dialog";
import {
  TAB_SCOPED_FILTER_KEYS,
  coamFilterFields,
  filtersToParams,
} from "./coam-filter-fields";

const STATUS_CHIPS: { value: MappingStatus; labelKey: string }[] = [
  { value: "incomplete", labelKey: "statusIncomplete" },
  { value: "unreviewed", labelKey: "statusUnreviewed" },
  { value: "overridden", labelKey: "statusOverridden" },
  { value: "default", labelKey: "statusDefault" },
];

export default function CoamComponent() {
  "use no memo";
  const t = useTranslations("config.chartOfAccountMapping");
  const [tabParam] = useURL("tab");
  const tab: MappingType = tabParam === "GL" ? "GL" : "AP";
  const [editing, setEditing] = useState<AccountMappingRow | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  // dialog seed mode/type จาก props ครั้งเดียวตอน mount — เปลี่ยน key ทุกครั้งที่เปิด
  // ให้ mount ใหม่ (type ตามแท็บปัจจุบัน, mode กลับเป็นค่าเริ่ม) แต่ยังคง animation ตอนปิด
  const [generateSeq, setGenerateSeq] = useState(0);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);

  const { params, tableConfig, search, setSearch } = useDataGridState({
    defaultPerpage: 20,
  });
  // reference คงที่ต่อแท็บ (module-level) — useListFilters ต้องการ fields ที่ไม่เปลี่ยนทุก render
  const fields = coamFilterFields(tab);
  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.CHART_OF_ACCOUNT_MAPPING,
    fields,
  });

  const query: AccountMappingListParams = {
    mapping_type: tab,
    page: Number(params.page) || 1,
    perpage: Number(params.perpage) || 20,
    search: params.search || undefined,
    ...filtersToParams(lf.values, tab),
  };
  const { data, isLoading, error, refetch } = useAccountMappingList(query);
  const review = useReviewAccountMapping();

  const rows = data?.data ?? [];
  const totalRecords = data?.paginate.total ?? 0;
  const counts = data?.counts ?? EMPTY_COUNTS;

  const table = useCoamTable({
    data: rows,
    totalRecords,
    params,
    tableConfig,
    tab,
    onOpen: setEditing,
  });
  // เลือกแถวข้ามหน้าไม่ได้ — ล้างทุกครั้งที่ขอบเขตของรายการเปลี่ยน
  // เพื่อไม่ให้ "ยืนยันว่าตรวจแล้ว" ทิ้งแถวที่เลือกไว้นอกหน้าไปเงียบ ๆ
  const scopeKey = JSON.stringify([
    tab,
    query.page,
    query.perpage,
    query.search,
    lf.values,
  ]);
  useEffect(() => {
    table.resetRowSelection();
  }, [scopeKey, table]);
  const selectedIds = table
    .getSelectedRowModel()
    .rows.map((r) => r.original.id);

  const switchTab = (next: string) => {
    if (next === tab) return;
    table.resetRowSelection();
    // movement / adjustment type ของอีกแท็บใช้ไม่ได้ — ล้างทิ้งพร้อมกลับหน้า 1
    setURLParams({
      tab: next === "GL" ? "GL" : "",
      ...Object.fromEntries(TAB_SCOPED_FILTER_KEYS.map((k) => [k, ""])),
      page: "",
    });
  };

  const toggleStatus = (value: MappingStatus) =>
    lf.setValue("status", query.status === value ? "" : value);

  const markReviewed = () =>
    review.mutate(
      { ids: selectedIds },
      {
        onSuccess: (res) => {
          toast.success(
            t("markReviewedDone", {
              count: res?.updated ?? selectedIds.length,
            }),
          );
          table.resetRowSelection();
        },
      },
    );

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={markReviewed}
              disabled={review.isPending}
            >
              <CheckCheck aria-hidden="true" />
              {t("markReviewed")}
              <span className="tabular-nums">({selectedIds.length})</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setGenerateSeq((n) => n + 1);
              setGenerateOpen(true);
            }}
          >
            <Sparkles aria-hidden="true" />
            {t("generate")}
          </Button>
        </div>
      }
      toolbar={
        <div className="flex flex-col gap-2">
          <Tabs value={tab} onValueChange={switchTab}>
            <TabsList variant="line">
              {(["AP", "GL"] as const).map((v) => (
                <TabsTrigger key={v} value={v}>
                  {t(v === "AP" ? "tabAp" : "tabGl")}
                  {tab === v && data && counts.incomplete > 0 ? (
                    <Badge
                      size="xs"
                      variant="warning-light"
                      aria-label={t("incompleteCount", {
                        count: counts.incomplete,
                      })}
                    >
                      {counts.incomplete}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div
            role="group"
            aria-label={t("statusFilterAria")}
            className="flex flex-wrap items-center gap-1.5"
          >
            {STATUS_CHIPS.map((chip) => {
              const active = query.status === chip.value;
              return (
                <Button
                  key={chip.value}
                  type="button"
                  size="xs"
                  variant={active ? "secondary" : "outline"}
                  aria-pressed={active}
                  onClick={() => toggleStatus(chip.value)}
                >
                  {t(chip.labelKey)}
                  <span
                    className={cn(
                      "tabular-nums",
                      chip.value === "incomplete" && counts.incomplete > 0
                        ? "text-warning-ink"
                        : "text-muted-foreground",
                    )}
                  >
                    {counts[chip.value]}
                  </span>
                </Button>
              );
            })}
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            lf={lf}
            fields={fields}
            onSaveViewClick={() => setSaveViewDialogOpen(true)}
            table={table}
          />
        </div>
      }
    >
      <DataGrid
        table={table}
        recordCount={totalRecords}
        isLoading={isLoading}
        emptyMessage={<EmptyComponent />}
        tableLayout={{ headerSticky: true, columnsResizable: true }}
      >
        <DataGridContainer
          className={cn(
            "flex flex-col",
            listGridMaxH(lf.activeFilters.length > 0),
          )}
        >
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination sizes={[10, 20, 50, 100]} />
        </DataGridContainer>
      </DataGrid>

      <CoamEditSheet row={editing} onClose={() => setEditing(null)} />
      <CoamGenerateDialog
        key={`${tab}-${generateSeq}`}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        defaultType={tab}
      />

      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}
