import { useEffect, useRef, useState } from "react";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { Button } from "@/components/ui/button";
import {
  useDocument,
  useDocumentSummary,
  useUploadDocument,
  useDeleteDocument,
  useBulkDeleteDocuments,
} from "./use-document";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import DocumentCard from "./document-card";
import DocumentSummaryBar from "./document-summary-bar";
import DocumentSummarySheet from "./document-summary-sheet";
import type { DocumentFile } from "@/types/document";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { cn } from "@/lib/utils";
import { useDocumentTable } from "./use-document-table";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import {
  DOCUMENT_FILTER_FIELDS,
  documentFiltersToParams,
  documentListParamsToBulkFilter,
} from "./document-filter-fields";
import { DocumentSelectionBar } from "./document-selection-bar";
import { DocumentBulkDeleteDialog } from "./document-bulk-delete-dialog";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { ApiError } from "@/lib/api-error";
import { getUserErrorMessage } from "@/lib/error-message";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";

export default function DocumentComponent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentFile | null>(null);
  const deleteDocument = useDeleteDocument();
  const bulkDelete = useBulkDeleteDocuments();
  const deleteGate = useDeleteGate();
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkError, setBulkError] = useState<string | undefined>();
  // การเลือกผูกกับชุดตัวกรอง: key เปลี่ยน = ชุดผลลัพธ์เปลี่ยน → การเลือกเดิมเลิกใช้ (derive ตอน render
  // ไม่ใช้ effect) sizes เก็บขนาดต่อ token เพื่อให้ยอดรวมถูกแม้เลือกข้ามหน้า
  const [sel, setSel] = useState<{
    key: string;
    sizes: Record<string, number>;
    allMatching: boolean;
  }>({ key: "", sizes: {}, allMatching: false });
  const uploadDocument = useUploadDocument();
  const isMobile = useIsMobile();
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);
  const { data: summary, isLoading: isSummaryLoading } = useDocumentSummary();
  const hasSummary = !!summary && summary.total_count > 0;
  // ช่องแถบสรุปถือว่า "มีของ" ตั้งแต่ตอนโหลด (มี skeleton แสดงอยู่) ไม่ใช่แค่ตอนมีข้อมูลจริง
  // ใช้ค่านี้กับ max-h ของตารางเท่านั้น ส่วน Sheet ยังต้องใช้ hasSummary เพราะต้องการข้อมูลจริง
  const summarySlotVisible = hasSummary || isSummaryLoading;

  // สลับ BU แล้ว summary หายไปกลางอากาศ (query key เปลี่ยน) ทำให้ Sheet unmount โดยไม่เคยเรียก
  // onOpenChange(false) — ถ้าไม่รีเซ็ตตรงนี้ summarySheetOpen จะค้างเป็น true แล้วพอสลับไป BU
  // ที่มีไฟล์ Sheet จะเด้งเปิดเองโดยไม่มีใครกด
  useEffect(() => {
    if (!hasSummary) setSummarySheetOpen(false);
  }, [hasSummary]);
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const useInfiniteScroll = !!isMobile;
  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.DOCUMENT,
    fields: DOCUMENT_FILTER_FIELDS,
  });
  // ตัวกรองทั้งหมดส่งให้ server (reference_types / content_kinds / created_before) เพื่อให้
  // จำนวนหน้าและยอดรวมตรงกับแถวที่เห็น — ไม่กรองฝั่ง client อีกแล้ว
  // เรียกทุก render โดยตั้งใจ: lf.values เปลี่ยน reference เมื่อ URL เปลี่ยน, setter ห้ามอยู่ใน deps
  // sort: undefined - micro-file เรียง created_at DESC เสมอ ไม่รองรับ sort (ทุกคอลัมน์ปิด sort)
  const listParams = {
    ...params,
    sort: undefined,
    ...documentFiltersToParams(lf.values),
  };
  const { data, isLoading, isFetching, error, refetch } = useDocument(
    listParams,
    {
      enabled: !useInfiniteScroll,
    },
  );

  const grid = useGridPagination<DocumentFile>({
    useListHook: useDocument as Parameters<
      typeof useGridPagination<DocumentFile>
    >[0]["useListHook"],
    params: listParams,
    enabled: useInfiniteScroll,
  });
  const t = useTranslations("systemAdmin.document");
  const tt = useTranslations("toast");
  const terr = useTranslations("errors");

  const documents = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const filterKey = JSON.stringify([
    listParams.search,
    listParams.reference_types,
    listParams.content_kinds,
    listParams.include_unreferenced,
    listParams.created_before,
  ]);
  const selSizes = sel.key === filterKey ? sel.sizes : {};
  const allMatching = sel.key === filterKey && sel.allMatching;
  const selectedTokens = Object.keys(selSizes);
  const selectedSize = Object.values(selSizes).reduce((a, b) => a + b, 0);
  const matchingSize = data?.paginate?.total_size ?? 0;
  const rowSelection: RowSelectionState = Object.fromEntries(
    selectedTokens.map((k) => [k, true]),
  );

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next =
      typeof updater === "function" ? updater(rowSelection) : updater;
    const pageSizes = new Map(documents.map((d) => [d.fileToken, d.size]));
    const sizes: Record<string, number> = {};
    for (const id of Object.keys(next)) {
      if (next[id]) sizes[id] = pageSizes.get(id) ?? selSizes[id] ?? 0;
    }
    // ติ๊กออกเองหลังเลือกทั้งหมด = ออกจากโหมดตัวกรอง (จำนวนที่จะลบต้องตรงกับที่เห็น)
    setSel({ key: filterKey, sizes, allMatching: false });
  };
  const clearSelection = () =>
    setSel({ key: filterKey, sizes: {}, allMatching: false });

  const table = useDocumentTable({
    documents,
    totalRecords,
    params,
    tableConfig,
    onDelete: setDeleteTarget,
    rowSelection,
    onRowSelectionChange,
  });

  const bulkCount = allMatching ? totalRecords : selectedTokens.length;
  const bulkSize = allMatching ? matchingSize : selectedSize;
  const showSelectionBar =
    !isMobile &&
    !deleteGate.deleteDenied &&
    (selectedTokens.length > 0 || allMatching);

  const confirmBulkDelete = () => {
    // โหมดตัวกรองส่ง expected_count เสมอ (server บังคับ) = จำนวนที่ผู้ใช้เห็นในกล่องตอนกดยืนยัน
    const variables = allMatching
      ? {
          filter: documentListParamsToBulkFilter(listParams),
          expected_count: totalRecords,
        }
      : { file_tokens: selectedTokens };
    setBulkError(undefined);
    bulkDelete.mutate(variables, {
      onSuccess: (result) => {
        setBulkDialogOpen(false);
        clearSelection();
        if (result.failed.length === 0) {
          toast.success(t("bulkDeleteSuccess", { count: result.deleted }));
          return;
        }
        const shown = result.failed.slice(0, 5);
        toast.warning(
          t("bulkDeletePartial", {
            deleted: result.deleted,
            failed: result.failed.length,
          }),
          {
            description: (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {shown.map((f) => (
                  <li key={f.fileToken}>
                    <span className="font-medium">{f.fileName}</span>
                    {" — "}
                    {t.has(`bulkReason.${f.reason}`)
                      ? t(`bulkReason.${f.reason}`)
                      : t("bulkDeleteFailed")}
                  </li>
                ))}
                {result.failed.length > shown.length && (
                  <li>
                    {t("bulkDeleteMore", {
                      count: result.failed.length - shown.length,
                    })}
                  </li>
                )}
              </ul>
            ),
            duration: 15000,
          },
        );
      },
      // 409 (จำนวนเปลี่ยน) / 422 (เกินเพดาน): คงกล่องไว้ + แสดงข้อความ — onSettled ของ hook
      // refetch รายการแล้ว totalRecords จึงเป็นจำนวนใหม่ที่จะถูกส่งเป็น expected_count รอบหน้า
      onError: (err) => {
        setBulkError(
          err instanceof ApiError
            ? getUserErrorMessage(err, terr)
            : t("bulkDeleteFailed"),
        );
      },
    });
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.warning(t("fileSizeLimit"));
      e.target.value = "";
      return;
    }
    uploadDocument.mutate(file, {
      onSuccess: () => toast.success(t("uploadSuccess")),
    });
    e.target.value = "";
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full items-center gap-2 *:flex-1 sm:w-auto sm:*:flex-initial">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.handleUpload,.docx,.xls,.xlsx,.csv,.txt"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadDocument.isPending}
          >
            <Upload />
            {uploadDocument.isPending ? t("uploading") : t("upload")}
          </Button>
        </div>
      }
      toolbar={
        <>
          <DocumentSummaryBar
            summary={summary}
            isLoading={isSummaryLoading}
            onViewAll={() => setSummarySheetOpen(true)}
          />

          <ListToolbar
            variant="row"
            search={search}
            onSearch={setSearch}
            lf={lf}
            fields={DOCUMENT_FILTER_FIELDS}
            onSaveViewClick={() => setSaveViewDialogOpen(true)}
          />

          {showSelectionBar && (
            <DocumentSelectionBar
              selectedCount={selectedTokens.length}
              selectedSize={selectedSize}
              matchingCount={totalRecords}
              matchingSize={matchingSize}
              allMatching={allMatching}
              onSelectAllMatching={() =>
                setSel({ key: filterKey, sizes: selSizes, allMatching: true })
              }
              onClear={clearSelection}
              onDelete={() => {
                setBulkError(undefined);
                setBulkDialogOpen(true);
              }}
              deleteDisabled={deleteGate.writeDisabled}
              deleteDisabledTitle={deleteGate.writeDisabledTitle}
            />
          )}
        </>
      }
    >
      {isMobile ? (
        grid.isLoading ? (
          <CardSkeletonGrid />
        ) : grid.error ? (
          <ErrorState
            message={grid.error.message}
            onRetry={() => grid.refetch?.()}
          />
        ) : documents.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              {documents.map((doc, i) => (
                <DocumentCard key={doc.fileToken} item={doc} index={i} />
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
        ) : (
          <EmptyComponent />
        )
      ) : (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          // checkbox: true จำเป็น — DataGridTable ซ่อนคอลัมน์ id "select" ถ้าไม่เปิด (bulk delete ใช้ไม่ได้)
          tableLayout={{ headerSticky: true, checkbox: true }}
          emptyMessage={<EmptyComponent />}
        >
          <DataGridContainer
            className={cn(
              "flex flex-col",
              // แถบสรุปสูงประมาณ 4rem รวมช่องไฟ (ทั้ง skeleton ตอนโหลดและแถบจริง) — สี่เคส
              // ตามว่าช่องแถบสรุปมีของ (summarySlotVisible: กำลังโหลดหรือมีข้อมูลแล้ว) และมี
              // active filter หรือไม่ ใช้ summarySlotVisible ไม่ใช่ hasSummary เพราะถ้ารอข้อมูล
              // จริงก่อนค่อยเผื่อพื้นที่ ตารางจะกระตุกตอน skeleton สลับเป็นแถบจริง
              summarySlotVisible
                ? lf.activeFilters.length > 0
                  ? "max-h-[calc(100vh-17rem-3rem)]"
                  : "max-h-[calc(100vh-14rem-3rem)]"
                : listGridMaxH(lf.activeFilters.length > 0),
            )}
          >
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteDocument.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", {
          name: deleteTarget?.originalName ?? "",
        })}
        isPending={deleteDocument.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteDocument.mutate(deleteTarget.fileToken, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
          });
        }}
      />

      <DocumentBulkDeleteDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        count={bulkCount}
        size={bulkSize}
        isPending={bulkDelete.isPending}
        confirmDisabled={isFetching}
        error={bulkError}
        onConfirm={confirmBulkDelete}
      />

      {hasSummary && (
        <DocumentSummarySheet
          open={summarySheetOpen}
          onOpenChange={setSummarySheetOpen}
          summary={summary}
        />
      )}

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
