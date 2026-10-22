import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { ErrorState } from "@/components/ui/error-state";
import { LookupRecipe } from "@/components/lookup/lookup-recipe";
import { useCan } from "@/hooks/use-can";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { getUserErrorMessage } from "@/lib/error-message";
import { PosStoreFilter } from "./pos-store-filter";
import type { PosBrand, PosItem } from "./pos-sale-types";
import { usePosStoreFilter } from "./use-pos-store-filter";
import { usePosItems, useUpdatePosItem } from "./use-pos-sale";

/**
 * แท็บผูกเมนู POS กับสูตร (Recipe) — ตาราง server-side pagination (50 ต่อหน้า) เลือกแล้วบันทึกทันที
 *
 * ค่าเริ่มกรองเฉพาะเมนูที่ยังไม่ผูก เก็บใน query `?unmapped=` (`0` = ปิดตัวกรอง)
 * เปลี่ยนตัวกรองแล้วล้าง `page` ทิ้ง
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns React element ของแท็บ
 */
export function PosItemMapping({ brand }: { brand: PosBrand }) {
  "use no memo";
  const t = useTranslations("systemAdmin.interface.posSale.items");
  const tErr = useTranslations("errors");
  const { canWrite } = useCan();
  const [urlParams, setUrlParams] = useSearchParams();
  const unmapped = urlParams.get("unmapped") !== "0";
  const { stores, storeId, setStoreId } = usePosStoreFilter(brand);
  const { params, tableConfig, search, setSearch } = useDataGridState({
    defaultPerpage: 50,
  });
  const { data, isLoading, error, refetch } = usePosItems(
    params,
    { storeId, unmapped },
    { enabled: !!storeId },
  );
  const { mutate } = useUpdatePosItem();

  const items = useMemo(() => data?.data ?? [], [data]);
  const totalRecords = data?.paginate?.total ?? 0;

  const onUnmappedChange = (next: boolean) => {
    setUrlParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.delete("unmapped");
        else p.set("unmapped", "0");
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  const columns = useMemo<ColumnDef<PosItem>[]>(() => {
    const save = (id: string, recipeId: string | null) =>
      mutate(
        { id, recipe_id: recipeId },
        {
          onSuccess: () => toast.success(t("saved")),
          onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
        },
      );
    return [
      {
        id: "code",
        header: t("columns.code"),
        cell: ({ row }) => row.original.code,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "desc1",
        header: t("columns.desc1"),
        cell: ({ row }) => row.original.desc1,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "desc2",
        header: t("columns.desc2"),
        cell: ({ row }) => row.original.desc2 ?? "",
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "department_code",
        header: t("columns.department"),
        cell: ({ row }) => row.original.department_code ?? "",
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "recipe",
        header: t("columns.recipe"),
        cell: ({ row }) => {
          const item = row.original;
          const recipe = item.recipe;
          return (
            <div className="flex items-center gap-2">
              <div className="w-72">
                <LookupRecipe
                  size="xs"
                  value={recipe?.id ?? ""}
                  defaultLabel={
                    recipe ? `${recipe.code} · ${recipe.name}` : undefined
                  }
                  disabled={!canWrite}
                  onValueChange={(id) => save(item.id, id || null)}
                />
              </div>
              {recipe && canWrite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={t("clear")}
                  onClick={() => save(item.id, null)}
                >
                  <X />
                </Button>
              )}
              {recipe?.is_active === false && (
                <span className="text-destructive text-xs">
                  {t("recipeInactive")}
                </span>
              )}
            </div>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
    ];
  }, [t, tErr, canWrite, mutate]);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (params.perpage as number)),
  });

  return (
    <div className="space-y-3 pt-4">
      <PosStoreFilter stores={stores} storeId={storeId} onChange={setStoreId} />
      {storeId && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <SearchInput defaultValue={search} onSearch={setSearch} />
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={unmapped} onCheckedChange={onUnmappedChange} />
              {t("unmappedOnly")}
            </label>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : (
            <DataGrid
              table={table}
              recordCount={totalRecords}
              isLoading={isLoading}
              tableLayout={{ headerSticky: true }}
              emptyMessage={
                <EmptyComponent
                  title={unmapped && !search ? t("allMapped") : undefined}
                />
              }
            >
              <DataGridContainer className="flex flex-col">
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
                <DataGridPagination sizes={[20, 50, 100]} />
              </DataGridContainer>
            </DataGrid>
          )}
        </>
      )}
    </div>
  );
}
