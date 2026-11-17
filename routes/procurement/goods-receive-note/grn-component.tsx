import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useElementWidth } from "@/hooks/use-element-width";
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
  useGoodsReceiveNote,
  useDeleteGoodsReceiveNote,
  useExportGoodsReceiveNote,
} from "@/hooks/use-goods-receive-note";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { GRN_STATUS_OPTIONS } from "@/constant/goods-receive-note";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { useGrnTable } from "./use-grn-table";
import GrnCardList from "./grn-card-list";
import { GrnInvoiceFilter } from "./grn-invoice-filter";
import EmptyComponent from "@/components/empty-component";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { GrnCreateDialog } from "./grn-create-dialog";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import {
  VENDOR_ENTITY,
  requesterEntity,
} from "@/components/filter/entity-sources";

export default function GrnComponent() {
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GoodsReceiveNote | null>(
    null,
  );
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const useInfiniteScroll = !!isMobile;
  const deleteGrn = useDeleteGoodsReceiveNote();
  const { exportGoodsReceiveNote, isExporting } = useExportGoodsReceiveNote();
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "grn_date:desc",
  });

  const grnFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "grn_status",
        control: "custom",
        labelKey: "common.status",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={GRN_STATUS_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "doc_type",
        control: "multi-select",
        labelKey: "field.type",
        section: "listView.sectionDocument",
        options: [
          {
            labelKey: "field.purchaseOrder",
            value: "doc_type|string:purchase_order",
          },
          { labelKey: "field.manual", value: "doc_type|string:manual" },
        ],
      },
      {
        // ตัวเลือกมาจากใบรับของ (distinct invoice_no) — GrnInvoiceFilter ยิงตอนเปิด
        // popover ทีละหน้าเท่านั้น (ส่วน chip ไม่ต้องรอ fetch: ค่าที่เก็บคือเลขที่จริง
        // ไม่ใช่ id chipValueText จึงอ่านออกเองอยู่แล้ว)
        key: "invoice_no",
        control: "custom",
        labelKey: "field.invoiceNo",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <GrnInvoiceFilter
            value={value}
            onChange={onChange}
            className="w-full"
          />
        ),
      },
      {
        // ช่วงจำนวนเงินรวม — UI ฝั่ง frontend ก่อน เหมือน PR/PO: toClause คืนค่าว่าง
        // ไว้ไม่ให้ clause หลุดไป backend (QueryParams ยังไม่รู้จัก num_range)
        key: "amount",
        control: "amount-range",
        labelKey: "field.totalAmount",
        fieldKey: "total_amount",
        section: "listView.sectionDocument",
        toClause: () => "",
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
        // ผู้รับ = คนคีย์ใบรับของ (คอลัมน์ Received By ใน list) — กรองที่ created_by_id
        key: "received_by",
        control: "entity",
        entity: requesterEntity("created_by_id"),
        labelKey: "field.receivedBy",
        section: "listView.sectionPeople",
      },
      {
        key: "grn_date",
        control: "date-range",
        labelKey: "field.grnDate",
        fieldKey: "grn_date",
        section: "listView.sectionDate",
      },
      {
        key: "invoice_date",
        control: "date-range",
        labelKey: "field.invoiceDate",
        fieldKey: "invoice_date",
        section: "listView.sectionDate",
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.GOODS_RECEIVE_NOTE,
    fields: grnFilterFields,
    defaultSort: "grn_date:desc",
  });

  const queryParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useGoodsReceiveNote(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<GoodsReceiveNote>({
    useListHook: useGoodsReceiveNote,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const goodsReceiveNotes = useInfiniteScroll ? grid.items : (data?.data ?? []);

  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportGoodsReceiveNote({
        params: queryParams,
        columns: [
          { header: tfl("grnNo"), value: (r) => r.grn_no, width: 22 },
          {
            header: tfl("vendor"),
            value: (r) => r.vendor_name ?? "",
            width: 26,
          },
          {
            header: tfl("grnDate"),
            value: (r) => r.grn_date ?? "",
            width: 12,
          },
          {
            header: tfl("invoiceNo"),
            value: (r) => r.invoice_no ?? "",
            width: 16,
          },
          {
            header: tfl("invoiceDate"),
            value: (r) => r.invoice_date ?? "",
            width: 12,
          },
          { header: tfl("status"), value: (r) => r.doc_status, width: 14 },
          { header: tfl("type"), value: (r) => r.doc_type, width: 16 },
          {
            header: tfl("totalAmount"),
            value: (r) => r.total_amount ?? 0,
            width: 16,
          },
          {
            header: tfl("currency"),
            value: (r) => r.currency?.code ?? "",
            width: 10,
          },
          {
            header: tfl("receivedBy"),
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

  const handleSelectDocType = (docType: string) => {
    setShowCreateDialog(false);
    if (docType === "purchase_order") {
      navigate("/procurement/goods-receive-note/from-po", listReturnState());
    } else {
      navigate(
        `/procurement/goods-receive-note/new?doc_type=${docType}`,
        listReturnState(),
      );
    }
  };

  // ลบขอบ 1px สองข้างของ DataGridContainer ออก ได้ความกว้างที่ตารางใช้จริง
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const table = useGrnTable({
    containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2,
    goodsReceiveNotes,
    totalRecords,
    params,
    tableConfig,
    onEdit: (grn) =>
      navigate(`/procurement/goods-receive-note/${grn.id}`, listReturnState()),
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
          onAdd={() => setShowCreateDialog(true)}
          addLabel={t("add")}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={grnFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {!isGridMode && (
        <div ref={setGridBox}>
          <DataGrid
            table={table}
            recordCount={totalRecords}
            isLoading={isLoading}
            tableLayout={{ headerSticky: true }}
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

      {isGridMode && useInfiniteScroll && (
        <>
          <GrnCardList
            items={goodsReceiveNotes}
            isLoading={grid.isLoading}
            onEdit={(grn) =>
              navigate(
                `/procurement/goods-receive-note/${grn.id}`,
                listReturnState(),
              )
            }
            onDelete={setDeleteTarget}
          />
          {grid.hasMore && (
            <div ref={grid.sentinelRef} className="flex justify-center py-4">
              {grid.isLoadingMore && (
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              )}
            </div>
          )}
        </>
      )}

      {isGridMode && !useInfiniteScroll && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true }}
        >
          <DataGridContainer
            // โหมดการ์ด: กล่องนอกไม่ใช่การ์ด เป็นแค่ตัวคุมพื้นที่เลื่อนกับแถบ
            // แบ่งหน้า — ทา `bg-card` ทับการ์ดที่เป็น `bg-card` อยู่แล้วเมื่อไร
            // ก็กลายเป็นการ์ดซ้อนการ์ดที่แยกกันไม่ออก
            border={false}
            className={cn(
              "flex flex-col",
              listGridMaxH(lf.activeFilters.length > 0),
            )}
          >
            <div className="flex-1 overflow-auto">
              <GrnCardList
                items={goodsReceiveNotes}
                isLoading={isLoading}
                onEdit={(grn) =>
                  navigate(
                    `/procurement/goods-receive-note/${grn.id}`,
                    listReturnState(),
                  )
                }
                onDelete={setDeleteTarget}
              />
            </div>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}

      <GrnCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSelect={handleSelectDocType}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteGrn.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { grnNo: deleteTarget?.grn_no ?? "" })}
        isPending={deleteGrn.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteGrn.mutate(deleteTarget.id, {
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
