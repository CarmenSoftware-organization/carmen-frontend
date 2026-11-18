import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { useRole, useDeleteRole } from "../shared/use-role";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { Loader2 } from "lucide-react";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Role } from "@/types/role";
import SearchInput from "@/components/search-input";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import RoleCard from "./role-card";
import { useRoleTable } from "./use-role-table";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { cn } from "@/lib/utils";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { rowNumber } from "@/lib/row-number";

export default function RoleComponent() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const deleteRole = useDeleteRole();
  const isMobile = useIsMobile();
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const useInfiniteScroll = !!isMobile;
  const { data, isLoading, error, refetch } = useRole(params, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<Role>({
    useListHook: useRole,
    params,
    enabled: useInfiniteScroll,
  });
  const t = useTranslations("systemAdmin.role");
  const tt = useTranslations("toast");

  const items = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const table = useRoleTable({
    items,
    totalRecords,
    params,
    tableConfig,
    onEdit: (item) =>
      navigate(`/system-admin/role/${item.id}`, listReturnState()),
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
          onAdd={() => navigate("/system-admin/role/new", listReturnState())}
          addLabel={t("add")}
          hideExportPrint
        />
      }
      toolbar={
        <div className="flex w-full items-center gap-2">
          <div className="flex-1">
            <SearchInput defaultValue={search} onSearch={setSearch} />
          </div>
        </div>
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
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              {items.map((item, i) => (
                <RoleCard
                  rowNo={rowNumber(useInfiniteScroll ? undefined : params, i)}
                  key={item.id}
                  item={item}
                  onEdit={(r) =>
                    navigate(`/system-admin/role/${r.id}`, listReturnState())
                  }
                  onDelete={setDeleteTarget}
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
          !open && !deleteRole.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deleteRole.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRole.mutate(deleteTarget.id, {
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
