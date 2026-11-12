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
import { useActivityLog, useExportActivityLog } from "@/hooks/use-activity-log";
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
import { useActivityLogTable } from "./use-activity-log-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActivityLogCard } from "./activity-log-card";
import { ActivityLogDetailSheet } from "./activity-log-detail-sheet";
import { getLogCreatedAt, type ActivityLog } from "@/types/activity-log";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { ListPageShell } from "@/components/share/list-page-shell";
import { useElementWidth } from "@/routes/system-admin/shared/use-element-width";
import { listGridMaxH } from "@/components/share/list-grid-max-h";

type DisplayMode = "list" | "grid";

// ครบทุกค่าของ enum_activity_action ฝั่ง backend เรียงตามลำดับใน schema.prisma
// เพื่อเทียบกันได้ตรง ๆ เวลา backend เพิ่มค่าใหม่
const ACTION_OPTIONS = [
  { label: "View", value: "view" },
  { label: "Create", value: "create" },
  { label: "Update", value: "update" },
  { label: "Delete", value: "delete" },
  { label: "Login", value: "login" },
  { label: "Logout", value: "logout" },
  { label: "Approve", value: "approve" },
  { label: "Reject", value: "reject" },
  { label: "Cancel", value: "cancel" },
  { label: "Void", value: "void" },
  { label: "Print", value: "print" },
  { label: "Email", value: "email" },
  { label: "Other", value: "other" },
  { label: "Upload", value: "upload" },
  { label: "Download", value: "download" },
  { label: "Export", value: "export" },
  { label: "Import", value: "import" },
  { label: "Copy", value: "copy" },
  { label: "Move", value: "move" },
  { label: "Rename", value: "rename" },
  { label: "Save", value: "save" },
  { label: "Comment", value: "comment" },
  { label: "Submit", value: "submit" },
  { label: "Review", value: "review" },
  { label: "Email Sent", value: "email_sent" },
];

const ENTITY_TYPE_OPTIONS = [
  { label: "Purchase Request", value: "purchase_request" },
  { label: "Purchase Order", value: "purchase_order" },
  { label: "Goods Received Note", value: "good_received_note" },
  { label: "Credit Note", value: "credit_note" },
  { label: "Store Requisition", value: "store_requisition" },
  { label: "Inventory Transaction", value: "inventory_transaction" },
  { label: "Product", value: "product" },
  { label: "Vendor", value: "vendor" },
  { label: "Location", value: "location" },
  { label: "Department", value: "department" },
  { label: "Currency", value: "currency" },
  { label: "Period", value: "period" },
  { label: "Auth", value: "auth" },
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

export default function ActivityLogComponent() {
  const isMobile = useIsMobile();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "-created_at",
  });
  const t = useTranslations("systemAdmin.activityLog");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const { exportActivityLog, isExporting } = useExportActivityLog();

  // action/entity_type เป็น literal string (ไม่ใช่ i18n key) จึงห่อ custom ·
  // actor_id เป็น control "entity" แบบ bareIds — เหมือน
  // pattern ของ PO_TYPE/CN_TYPE ใน Task 19 ทั้ง 3 field ไม่ผ่าน
  // filter|type:value clause แบบหน้าอื่น — backend รับเป็น query param แยก
  // (action=, entity_type=, actor_id=) ตรง ๆ จึงอ่านค่าดิบจาก lf.values แทน
  // toClause/filterParam (ดู queryParams ข้างล่าง)
  const activityLogFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "action",
        section: "listView.sectionDocument",
        control: "custom",
        labelKey: "systemAdmin.activityLog.action",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            placeholder={t("action")}
            options={ACTION_OPTIONS}
            searchable
            searchPlaceholder={t("searchAction")}
            className="w-full"
          />
        ),
      },
      {
        key: "entity_type",
        section: "listView.sectionDocument",
        control: "custom",
        labelKey: "systemAdmin.activityLog.entityType",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            placeholder={t("entityType")}
            options={ENTITY_TYPE_OPTIONS}
            searchable
            searchPlaceholder={t("searchEntityType")}
            className="w-full"
          />
        ),
      },
      {
        key: "actor_id",
        section: "listView.sectionPeople",
        control: "entity",
        entity: ACTOR_ENTITY,
        labelKey: "systemAdmin.activityLog.user",
      },
    ],
    [t],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.ACTIVITY_LOG,
    fields: activityLogFilterFields,
  });

  const queryParams = (() => {
    const p = { ...params } as Record<string, unknown>;
    if (lf.values.action) p.action = lf.values.action;
    if (lf.values.entity_type) p.entity_type = lf.values.entity_type;
    if (lf.values.actor_id) p.actor_id = lf.values.actor_id;
    return p;
  })();

  const useInfiniteScroll = isMobile || displayMode === "grid";

  const { data, isLoading, error, refetch } = useActivityLog(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<ActivityLog>({
    useListHook: useActivityLog,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const logs = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportActivityLog({
        params: queryParams,
        columns: [
          { header: tfl("date"), value: (r) => getLogCreatedAt(r), width: 18 },
          { header: tfl("action"), value: (r) => r.action, width: 12 },
          {
            header: tfl("entityType"),
            value: (r) => r.entity_type,
            width: 18,
          },
          { header: tfl("entityId"), value: (r) => r.entity_id, width: 24 },
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
  const table = useActivityLogTable({
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
          fields={activityLogFilterFields}
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
                <ActivityLogCard
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
      <ActivityLogDetailSheet
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
