import { useEffect, useRef, useState } from "react";
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
} from "./document-filter-fields";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";

export default function DocumentComponent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentFile | null>(null);
  const deleteDocument = useDeleteDocument();
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
  const listParams = { ...params, ...documentFiltersToParams(lf.values) };
  const { data, isLoading, error, refetch } = useDocument(listParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<DocumentFile>({
    useListHook: useDocument as Parameters<
      typeof useGridPagination<DocumentFile>
    >[0]["useListHook"],
    params: listParams,
    enabled: useInfiniteScroll,
  });
  const t = useTranslations("systemAdmin.document");
  const tt = useTranslations("toast");

  const documents = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const table = useDocumentTable({
    documents,
    totalRecords,
    params,
    tableConfig,
    onDelete: setDeleteTarget,
  });

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
          tableLayout={{ headerSticky: true }}
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
