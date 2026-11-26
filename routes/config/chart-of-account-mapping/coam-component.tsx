"use no memo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { CheckCheck, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { ListLoadMore } from "@/components/share/list-load-more";
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
import type { RowSelectionState, Updater } from "@tanstack/react-table";
import { ApiError } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import { useAccountingConfigEdit } from "../shared/use-accounting-config-edit";
import type { CellMenuHandlers, MappingField } from "./coam-cells";
import {
  EMPTY_COUNTS,
  useAccountMappingInfinite,
  useReviewAccountMapping,
  useReviewAccountMappingByFilter,
  useUpdateAccountMapping,
  type AccountMappingListParams,
} from "./use-account-mapping";
import { useCoamTable } from "./use-coam-table";
import { CoamEditSheet } from "./coam-edit-sheet";
import { CoamGenerateDialog } from "./coam-generate-dialog";
import { CoamBatchEditSheet } from "./coam-batch-edit-sheet";
import { CoamSelectAllBanner } from "./coam-select-all-banner";
import type { BatchUpdateAccountMappingResult } from "./use-account-mapping";
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

// ต้องตรงกับ whitelist ฝั่ง backend ACCOUNT_MAPPING_SORT_KEYS — นอกนั้น backend ตอบ 400
const SORTABLE_COLUMNS = new Set([
  "location",
  "location_type",
  "category",
  "sub_category",
  "item_group",
  "movement",
  "adjustment_type",
  "cost_center",
  "account",
]);

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
  const [batchOpen, setBatchOpen] = useState(false);
  // mount sheet ใหม่ทุกครั้งที่เปิด ให้ทุกช่องเริ่มที่ "ไม่เปลี่ยน"
  const [batchSeq, setBatchSeq] = useState(0);
  // snapshot แถวตอนเปิด sheet — refetch เบื้องหลังต้องไม่เปลี่ยน doc_version ใต้มือผู้ใช้
  const [batchRows, setBatchRows] = useState<AccountMappingRow[]>([]);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  // "ทุกแถวที่ตรงตัวกรอง" (เกินกว่าที่โหลดมา) — เก็บจำนวนที่ผู้ใช้เห็นตอนกดเลือกทั้งหมด
  // เป็น expected_count (ไม่ใช่ total สด ๆ ที่ refetch เบื้องหลังอาจเปลี่ยนไปแล้ว) · null = ไม่อยู่ในโหมดนี้
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const allMatching = matchCount !== null;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { params, tableConfig, search, setSearch } = useDataGridState();
  // reference คงที่ต่อแท็บ (module-level) — useListFilters ต้องการ fields ที่ไม่เปลี่ยนทุก render
  const fields = coamFilterFields(tab);
  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.CHART_OF_ACCOUNT_MAPPING,
    fields,
  });

  // lazy load — ไม่มี page/perpage ใน query (hook โหลดทีละชุดเอง)
  const query: Omit<AccountMappingListParams, "page" | "perpage"> = {
    mapping_type: tab,
    search: params.search || undefined,
    sort: SORTABLE_COLUMNS.has((params.sort ?? "").split(":")[0])
      ? params.sort
      : undefined,
    ...filtersToParams(lf.values, tab),
  };
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAccountMappingInfinite(query);
  const review = useReviewAccountMapping();
  const reviewByFilter = useReviewAccountMappingByFilter();
  const update = useUpdateAccountMapping();
  const errorToast = useErrorToast();
  const canEdit = useAccountingConfigEdit(
    "configuration.chart_of_account_mapping",
  );
  const tt = useTranslations("toast");

  const rows = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const firstPage = data?.pages[0];
  const totalRecords = firstPage?.paginate.total ?? 0;
  const counts = firstPage?.counts ?? EMPTY_COUNTS;

  // "ใช้ค่าเริ่มต้น" จากเมนูในเซลล์ — ส่ง null = ลบค่าแก้ทับของช่องนั้น
  // columns ของตาราง memo ด้วย menu — handler ต้องคงที่ ไม่งั้นตารางสร้าง column ใหม่ทุก render
  const { mutate: updateMutate } = update;
  const resetField = useCallback(
    (row: AccountMappingRow, field: MappingField) =>
      updateMutate(
        {
          id: row.id,
          doc_version: row.doc_version,
          ...(field === "account"
            ? { account_code: null }
            : { cost_center_id: null }),
        },
        {
          onSuccess: () =>
            toast.success(tt("updateSuccess", { entity: t("title") })),
          onError: (err) => {
            if (
              err instanceof ApiError &&
              err.statusCode === 409 &&
              !err.appCode
            ) {
              toast.error(t("conflict"));
              return;
            }
            errorToast(err);
          },
        },
      ),
    [updateMutate, t, tt, errorToast],
  );
  const pendingId = update.isPending ? (update.variables?.id ?? null) : null;
  const menu = useMemo<CellMenuHandlers>(
    () => ({ canEdit, onEdit: setEditing, onReset: resetField, pendingId }),
    [canEdit, resetField, pendingId],
  );

  // โหมดทุกแถว: ทุกแถวที่โหลดมา (รวมที่โหลดเพิ่มทีหลัง) ติ๊กเองโดยไม่ต้องเก็บ state
  const allRowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries(rows.map((r) => [r.id, true])),
    [rows],
  );
  const effectiveSelection = allMatching ? allRowSelection : rowSelection;
  const countSelected = (sel: RowSelectionState) =>
    Object.values(sel).filter(Boolean).length;
  // เอาติ๊กออก (แถวเดียว / หัวตาราง / reset) = ออกจากโหมดทุกแถว — โหลดแถวเพิ่มไม่ทำให้หลุด
  const onRowSelectionChange = (updater: Updater<RowSelectionState>) => {
    const next =
      typeof updater === "function" ? updater(effectiveSelection) : updater;
    if (allMatching && countSelected(next) < countSelected(effectiveSelection))
      setMatchCount(null);
    setRowSelection(next);
  };

  const table = useCoamTable({
    data: rows,
    tableConfig: {
      ...tableConfig,
      state: { ...tableConfig.state, rowSelection: effectiveSelection },
      onRowSelectionChange,
    },
    tab,
    onOpen: setEditing,
    menu,
  });
  // เลือกแถวข้ามหน้าไม่ได้ — ล้างทุกครั้งที่ขอบเขตของรายการเปลี่ยน
  // เพื่อไม่ให้ "ยืนยันว่าตรวจแล้ว" ทิ้งแถวที่เลือกไว้นอกหน้าไปเงียบ ๆ
  const scopeKey = JSON.stringify([tab, query.search, query.sort, lf.values]);
  useEffect(() => {
    // reset ผ่าน onRowSelectionChange → ออกจากโหมดทุกแถวไปด้วย
    table.resetRowSelection();
  }, [scopeKey, table]);
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedIds = selectedRows.map((r) => r.id);
  const allLoadedSelected = rows.length > 0 && table.getIsAllRowsSelected();
  const showSelectAllBanner =
    allMatching || (allLoadedSelected && totalRecords > rows.length);
  const clearSelection = () => table.resetRowSelection();

  const switchTab = (next: string) => {
    if (next === tab) return;
    clearSelection();
    // movement / adjustment type ของอีกแท็บใช้ไม่ได้ — ล้างทิ้งพร้อมกลับหน้า 1
    setURLParams({
      tab: next === "GL" ? "GL" : "",
      ...Object.fromEntries(TAB_SCOPED_FILTER_KEYS.map((k) => [k, ""])),
      page: "",
      sort: "",
    });
  };

  const toggleStatus = (value: MappingStatus) =>
    lf.setValue("status", query.status === value ? "" : value);

  const markReviewed = () => {
    if (allMatching) {
      const { sort: _sort, ...filters } = query;
      reviewByFilter.mutate(
        { ...filters, expected_count: matchCount },
        {
          onSuccess: (res) => {
            toast.success(
              t("markReviewedDone", { count: res?.updated ?? matchCount }),
            );
            clearSelection();
          },
          onError: (err) => {
            if (
              err instanceof ApiError &&
              err.appCode === "ACCOUNT_MAPPING_SCOPE_CHANGED"
            ) {
              // รายการถูก refetch เองจาก invalidate ของ mutation
              toast.warning(t("scopeChanged"));
              clearSelection();
              return;
            }
            errorToast(err);
          },
        },
      );
      return;
    }
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
  };

  // แถวที่บันทึกไม่ได้ยังติ๊กค้างไว้ให้ลองใหม่ — refetch ไม่เปลี่ยน scopeKey จึงไม่ถูกล้าง
  const batchDone = (res: BatchUpdateAccountMappingResult) => {
    const failed = [...res.conflicts, ...res.not_found];
    table.setRowSelection(Object.fromEntries(failed.map((id) => [id, true])));
    setBatchOpen(false);
    if (failed.length === 0) {
      toast.success(t("batchEditDone", { count: res.updated.length }));
    } else {
      toast.warning(
        t("batchEditPartial", {
          saved: res.updated.length,
          failed: failed.length,
        }),
      );
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {selectedIds.length > 0 && (
            <>
              {!allMatching && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBatchRows(selectedRows);
                    setBatchSeq((n) => n + 1);
                    setBatchOpen(true);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  {t("editSelected")}
                  <span className="tabular-nums">({selectedIds.length})</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={markReviewed}
                disabled={review.isPending || reviewByFilter.isPending}
              >
                <CheckCheck aria-hidden="true" />
                {t("markReviewed")}
                <span className="tabular-nums">
                  ({matchCount ?? selectedIds.length})
                </span>
              </Button>
            </>
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
          {showSelectAllBanner && (
            <CoamSelectAllBanner
              loaded={selectedIds.length}
              total={matchCount ?? totalRecords}
              allMatching={allMatching}
              onSelectAll={() => setMatchCount(totalRecords)}
              onClear={clearSelection}
            />
          )}
        </div>
      }
    >
      <DataGrid
        table={table}
        recordCount={totalRecords}
        isLoading={isLoading}
        emptyMessage={<EmptyComponent />}
        tableLayout={{
          headerSticky: true,
          columnsResizable: true,
          checkbox: true,
        }}
      >
        <DataGridContainer
          className={cn(
            "flex flex-col",
            listGridMaxH(lf.activeFilters.length > 0),
          )}
        >
          <DataGridScrollArea>
            <DataGridTable />
            {rows.length > 0 && (
              <ListLoadMore
                label={t("loadedOf", {
                  loaded: rows.length,
                  total: totalRecords,
                })}
                loaded={rows.length}
                hasMore={!!hasNextPage}
                isLoadingMore={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
              />
            )}
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
      <CoamEditSheet row={editing} onClose={() => setEditing(null)} />
      <CoamBatchEditSheet
        key={batchSeq}
        rows={batchRows}
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onDone={batchDone}
      />
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
