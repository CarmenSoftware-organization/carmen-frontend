import { useCallback, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  usePurchaseOrder,
  useMyPendingPurchaseOrder,
  useDeletePurchaseOrder,
  useExportPurchaseOrder,
  usePurchaseOrderWorkflowStages,
} from "../shared/use-purchase-order";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { setURLParams, useURL } from "@/hooks/use-url";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  PURCHASE_ORDER_STATUS_OPTIONS,
  PURCHASE_ORDER_TYPE_OPTIONS,
} from "@/constant/purchase-order";
import type { PurchaseOrder } from "@/types/purchase-order";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { cn } from "@/lib/utils";
import { ViewModeToggle } from "@/components/share/view-mode-toggle";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { usePoTable } from "./use-po-table";
import PoCardList from "./po-card-list";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { useCreatableWorkflows } from "@/hooks/use-workflow";
import { WORKFLOW_TYPE, isPriceHidden } from "@/types/workflows";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { FieldLabel } from "@/components/ui/field";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { SENDBACK_FILTER_CLAUSE } from "@/constant/last-action";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import {
  VENDOR_ENTITY,
  requesterEntity,
} from "@/components/filter/entity-sources";

// next/dynamic → lazy+Suspense (Batch D hand-fix)
const CreatePODialog = lazy(() =>
  import("./po-create-dialog").then((mod) => ({ default: mod.CreatePODialog })),
);

