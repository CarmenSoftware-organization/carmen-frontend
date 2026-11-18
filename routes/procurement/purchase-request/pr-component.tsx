import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { CheckCircle2, Trash2, XCircle, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useElementWidth } from "@/hooks/use-element-width";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { cn } from "@/lib/utils";
import { ViewModeToggle } from "@/components/share/view-mode-toggle";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { Button } from "@/components/ui/button";
import {
  usePurchaseRequest,
  useMyPendingPurchaseRequest,
  useExportPurchaseRequest,
} from "./use-purchase-request";
import { useCreatableWorkflows } from "@/hooks/use-workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { setURLParams, useURL } from "@/hooks/use-url";
import type { PurchaseRequest } from "@/types/purchase-request";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PrStatusSelectDialog } from "./pr-select-dialog";
import { PrListDialogs } from "./pr-list-dialogs";
import { ErrorState } from "@/components/ui/error-state";
import { usePrTable } from "./use-pr-table";
import PrCardList from "./pr-card-list";
import EmptyComponent from "@/components/empty-component";
import { lazy, Suspense } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useCan } from "@/hooks/use-can";
import { canDeletePr } from "./pr-ownership";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { usePrFilterFields } from "./use-pr-filter-fields";
import { usePrSelection } from "./use-pr-selection";
import { buildPrExportColumns } from "./pr-export-columns";

// แทน next/dynamic ด้วย React.lazy (code-split เหมือนเดิม)
const CreatePRDialog = lazy(() =>
  import("./pr-create-dialog").then((mod) => ({ default: mod.CreatePRDialog })),
);

