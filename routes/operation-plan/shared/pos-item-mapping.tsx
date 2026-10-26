import { useMemo } from "react";
import { Ban, RotateCcw, X } from "lucide-react";
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
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { ErrorState } from "@/components/ui/error-state";
import { LookupRecipe } from "@/components/lookup/lookup-recipe";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { setURLParams, useURL } from "@/hooks/use-url";
import { getUserErrorMessage } from "@/lib/error-message";
import { clampPerpage } from "../import-pos/pos-import-status";
import { PosStoreFilter } from "./pos-store-filter";
import type { PosItem, PosItemStatus } from "@/types/pos-sale";
import { usePosStoreFilter } from "./use-pos-store-filter";
import { usePosWritable } from "./use-pos-writable";
import { usePosItems, useUpdatePosItem } from "./use-pos-sale";

type ItemFilter = "all" | PosItemStatus;

const ITEM_FILTERS: readonly ItemFilter[] = [
  "all",
  "unmapped",
  "mapped",
  "ignored",
];

/**
 * แท็บผูกเมนู POS กับสูตร (Recipe) หรือสั่งไม่นับ (Ignore) — ตาราง server-side pagination (50 ต่อหน้า)
 * เลือกแล้วบันทึกทันที
 *
 * ตัวกรองสถานะ All / Needs mapping / Mapped / Ignored เก็บใน query `?items=` (ค่าเริ่ม = Needs mapping)
 * เปลี่ยนตัวกรองแล้วล้าง `page` ทิ้ง
 *
 * @returns React element ของแท็บ
 */
export function PosItemMapping() {
  "use no memo";
  const t = useTranslations("operationPlan.posSale.items");
  const tErr = useTranslations("errors");
  const { canWrite } = usePosWritable();
  const [filterRaw] = useURL("items");
  const filter: ItemFilter = ITEM_FILTERS.includes(filterRaw as ItemFilter)
    ? (filterRaw as ItemFilter)
    : "unmapped";
  const status = filter === "all" ? undefined : filter;
  const { stores, storeId, setStoreId } = usePosStoreFilter();
  const {
    params: rawParams,
    tableConfig,
    search,
    setSearch,
  } = useDataGridState({ defaultPerpage: 50 });
  const params = { ...rawParams, perpage: clampPerpage(rawParams.perpage, 50) };
  const { data, isLoading, error, refetch } = usePosItems(
    params,
    { storeId, status },
    { enabled: !!storeId },
  );
  const { mutate } = useUpdatePosItem();

  const items = useMemo(() => data?.data ?? [], [data]);
  const totalRecords = data?.paginate?.total ?? 0;

  const onFilterChange = (next: ItemFilter) => {
    setURLParams({ items: next, page: "", search: "" });
  };

  const columns = useMemo<ColumnDef<PosItem>[]>(() => {
    const run = (
      body: { id: string; recipe_id?: string | null; is_ignored?: boolean },
      message: string,
    ) =>
      mutate(body, {
        onSuccess: () => toast.success(message),
        onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
      });
    const save = (id: string, recipeId: string | null) =>
      run({ id, recipe_id: recipeId }, t("saved"));
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
                  disabled={!canWrite || item.is_ignored}
                  onValueChange={(id) => save(item.id, id || null)}
                />
              </div>
              {recipe && canWrite && !item.is_ignored && (
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
              {item.is_ignored && (
                <StatusDotBadge tone="neutral">{t("ignored")}</StatusDotBadge>
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
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const item = row.original;
          if (!canWrite) return null;
          return item.is_ignored ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() =>
                run({ id: item.id, is_ignored: false }, t("unignored"))
              }
            >
              <RotateCcw />
              {t("unignore")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() =>
                run({ id: item.id, is_ignored: true }, t("ignoredSaved"))
              }
            >
              <Ban />
              {t("ignore")}
            </Button>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
    ];
  }, [t, tErr, canWrite, mutate]);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / params.perpage),
  });

  return (
    <div className="space-y-3 pt-4">
      <PosStoreFilter stores={stores} storeId={storeId} onChange={setStoreId} />
      {storeId && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <SearchInput defaultValue={search} onSearch={setSearch} />
            <div
              role="group"
              aria-label={t("filter.label")}
              className="flex flex-wrap items-center gap-1"
            >
              {ITEM_FILTERS.map((f) => (
                <Button
                  key={f}
                  type="button"
                  size="xs"
                  variant={filter === f ? "secondary" : "ghost"}
                  aria-pressed={filter === f}
                  onClick={() => onFilterChange(f)}
                >
                  {t(`filter.${f}`)}
                </Button>
              ))}
            </div>
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
                  title={
                    filter === "unmapped" && !search
                      ? t("allMapped")
                      : undefined
                  }
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
