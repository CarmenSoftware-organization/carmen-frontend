import { useElementWidth } from "@/hooks/use-element-width";
import { useState } from "react";
import {
  ArrowRight,
  Columns3,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
import { DataGridColumnVisibility } from "@/components/ui/data-grid/data-grid-column-visibility";
import { DataGridSortMenu } from "@/components/ui/data-grid/data-grid-sort-menu";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCurrencyAll } from "@/hooks/use-currency";
import { useProfile } from "@/hooks/use-profile";
import {
  useExchangeRateQuery,
  useExchangeRateMutation,
  useExternalExchangeRates,
  useExchangeRateDelete,
} from "../shared/use-exchange-rate";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import SearchInput from "@/components/search-input";
import type { ExchangeRateItem, CurrencyWithDiff } from "@/types/exchange-rate";
import EmptyComponent from "@/components/empty-component";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { formatDate } from "@/lib/date-utils";
import { formatExchangeRate } from "@/lib/currency-utils";
import { ExchangeRateDialog } from "./exchange-rate-dialog";
import { useExchangeRateTable } from "./use-exchange-rate-table";
import ExchangeRateCard from "./exchange-rate-card";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { cn } from "@/lib/utils";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { rowNumber } from "@/lib/row-number";

export default function ExchangeRateComponent() {
  const { defaultCurrencyCode, defaultCurrencyDecimalPlaces, dateFormat } =
    useProfile();
  const _rateDecimals = defaultCurrencyDecimalPlaces ?? 4;
  const baseCurrency = defaultCurrencyCode ?? "THB";
  const t = useTranslations("config.exchangeRate");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("edit");
  const [editItem, setEditItem] = useState<ExchangeRateItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ExchangeRateItem | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const isMobile = useIsMobile();

  const deleteRate = useExchangeRateDelete();

  const { params, tableConfig, search, setSearch } = useDataGridState({
    defaultSort: "at_date:desc,currency_code:asc",
  });
  const queryParams = params;

  const isGridMode = isMobile || displayMode === "grid";

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory,
  } = useExchangeRateQuery(queryParams, {
    enabled: !isGridMode,
  });

  const grid = useGridPagination<ExchangeRateItem>({
    useListHook: useExchangeRateQuery,
    params: queryParams,
    enabled: isGridMode,
  });

  const items = isGridMode ? grid.items : (historyData?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (historyData?.paginate?.total ?? 0);

  // --- Currencies (internal) ---
  const { data: currencyData, isLoading: isLoadingCurrencies } =
    useCurrencyAll();

  const { data: externalRates, isRefetching } =
    useExternalExchangeRates(baseCurrency);

  // --- Currency diff ---
  // External API returns "foreign per 1 base" (e.g. base=THB → { USD: 0.028 } means 1 THB = 0.028 USD).
  // We store in direct convention "1 foreign = X base" (e.g. 1 USD = 35.71 THB), so invert before use.
  const currencies = currencyData;
  const currencyWithDiff: CurrencyWithDiff[] =
    !currencies || !externalRates
      ? []
      : currencies
          .filter((c) => c.code !== baseCurrency)
          .map((c) => {
            const oldRate = c.exchange_rate;
            const externalInverse = externalRates[c.code];
            const newRate =
              externalInverse && externalInverse > 0
                ? 1 / externalInverse
                : oldRate;
            const diff = newRate - oldRate;
            const diffPercent = oldRate === 0 ? 0 : (diff / oldRate) * 100;
            return {
              id: c.id,
              code: c.code,
              oldRate,
              newRate,
              diff,
              diffPercent,
            };
          });

  const bulkMutation = useExchangeRateMutation();

  const handleBulkUpdate = () => {
    const payload = currencyWithDiff.map((item) => ({
      currency_id: item.id,
      at_date: new Date().toISOString(),
      exchange_rate: item.newRate,
    }));

    bulkMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(tt("updateSuccess", { entity: t("entity") }));
        setBulkConfirmOpen(false);
      },
    });
  };

  const [setGridBox, gridWidth] = useElementWidth();
  const table = useExchangeRateTable({
    containerWidth: gridWidth == null ? undefined : gridWidth - 2,
    items,
    totalRecords,
    params,
    tableConfig,
    onEdit: (item) => {
      setEditItem(item);
      setDialogMode("edit");
      setDialogOpen(true);
    },
    onDelete: (item) => setDeleteItem(item),
  });

  if (historyError) {
    return <ErrorState error={historyError} onRetry={() => refetchHistory()} />;
  }

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc", { base: baseCurrency })}
      count={totalRecords}
      actions={
        <div className="flex w-full gap-2 *:flex-1 sm:w-auto sm:*:flex-initial">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditItem(null);
              setDialogMode("create");
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            {t("addManual")}
          </Button>
          <Button
            size="sm"
            onClick={() => setBulkConfirmOpen(true)}
            disabled={
              isLoadingCurrencies ||
              isRefetching ||
              bulkMutation.isPending ||
              currencyWithDiff.length === 0
            }
          >
            <RefreshCw
              className={
                isRefetching || bulkMutation.isPending ? "animate-spin" : ""
              }
              aria-hidden="true"
            />
            {bulkMutation.isPending ? t("updating") : t("update")}
          </Button>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
            <div className="flex-1 sm:flex-initial">
              <SearchInput defaultValue={search} onSearch={setSearch} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DataGridSortMenu table={table} />
            {!isGridMode && (
              <DataGridColumnVisibility
                table={table}
                trigger={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={tc("aria.toggleColumns")}
                  >
                    <Columns3 className="size-4" />
                  </Button>
                }
              />
            )}
            {!isMobile && (
              <DisplayModeToggle
                value={displayMode}
                onChange={setDisplayMode}
              />
            )}
          </div>
        </div>
      }
    >
      <div ref={setGridBox} className="@container min-w-0">
        {isGridMode && grid.isLoading && <CardSkeletonGrid />}
        {isGridMode && !grid.isLoading && items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-3 @min-[96rem]:grid-cols-4">
              {items.map((item, i) => (
                <ExchangeRateCard
                  rowNo={rowNumber(undefined, i)}
                  key={item.id}
                  item={item}
                  baseCurrency={baseCurrency}
                  onEdit={(rate) => {
                    setEditItem(rate);
                    setDialogMode("edit");
                    setDialogOpen(true);
                  }}
                  onDelete={(rate) => setDeleteItem(rate)}
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
        {isGridMode && !grid.isLoading && items.length === 0 && (
          <EmptyComponent />
        )}
        {!isGridMode && (
          <DataGrid
            table={table}
            recordCount={totalRecords}
            isLoading={isLoadingHistory}
            tableLayout={{ width: "fixed", headerSticky: true }}
            emptyMessage={<EmptyComponent />}
          >
            <DataGridContainer
              className={cn("flex flex-col", listGridMaxH(false))}
            >
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
              <DataGridPagination sizes={[5, 10, 25, 50, 100]} />
            </DataGridContainer>
          </DataGrid>
        )}
      </div>
      {dialogMode === "create" ? (
        <ExchangeRateDialog
          mode="create"
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      ) : (
        <ExchangeRateDialog
          mode="edit"
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          item={editItem}
        />
      )}

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => {
          if (!open && !deleteRate.isPending) setDeleteItem(null);
        }}
        title={t("entity")}
        description={
          deleteItem
            ? `${deleteItem.currency?.code ?? ""} — ${formatDate(deleteItem.at_date, dateFormat)}`
            : undefined
        }
        onConfirm={() => {
          if (!deleteItem) return;
          deleteRate.mutate(
            { id: deleteItem.id },
            {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                setDeleteItem(null);
              },
            },
          );
        }}
        isPending={deleteRate.isPending}
      />

      <AlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !bulkMutation.isPending) setBulkConfirmOpen(false);
        }}
      >
        <AlertDialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
          <AlertDialogHeader className="relative gap-0 px-5 pt-6 pb-4">
            <div className="flex items-start gap-3">
              <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <RefreshCw className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <AlertDialogTitle className="text-base">
                  {t("update")}
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1">
                  {t("bulkUpdateConfirm", {
                    count: currencyWithDiff.length,
                  })}
                </AlertDialogDescription>
              </div>
              {currencyWithDiff.length > 0 && (
                <Badge
                  variant="primary-light"
                  size="sm"
                  className="mt-0.5 shrink-0 tabular-nums"
                >
                  {currencyWithDiff.length}
                </Badge>
              )}
            </div>
          </AlertDialogHeader>

          <div className="flex min-h-0 flex-1 flex-col border-t">
            {currencyWithDiff.length > 0 && (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <ul className="space-y-2">
                  {currencyWithDiff.map((c) => {
                    const isIncrease = c.diff > 0;
                    const isDecrease = c.diff < 0;
                    const noChange = !isIncrease && !isDecrease;
                    return (
                      <li
                        key={c.id}
                        className="bg-muted/40 flex items-center gap-3 rounded-lg border p-2"
                      >
                        <div
                          className={`bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            noChange
                              ? "text-muted-foreground"
                              : isIncrease
                                ? "text-success-ink"
                                : "text-destructive"
                          }`}
                        >
                          {noChange && <Minus className="size-3.5" />}
                          {isIncrease && <TrendingUp className="size-3.5" />}
                          {isDecrease && <TrendingDown className="size-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              size="xs"
                              className="text-micro-legal"
                            >
                              {c.code}
                            </Badge>
                            <span className="text-muted-foreground text-micro">
                              → {baseCurrency}
                            </span>
                          </div>
                          <div className="text-muted-foreground text-micro mt-0.5 flex items-center gap-1.5 tabular-nums">
                            <span className="line-through">
                              {formatExchangeRate(c.oldRate)}
                            </span>
                            <ArrowRight className="size-3 shrink-0" />
                            <span className="text-foreground font-semibold">
                              {formatExchangeRate(c.newRate)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground text-xs font-bold tabular-nums">
                            {isIncrease && "+"}
                            {formatExchangeRate(c.diff)}
                          </p>
                          {!noChange && (
                            <p className="text-muted-foreground text-micro-legal tabular-nums">
                              {isIncrease ? "+" : ""}
                              {c.diffPercent.toFixed(2)}%
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <AlertDialogFooter className="bg-muted/20 border-t px-5 py-3">
            <AlertDialogCancel disabled={bulkMutation.isPending}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              size="default"
              onClick={(e) => {
                e.preventDefault();
                handleBulkUpdate();
              }}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {bulkMutation.isPending ? t("updating") : tc("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListPageShell>
  );
}