export default function PurchaseRequestComponent() {
  const t = useTranslations("procurement.purchaseRequest");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const navigate = useNavigate();
  const { defaultCurrencyCode, dateTimeFormat, userId } = useProfile();
  const { isAdmin } = useCan();
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequest | null>(
    null,
  );

  /**
   * ใบของคนอื่น backend ลบไม่ให้อยู่แล้ว — บอกตั้งแต่ตอนกด อย่าเปิดกล่องยืนยันก่อน
   * แล้วค่อยเด้ง 403 หลังกดยืนยัน (ดู pr-ownership.ts) · จุดเดียวคุมทั้งแถวในตาราง
   * และการ์ดในโหมด grid
   */
  const requestDelete = (item: PurchaseRequest) => {
    if (!canDeletePr(item, userId, isAdmin)) {
      dispatchPermissionDenied(undefined, t("deleteNotOwner"));
      return;
    }
    setDeleteTarget(item);
  };
  const [approveTarget, setApproveTarget] = useState<PurchaseRequest | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequest | null>(
    null,
  );
  const [batchApproveOpen, setBatchApproveOpen] = useState(false);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  // viewMode อยู่ใน URL (?view=) เพื่อให้ปุ่ม back จาก detail กลับมาเจอ tab เดิม
  const [viewModeParam] = useURL("view", {
    defaultValue: "my-pending",
  });
  const viewMode = viewModeParam as "my-pending" | "all-document";
  /**
   * สลับกลุ่มเอกสาร — ล้างคำค้น ขั้นตอนที่กรองไว้ และกลับหน้า 1 เสมอ
   *
   * สองกลุ่มนี้เป็นคนละชุดข้อมูลกัน คำค้นที่เจอ 3 ใบใน "รอฉันดำเนินการ" อาจเจอ
   * 200 ใบใน "เอกสารทั้งหมด" (หรือกลับกันคือเจอ 0 แล้วดูเหมือนไม่มีอะไรเลย)
   * ขั้นตอนที่กรองไว้ก็อาจไม่มีอยู่ในอีกกลุ่ม และเลขหน้าที่ค้างอยู่ก็อาจไม่มีจริง
   * · เขียนทีเดียวทุกพารามิเตอร์ด้วย setURLParams จะได้ replaceState กับ
   * re-render รอบเดียว
   */
  const handleViewModeChange = useCallback(
    (next: string) =>
      setURLParams({
        view: next,
        search: "",
        page: "",
        workflow_current_stage: "",
      }),
    [],
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const { exportPurchaseRequest, isExporting } = useExportPurchaseRequest();

  /**
   * เรียงตามวันที่เป็นค่าเริ่มต้นทั้งสองกลุ่ม แต่คนละทิศ — "รอฉันดำเนินการ" เป็นคิวงาน
   * ใบเก่าสุดต้องอยู่บนสุด (asc) ส่วน "เอกสารทั้งหมด" เป็นทะเบียนย้อนหลัง
   * ใบล่าสุดต้องอยู่บนสุด (desc) · ค่านี้มีผลเฉพาะตอนไม่มี `sort` ใน URL
   */
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: viewMode === "my-pending" ? "pr_date:asc" : "pr_date:desc",
  });

  const prFilterFields = usePrFilterFields();

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PURCHASE_REQUEST,
    fields: prFilterFields,
    defaultSort: viewMode === "my-pending" ? "pr_date:asc" : "pr_date:desc",
  });

  const queryParams = { ...params, filter: lf.filterParam };

  const handleExport = async () => {
    try {
      const count = await exportPurchaseRequest({
        params: queryParams,
        viewMode,
        columns: buildPrExportColumns({
          tfl,
          defaultCurrencyCode,
          dateTimeFormat,
        }),
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

  const useInfiniteScroll = !!isMobile;

  // ยิงเฉพาะ endpoint ของ tab ที่เปิดอยู่ — อีก tab รอจนกดถึงค่อย fetch
  // (ข้อมูลที่เคยโหลดยังอยู่ใน cache สลับกลับมาจึงไม่ยิงซ้ำ)
  const myPendingQuery = useMyPendingPurchaseRequest(queryParams, {
    enabled: !useInfiniteScroll && viewMode === "my-pending",
  });
  const allDocumentQuery = usePurchaseRequest(queryParams, {
    enabled: !useInfiniteScroll && viewMode === "all-document",
  });

  const { data, isLoading, error, refetch } =
    viewMode === "my-pending" ? myPendingQuery : allDocumentQuery;

  const activeListHook =
    viewMode === "my-pending"
      ? useMyPendingPurchaseRequest
      : usePurchaseRequest;

  const grid = useGridPagination<PurchaseRequest>({
    useListHook: activeListHook,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const items = useInfiniteScroll ? grid.items : (data?.data ?? []);

  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const selection = usePrSelection(items);
  const { selectedItems, hasSelection, selectedGroup } = selection;

  const requestBatchDelete = () => {
    if (!selectedItems.every((item) => canDeletePr(item, userId, isAdmin))) {
      dispatchPermissionDenied(undefined, t("batchDeleteNotOwner"));
      return;
    }
    setBatchDeleteOpen(true);
  };

  // ลบขอบ 1px สองข้างของ DataGridContainer ออก ได้ความกว้างที่ตารางใช้จริง
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const table = usePrTable({
    containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2,
    items,
    totalRecords,
    params,
    tableConfig,
    onEdit: (item) =>
      navigate(`/procurement/purchase-request/${item.id}`, listReturnState()),
    onDelete: requestDelete,
    onApprove: setApproveTarget,
    onReject: setRejectTarget,
    isMyPending: viewMode === "my-pending",
    onRowSelect: selection.handleRowSelect,
    onSelectAll: selection.handleSelectAll,
    rowSelection: selection.rowSelection,
    onRowSelectionChange: selection.setRowSelection,
  });

  // ไม่มี workflow ให้เริ่มใบเลย = สร้างไม่ได้ ปุ่มจาง แต่กดแล้วยังบอกเหตุผล
  // (ซ่อนไปเลยพนักงานจะนึกว่าระบบเสีย)
  const { canCreate: canCreatePr } = useCreatableWorkflows(WORKFLOW_TYPE.PR);

  const handleAdd = () => {
    if (!canCreatePr) {
      dispatchPermissionDenied(undefined, t("noCreatableWorkflow"));
      return;
    }
    setCreateDialogOpen(true);
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <DocumentListActions
          onExport={handleExport}
          isExporting={isExporting}
          onAdd={handleAdd}
          addLabel={t("add")}
          addDisabled={!canCreatePr}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={prFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          beforeViewSelector={
            <ViewModeToggle
              value={viewMode}
              onChange={handleViewModeChange}
              myPendingLabel={t("myPending")}
              allDocumentsLabel={t("allDocuments")}
              className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"
            />
          }
        />
      }
    >
      {hasSelection && viewMode === "my-pending" && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-xs">
            {selectedItems.length} {t("selected")}
          </span>
          {selectedGroup === "draft" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={requestBatchDelete}
            >
              <Trash2 aria-hidden="true" />
              {tc("delete")}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="success"
                onClick={() => setBatchApproveOpen(true)}
              >
                <CheckCircle2 aria-hidden="true" />
                {tc("approve")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBatchRejectOpen(true)}
              >
                <XCircle aria-hidden="true" />
                {tc("reject")}
              </Button>
            </>
          )}
        </div>
      )}

      {!isGridMode && (
        <div ref={setGridBox}>
          <DataGrid
            table={table}
            recordCount={totalRecords}
            isLoading={isLoading}
            tableLayout={{
              checkbox: true,
              headerSticky: true,
              // ไม่เปิด columnsResizable — โหมดนั้น DataGrid ข้าม meta.grow คอลัมน์จึงถูกยืด
              // ตามสัดส่วนจนห่างกันที่ 4K · คอลัมน์ที่ไม่พอใส่ซ่อนตามความกว้างกล่องแทน
              // (columnTier ใน use-pr-table.tsx)
            }}
            emptyMessage={<EmptyComponent />}
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

      {isGridMode && (
        <>
          <PrCardList
            items={items}
            isLoading={useInfiniteScroll ? grid.isLoading : isLoading}
            onEdit={(item) =>
              navigate(
                `/procurement/purchase-request/${item.id}`,
                listReturnState(),
              )
            }
            onApprove={setApproveTarget}
            onReject={setRejectTarget}
            onDelete={requestDelete}
            isMyPending={viewMode === "my-pending"}
            compact={!!isMobile}
          />
          {useInfiniteScroll && grid.hasMore && (
            <div ref={grid.sentinelRef} className="flex justify-center py-4">
              {grid.isLoadingMore && (
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              )}
            </div>
          )}
        </>
      )}

      <PrListDialogs
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        approveTarget={approveTarget}
        setApproveTarget={setApproveTarget}
        rejectTarget={rejectTarget}
        setRejectTarget={setRejectTarget}
        batchApproveOpen={batchApproveOpen}
        setBatchApproveOpen={setBatchApproveOpen}
        batchRejectOpen={batchRejectOpen}
        setBatchRejectOpen={setBatchRejectOpen}
        batchDeleteOpen={batchDeleteOpen}
        setBatchDeleteOpen={setBatchDeleteOpen}
        selectedItems={selectedItems}
        pageItemCount={items.length}
        clearSelection={selection.clearSelection}
        table={table}
      />

      <ConfirmDialog
        open={!!selection.switchTarget}
        onOpenChange={(open) => !open && selection.setSwitchTarget(null)}
        title={t("switchSelectionTitle")}
        description={t("switchSelectionDesc", {
          count: selectedItems.length,
          from:
            selectedGroup === "draft"
              ? t("selectDraft")
              : t("selectInProgress"),
        })}
        confirmText={t("switchSelectionConfirm", {
          to:
            selection.switchTarget &&
            selection.groupOf(selection.switchTarget) === "draft"
              ? t("selectDraft")
              : t("selectInProgress"),
        })}
        onConfirm={selection.confirmSwitch}
      />

      <PrStatusSelectDialog
        open={selection.selectAllOpen}
        onOpenChange={selection.setSelectAllOpen}
        draftCount={selection.draftItems.length}
        inProgressCount={selection.inProgressItems.length}
        onSelectDraft={() => {
          selection.selectOnly(selection.draftItems);
          selection.setSelectAllOpen(false);
        }}
        onSelectInProgress={() => {
          selection.selectOnly(selection.inProgressItems);
          selection.setSelectAllOpen(false);
        }}
      />

      <Suspense fallback={null}>
        <CreatePRDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </Suspense>

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