export default function PoComponent() {
  const t = useTranslations("procurement.purchaseOrder");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  // ไม่มี workflow ให้เริ่มใบเลย = สร้างไม่ได้ ปุ่มจาง แต่กดแล้วยังบอกเหตุผล
  // (ซ่อนไปเลยพนักงานจะนึกว่าระบบเสีย)
  const { canCreate: canCreatePo } = useCreatableWorkflows(WORKFLOW_TYPE.PO);

  const handleAdd = () => {
    if (!canCreatePo) {
      dispatchPermissionDenied(undefined, t("noCreatableWorkflow"));
      return;
    }
    setCreateOpen(true);
  };
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
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
        sort: "",
        workflow_current_stage: "",
      }),
    [],
  );
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const useInfiniteScroll = !!isMobile;
  const deletePo = useDeletePurchaseOrder();
  const { exportPurchaseOrder, isExporting } = useExportPurchaseOrder();
  /**
   * ค่าเรียงเริ่มต้นต่างกันตามกลุ่มเอกสาร — "รอฉันดำเนินการ" เป็นคิวงาน ใบที่
   * ถึงกำหนดก่อนต้องขึ้นก่อน (asc) ส่วน "เอกสารทั้งหมด" เป็นคลังเอกสารที่มีเป็น
   * ร้อยใบ คนเปิดมาเพื่อหาใบล่าสุด จึงเอาใหม่สุดขึ้นก่อน (desc)
   * · `handleViewModeChange` ล้าง `sort` ทิ้งตอนสลับกลุ่ม ไม่งั้นทิศที่ผู้ใช้
   * เคยคลิกไว้ในอีกกลุ่มจะค้างมาทับค่าเริ่มต้นของกลุ่มใหม่
   */
  const defaultSort =
    viewMode === "my-pending" ? "order_date:asc" : "order_date:desc";
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort,
  });

  const { data: stages } = usePurchaseOrderWorkflowStages();

  // field แรกเป็น custom control ล้วน ๆ — ไม่ใช่ filter จริง แค่ยืม slot ใน
  // ListFilter เพื่อวาง toggle my-pending/all-document (มือถือเท่านั้น
  // เหมือน PR pilot) ไม่มี value จริงจึงไม่ถูกนับใน filterParam/activeFilters
  const poFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "view_mode_toggle",
        control: "custom",
        labelKey: "",
        // ไม่มี value จริง (ปุ่ม toggle ไม่ผ่าน setValue) — ประกาศ toClause ว่างชัดเจน
        // ให้ตรงกับ pattern ของ field หลอกตัวอื่น (เช่น transaction's dateRange)
        toClause: () => "",
        render: () => (
          <div className="space-y-1.5 sm:hidden">
            <FieldLabel className="text-xs">{tc("view")}</FieldLabel>
            <ViewModeToggle
              value={viewMode}
              onChange={handleViewModeChange}
              myPendingLabel={t("myPending")}
              allDocumentsLabel={t("allDocuments")}
              className="grid grid-cols-2 gap-2"
            />
          </div>
        ),
      },
      {
        // สถานะเอกสาร (po_status) — เดิมช่องนี้เป็น active/inactive จาก is_active
        // ซึ่งคนอ่านเข้าใจว่าเป็นสถานะเอกสารตลอด ทั้งที่สถานะจริงไม่มีให้กรองเลย
        key: "filter",
        control: "custom",
        labelKey: "common.status",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={PURCHASE_ORDER_STATUS_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "po_type",
        control: "custom",
        labelKey: "procurement.purchaseOrder.type",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={PURCHASE_ORDER_TYPE_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "workflow_current_stage",
        control: "stage",
        labelKey: "field.stage",
        section: "listView.sectionDocument",
        stages: stages ?? [],
      },
      {
        key: "workflow",
        control: "workflow",
        labelKey: "field.workflow",
        section: "listView.sectionDocument",
        workflowType: WORKFLOW_TYPE.PO,
      },
      {
        // ตัวกรอง "ใบที่ถูกตีกลับ" — dropdown สองตัวเลือก (ทั้งหมด / ส่งกลับ)
        // ค่าที่เก็บคือ clause เต็มอยู่แล้ว จึงไม่ต้องประกาศ toClause
        key: "sendback",
        control: "status",
        labelKey: "common.sendBack",
        section: "listView.sectionDocument",
        options: [
          { labelKey: "common.sendBack", value: SENDBACK_FILTER_CLAUSE },
        ],
      },
      {
        // ช่วงจำนวนเงินรวม — UI ฝั่ง frontend ก่อน เหมือน PR: toClause คืนค่าว่าง
        // ไว้ไม่ให้ clause หลุดไป backend (QueryParams ยังไม่รู้จัก num_range)
        key: "amount",
        control: "amount-range",
        labelKey: "field.totalAmount",
        fieldKey: "total_amount",
        section: "listView.sectionDocument",
        toClause: () => "",
      },
      {
        // ผู้จัดซื้อ = คนเปิดใบ (คอลัมน์ Buyer ใน list) — กรองที่ created_by_id
        key: "buyer",
        control: "entity",
        entity: requesterEntity("created_by_id"),
        labelKey: "field.buyer",
        section: "listView.sectionPeople",
      },
      {
        // ทะเบียน vendor ใหญ่หลักร้อย KB — control "entity" ยิงรายการเองตอนเปิด
        // popover ทีละหน้า ส่วนชื่อบน chip ดึงเฉพาะ id ที่เลือก (EntityChipValue)
        key: "vendor",
        control: "entity",
        entity: VENDOR_ENTITY,
        labelKey: "field.vendor",
        section: "listView.sectionPeople",
      },
      {
        key: "order_date",
        control: "date-range",
        labelKey: "field.orderDate",
        fieldKey: "order_date",
        section: "listView.sectionDate",
      },
    ],
    [viewMode, stages, handleViewModeChange, t, tc],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PURCHASE_ORDER,
    fields: poFilterFields,
    defaultSort,
  });

  const queryParams = { ...params, filter: lf.filterParam };

  // gate แต่ละ query ตาม viewMode ด้วย — ก่อนหน้านี้ทั้งสอง query ยิงพร้อมกันทุก
  // ครั้งที่ search/filter/page เปลี่ยน ทั้งที่ render แค่อันเดียว (เปลือง network)
  const myPendingQuery = useMyPendingPurchaseOrder(queryParams, {
    enabled: !useInfiniteScroll && viewMode === "my-pending",
  });
  const allDocumentQuery = usePurchaseOrder(queryParams, {
    enabled: !useInfiniteScroll && viewMode !== "my-pending",
  });

  const { data, isLoading, error, refetch } =
    viewMode === "my-pending" ? myPendingQuery : allDocumentQuery;

  const activeListHook =
    viewMode === "my-pending" ? useMyPendingPurchaseOrder : usePurchaseOrder;

  const grid = useGridPagination<PurchaseOrder>({
    useListHook: activeListHook,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const purchaseOrders = useInfiniteScroll ? grid.items : (data?.data ?? []);

  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportPurchaseOrder({
        params: queryParams,
        viewMode,
        columns: [
          { header: tfl("poNo"), value: (r) => r.po_no, width: 18 },
          {
            header: tfl("vendor"),
            value: (r) => r.vendor?.name ?? "",
            width: 26,
          },
          { header: tfl("poType"), value: (r) => r.po_type, width: 12 },
          { header: tfl("orderDate"), value: (r) => r.order_date, width: 12 },
          {
            header: tfl("deliveryDate"),
            value: (r) => r.delivery_date,
            width: 12,
          },
          { header: tfl("status"), value: (r) => r.po_status, width: 14 },
          {
            header: tfl("totalAmount"),
            value: (r) =>
              isPriceHidden(r.hidden_fields, "total_price")
                ? ""
                : r.total_amount,
            width: 16,
          },
          {
            header: tfl("currency"),
            value: (r) => r.currency?.code ?? "",
            width: 10,
          },
          {
            header: tfl("buyer"),
            value: (r) => r.audit?.created?.name ?? "",
            width: 22,
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

  const table = usePoTable({
    purchaseOrders,
    totalRecords,
    params,
    tableConfig,
    onEdit: (po) =>
      navigate(`/procurement/purchase-order/${po.id}`, listReturnState()),
    onDelete: setDeleteTarget,
  });

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
          addDisabled={!canCreatePo}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={poFilterFields}
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
              className="hidden items-center gap-2 sm:flex"
            />
          }
        />
      }
    >
      {!isGridMode && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{
            headerSticky: true,
            // คอลัมน์เยอะจนบีบกันแน่นในความกว้างจอ — เปิดตัวนี้แล้ว table ได้
            // width = getTotalSize() (ผลรวม size ที่แต่ละคอลัมน์ประกาศไว้) แทน
            // w-full ที่หารพื้นที่ให้ทุกคอลัมน์เท่าไรก็ได้ ล้นแล้วเลื่อนแนวนอนเอา
            columnsResizable: true,
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
      )}

      {isGridMode && (
        <>
          <PoCardList
            items={purchaseOrders}
            isLoading={useInfiniteScroll ? grid.isLoading : isLoading}
            onEdit={(po) =>
              navigate(
                `/procurement/purchase-order/${po.id}`,
                listReturnState(),
              )
            }
            onDelete={setDeleteTarget}
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

      <Suspense fallback={null}>
        <CreatePODialog open={createOpen} onOpenChange={setCreateOpen} />
      </Suspense>

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deletePo.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { poNo: deleteTarget?.po_no ?? "" })}
        isPending={deletePo.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePo.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
          });
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
