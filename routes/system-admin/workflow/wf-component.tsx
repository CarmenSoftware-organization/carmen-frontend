import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  WORKFLOW_LIST_HOOKS,
  type WorkflowDocType,
} from "@/hooks/use-workflow";
import { useDeleteWorkflow } from "./use-wf-mutations";
import type { WorkflowDto } from "@/types/workflows";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import WfCard from "./wf-card";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { useWfTable } from "./use-wf-table";
import { useWfRowMutations } from "./use-wf-row-mutations";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { cn } from "@/lib/utils";
import { DocumentListActions } from "@/components/share/document-list-actions";
import SearchInput from "@/components/search-input";

interface WorkflowComponentProps {
  readonly docType: WorkflowDocType;
}

const TITLE_KEY: Record<WorkflowDocType, string> = {
  "purchase-request": "titlePurchaseRequest",
  "purchase-order": "titlePurchaseOrder",
  "store-requisition": "titleStoreRequisition",
  "journal-voucher": "titleJournalVoucher",
};

export default function WorkflowComponent({ docType }: WorkflowComponentProps) {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<WorkflowDto | null>(null);
  const deleteWorkflow = useDeleteWorkflow();
  const isMobile = useIsMobile();
  const t = useTranslations("systemAdmin.workflow");
  const tt = useTranslations("toast");
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const { pendingId, toggleActive, duplicate } = useWfRowMutations();

  const combinedParams = params;

  const useInfiniteScroll = !!isMobile;
  // ยิง endpoint ของชนิดนั้นตรง ๆ ไม่ใช่ดึงทั้งหมดมากรองทีหลัง (docType มาจาก
  // route จึงคงที่ตลอดอายุหน้า ลำดับ hook ไม่สลับ)
  const useListHook = WORKFLOW_LIST_HOOKS[docType];
  const { data, isLoading, error, refetch } = useListHook(combinedParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<WorkflowDto>({
    useListHook,
    params: combinedParams,
    enabled: useInfiniteScroll,
  });

  const workflows = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const table = useWfTable({
    workflows,
    totalRecords,
    params,
    tableConfig,
    onEdit: (workflow) =>
      navigate(`/system-admin/workflow/${workflow.id}`, listReturnState()),
    onDelete: setDeleteTarget,
    onToggleActive: toggleActive,
    onDuplicate: duplicate,
    pendingId,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t(TITLE_KEY[docType])}
      description={t("desc")}
      count={totalRecords}
      actions={
        <DocumentListActions
          onAdd={() =>
            navigate(
              `/system-admin/workflow/new?type=${docType}`,
              listReturnState(),
            )
          }
          addLabel={t("newWorkflow")}
          hideExportPrint
        />
      }
      toolbar={<SearchInput defaultValue={search} onSearch={setSearch} />}
    >
      {isMobile && grid.isLoading && <CardSkeletonGrid />}
      {isMobile && !grid.isLoading && grid.error && (
        <ErrorState
          message={grid.error.message}
          onRetry={() => grid.refetch?.()}
        />
      )}
      {isMobile && !grid.isLoading && !grid.error && workflows.length === 0 && (
        <EmptyComponent />
      )}
      {isMobile && !grid.isLoading && !grid.error && workflows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3">
            {workflows.map((wf, i) => (
              <WfCard
                key={wf.id}
                item={wf}
                index={i}
                onEdit={(w) =>
                  navigate(`/system-admin/workflow/${w.id}`, listReturnState())
                }
                onToggleActive={toggleActive}
                onDuplicate={duplicate}
                onDelete={setDeleteTarget}
                isPending={pendingId === wf.id}
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
      )}
      {!isMobile && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true }}
          emptyMessage={<EmptyComponent />}
        >
          <DataGridContainer
            className={cn("flex flex-col", listGridMaxH(false))}
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
          !open && !deleteWorkflow.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deleteWorkflow.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteWorkflow.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
          });
        }}
      />
    </ListPageShell>
  );
}
