import { useMemo, useState } from "react";
import { Download, Loader2, MoreHorizontal, Printer } from "lucide-react";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useUserActivity, useExportUserActivity } from "./use-user-activity";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { ActivityCardSkeletonGrid } from "@/components/loader/activity-card-skeleton";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useUser } from "@/hooks/use-user";
import type { User } from "@/types/workflows";
import { getUserFullName } from "@/components/lookup/lookup-user";
import { cn } from "@/lib/utils";
import { useUserActivityTable } from "./use-user-activity-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserActivityCard } from "./user-activity-card";
import { UserActivityDetailSheet } from "./user-activity-detail-sheet";
import { getLogCreatedAt, type ActivityLog } from "@/types/activity-log";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { useElementWidth } from "@/routes/system-admin/shared/use-element-width";

type DisplayMode = "list" | "grid";

const ACTION_OPTIONS = [
  { label: "Login", value: "login" },
  { label: "Logout", value: "logout" },
];

// actor_id ส่งเป็น query param แยก (`actor_id=a,b`) ไม่ใช่ clause ของ filter —
// ค่า URL จึงเป็น id เปล่า (bareIds) · users ห้ามส่ง is_active (ได้ 0 แถว)
const ACTOR_ENTITY = defineEntitySource<User>({
  fieldKey: "actor_id",
  useListHook: useUser,
  getId: (u) => u.user_id,
  getLabel: getUserFullName,
  idFilterKey: "user_id",
  serverFilter: null,
  bareIds: true,
});

export default function UserActivityComponent() {
  const isMobile = useIsMobile();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "-created_at",
  });
  const { exportUserActivity, isExporting } = useExportUserActivity();
  const t = useTranslations("systemAdmin.userActivity");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");

  // action เป็น literal string (ไม่ใช่ i18n key) จึงห่อ custom · actor_id เป็น
  // control "entity" แบบ bareIds — เหมือน pattern ของ
  // activity-log ด้านบน ทั้ง 2 field ไม่ผ่าน filter|type:value clause — backend
  // รับเป็น query param แยก (action=, actor_id=) จึงอ่านค่าดิบจาก lf.values แทน
  const userActivityFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "action",
        section: "listView.sectionDocument",
        control: "custom",
        labelKey: "systemAdmin.userActivity.action",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            placeholder={t("action")}
            options={ACTION_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "actor_id",
        section: "listView.sectionPeople",
        control: "entity",
        entity: ACTOR_ENTITY,
        labelKey: "systemAdmin.userActivity.user",
      },
    ],
    [t],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.USER_ACTIVITY,
    fields: userActivityFilterFields,
  });

  const queryParams = (() => {
    const p = { ...params } as Record<string, unknown>;
    // Use entity_type=auth to get only login/logout records
    p.entity_type = "auth";
    // If user picks a specific action (login OR logout), send single value
    const actionFilter = lf.values.action;
    if (actionFilter && !actionFilter.includes(",")) {
      p.action = actionFilter;
    }
    if (lf.values.actor_id) p.actor_id = lf.values.actor_id;
    return p;
  })();

  const useInfiniteScroll = isMobile || displayMode === "grid";

  const { data, isLoading, error, refetch } = useUserActivity(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<ActivityLog>({
    useListHook: useUserActivity,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const logs = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportUserActivity({
        params: queryParams,
        columns: [
          { header: tfl("date"), value: (r) => getLogCreatedAt(r), width: 18 },
          { header: tfl("action"), value: (r) => r.action, width: 12 },
          {
            header: tfl("user"),
            value: (r) =>
              [r.actor_firstname, r.actor_middlename, r.actor_lastname]
                .filter(Boolean)
                .join(" ") ||
              (r.actor_username ?? ""),
            width: 24,
          },
          {
            header: tfl("ipAddress"),
            value: (r) => r.ip_address ?? "",
            width: 16,
          },
          {
            header: tfl("description"),
            value: (r) => r.description ?? "",
            width: 40,
          },
        ],
      });
      if (count === 0) {
        toast.warning(tc("exportNoData"));
        return;
      }
      toast.success(tc("exportSuccess", { count }));
    } catch (err) {
      exportErrorToast(err);
    }
  };

  // ตารางเลือกชุดคอลัมน์จากความกว้างของกล่องตัวเอง (ลบขอบ 1px สองข้างของ DataGridContainer)
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const table = useUserActivityTable({
    logs,
    totalRecords,
    params,
    tableConfig,
    containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="hidden sm:inline-flex"
          >
            {isExporting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {isExporting ? tc("exporting") : tc("export")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => globalThis.print()}
            className="hidden sm:inline-flex"
          >
            <Printer aria-hidden="true" />
            {tc("print")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="ml-auto h-11 w-11 shrink-0 sm:hidden"
                aria-label={tc("aria.moreActions")}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {isExporting ? tc("exporting") : tc("export")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => globalThis.print()}>
                <Printer aria-hidden="true" />
                {tc("print")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={userActivityFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {/* Content */}
      {!isMobile && displayMode === "list" && (
        <div ref={setGridBox}>
          <DataGrid
            table={table}
            recordCount={totalRecords}
            isLoading={isLoading}
            tableLayout={{ headerSticky: true }}
            emptyMessage={<EmptyComponent />}
            onRowClick={setSelectedLog}
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
              <DataGridPagination />
            </DataGridContainer>
          </DataGrid>
        </div>
      )}

      {useInfiniteScroll &&
        (grid.isLoading ? (
          <ActivityCardSkeletonGrid />
        ) : grid.error ? (
          <ErrorState
            message={grid.error.message}
            onRetry={() => grid.refetch?.()}
          />
        ) : logs.length === 0 ? (
          <EmptyComponent />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {logs.map((log, i) => (
                <UserActivityCard
                  key={log.id}
                  log={log}
                  index={i}
                  onClick={() => setSelectedLog(log)}
                />
              ))}
            </div>
            {grid.hasMore && (
              <div ref={grid.sentinelRef} className="flex justify-center py-4">
                {grid.isLoadingMore && (
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                )}
              </div>
            )}
          </>
        ))}

      {/* Detail Sheet */}
      <UserActivityDetailSheet
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
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
