import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { Package, RefreshCw, Save, SendHorizontal } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/ui/error-state";
import SearchInput from "@/components/search-input";
import { useErrorToast } from "@/hooks/use-error-toast";
import {
  useReviewSpotCheck,
  useSaveSpotCheck,
  useSpotCheckById,
} from "./use-sc";
import { useUnit } from "@/hooks/use-unit";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Unit } from "@/types/unit";
import { cn } from "@/lib/utils";
import { CalculatorDialog } from "../shared/calculator-dialog";
import { EntryImportDialog } from "../shared/entry-import-dialog";
import { AnimationStyles } from "@/components/share/reveal";
import { ItemListSkeleton } from "../shared/inv-shared";
import { EntryItemRow } from "../shared/entry-item-row";
import { ScEntryHeader } from "./sc-entry-header";
import { ScEntryNotesDialog } from "./sc-entry-notes-dialog";
import { EntryToolbar } from "../shared/entry-toolbar";
import { EntrySheetHeader } from "../shared/entry-sheet-header";
import { useEntryAdvance } from "../shared/use-entry-advance";
import { SC_LIST_PATHS } from "./sc-paths";

interface ScEntryComponentProps {
  readonly spotCheckId: string;
}

type CountFilter = "all" | "counted" | "uncounted";

const ROW_ESTIMATE = 53; // px ของแถวใบนับหนึ่งแถว (รวม border-b) — มีโน้ตจะสูงขึ้น วัดจริงด้วย measureElement

export function ScEntryComponent({ spotCheckId }: ScEntryComponentProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(SC_LIST_PATHS);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [countFilter, setCountFilter] = useState<CountFilter>("all");
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [calcItem, setCalcItem] = useState<{
    id: string;
    productId: string;
    name: string;
    unit: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const errorToast = useErrorToast();

  const {
    data: spotCheck,
    isLoading,
    error,
    refetch,
  } = useSpotCheckById(spotCheckId);
  const saveSc = useSaveSpotCheck(spotCheckId);
  const reviewSc = useReviewSpotCheck(spotCheckId);

  // Debounce search 200ms
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const deferredSearch = useDeferredValue(search);
  const deferredFilter = useDeferredValue(countFilter);

  const details = spotCheck?.tb_spot_check_detail ?? [];

  // ชื่อหน่วยเฉพาะที่แถวในใบนี้อ้างถึง (ดึงตาม id) — ไม่ลากทะเบียนหน่วยทั้ง BU
  const { items: units } = useEntitiesByIds<Unit>({
    useListHook: useUnit,
    ids: details.map((d) => d.inventory_unit_id),
  });
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  // Counted = มี qty > 0 (0 = ยังไม่ได้นับ — ทำให้สลับ 1 → 0 ลด progress ได้)
  const isCountedFn = (detail: (typeof details)[number]) => {
    const eff = detail.id in counts ? counts[detail.id] : detail.actual_qty;
    return eff != null && eff > 0;
  };

  const totalItems = details.length;
  const countedCount = details.filter(isCountedFn).length;
  const uncountedCount = totalItems - countedCount;
  const percent =
    totalItems > 0 ? Math.round((countedCount / totalItems) * 100) : 0;

  const filtered = (() => {
    const q = deferredSearch.trim().toLowerCase();
    const result: typeof details = [];
    for (const d of details) {
      if (q) {
        const hay =
          `${d.product_name} ${d.product_code} ${d.product_sku} ${d.product_local_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const counted = isCountedFn(d);
      if (deferredFilter === "counted" && !counted) continue;
      if (deferredFilter === "uncounted" && counted) continue;
      result.push(d);
    }
    return result;
  })();

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 6,
    getItemKey: (i) => filtered[i]?.id ?? i,
  });
  const handleAdvance = useEntryAdvance(filtered, rowVirtualizer, scrollRef);
  // เปลี่ยนตัวกรอง/คำค้น → กลับไปบนสุด ไม่งั้นรายการใหม่ค้างอยู่ที่ระยะเลื่อนเดิม (กลางรายการ)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [deferredFilter, deferredSearch]);
  const virtualItems = rowVirtualizer.getVirtualItems();

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const handleCommitCount = (id: string, value: number | null) => {
    setCounts((prev) => {
      if (prev[id] === value) return prev;
      return { ...prev, [id]: value };
    });
  };

  const handleOpenCalc = (item: {
    id: string;
    productId: string;
    name: string;
    unit: string;
  }) => {
    setCalcItem(item);
  };

  const handleSetUncountedToZero = () => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const d of details) {
        if (!isCountedFn(d)) next[d.id] = 0;
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success(t("productsRefreshed"));
    } catch (err) {
      errorToast(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = async () => {
    const XLSX = await import("xlsx");
    const rows = details.map((d) => {
      const eff = d.id in counts ? counts[d.id] : d.actual_qty;
      return {
        id: d.id,
        product_code: d.product_code,
        product_name: d.product_name,
        product_local_name: d.product_local_name,
        product_sku: d.product_sku,
        inventory_unit_name: unitNameById.get(d.inventory_unit_id) ?? "",
        actual_qty: eff ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [
        "id",
        "product_code",
        "product_name",
        "product_local_name",
        "product_sku",
        "inventory_unit_name",
        "actual_qty",
      ],
    });
    ws["!cols"] = [
      { wch: 36 },
      { wch: 14 },
      { wch: 32 },
      { wch: 32 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Counts");
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeLoc = (spotCheck?.location_code || "location").replaceAll(
      /[^\w-]/g,
      "_",
    );
    const fileName = t("exportFileName", { location: safeLoc, date: dateStr });
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    toast.success(t("exportSuccess", { count: rows.length }));
  };

  const handleApplyImport = (payload: {
    matched: number;
    total: number;
    skipped: number;
    updates: Record<string, number | null>;
  }) => {
    setCounts((prev) => ({ ...prev, ...payload.updates }));
    if (payload.skipped > 0) {
      toast.success(
        t("importPartialMatch", {
          matched: payload.matched,
          total: payload.total,
          skipped: payload.skipped,
        }),
      );
    } else {
      toast.success(
        t("importSuccess", {
          matched: payload.matched,
          total: payload.total,
        }),
      );
    }
  };

  const importItemRefs = details.map((d) => ({
    id: d.id,
    product_sku: d.product_sku,
  }));

  const handleSave = () => {
    // เก็บเฉพาะ items ที่ counted (มี local edit หรือ counted_at อยู่แล้ว)
    const saveItems: { id: string; actual_qty: number }[] = [];
    for (const d of details) {
      const eff = d.id in counts ? counts[d.id] : d.actual_qty;
      if (eff != null) saveItems.push({ id: d.id, actual_qty: eff });
    }

    saveSc.mutate(
      { doc_version: spotCheck?.doc_version, items: saveItems },
      {
        onSuccess: () => {
          toast.success(t("saveSuccess"));
          toList();
        },
      },
    );
  };

  const handleSubmitReview = () => {
    const submitItems: { id: string; actual_qty: number }[] = [];
    for (const d of details) {
      const eff = d.id in counts ? counts[d.id] : d.actual_qty;
      if (eff != null) submitItems.push({ id: d.id, actual_qty: eff });
    }

    reviewSc.mutate(
      { doc_version: spotCheck?.doc_version, items: submitItems },
      {
        onSuccess: (res) => {
          toast.success(t("submitReviewSuccess"));
          const newId =
            (res as { data?: { id?: string } } | undefined)?.data?.id ??
            spotCheckId;
          navigate(
            `/inventory-management/spot-check/${newId}/review`,
            returnState,
          );
        },
      },
    );
  };

  const locationName = spotCheck?.location_name ?? "";
  const locationCode = spotCheck?.location_code ?? "";

  return (
    <div className="relative isolate -mx-3 -my-3 h-[calc(100%+1.5rem)]">
      <AnimationStyles />
      <div className="relative flex h-full flex-col px-4 pt-4 lg:px-4">
        <ScEntryHeader
          locationName={locationName}
          locationCode={locationCode}
          docStatus={spotCheck?.doc_status}
          method={spotCheck?.method}
          startDate={spotCheck?.start_date ?? null}
          countedCount={countedCount}
          totalItems={totalItems}
          percent={percent}
        />

        {/* ── Search + refresh ─────────── */}
        <div className="mb-3 flex w-full items-center gap-2">
          <div className="flex-1 [&>div]:w-full">
            <SearchInput
              defaultValue={searchInput}
              onSearch={setSearchInput}
              onInputChange={setSearchInput}
              containerClassName="w-full"
              inputClassName="border-border/40 hover:border-foreground/50 focus-visible:border-primary bg-card h-9 rounded-lg border pr-9 text-sm shadow-none transition-colors focus-visible:ring-0"
            />
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("refreshProducts")}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-border/40 bg-card hover:bg-card/80 size-9 rounded-lg"
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>

        <EntryToolbar
          translationNamespace="inventoryManagement.spotCheck"
          countFilter={countFilter}
          onFilterChange={setCountFilter}
          totalItems={totalItems}
          countedCount={countedCount}
          uncountedCount={uncountedCount}
          onImportClick={() => setImportOpen(true)}
          onExportClick={handleExport}
          importDisabled={totalItems === 0}
          exportDisabled={totalItems === 0}
        />

        {/* ── Virtualized item list ─────────── */}
        <div className="mb-3 min-h-0 flex-1">
          {isLoading && <ItemListSkeleton count={5} />}
          {!isLoading && filtered.length === 0 && totalItems > 0 && (
            <div className="border-border/40 bg-card flex items-center justify-center gap-2 rounded-xl border border-dashed py-8">
              <Package className="text-muted-foreground/60 size-4" />
              <span className="text-muted-foreground text-xs">
                {t("noItemsMatch")}
              </span>
            </div>
          )}
          {!isLoading && filtered.length === 0 && totalItems === 0 && (
            <div className="border-border/40 bg-card flex items-center justify-center gap-2 rounded-xl border border-dashed py-8">
              <Package className="text-muted-foreground/60 size-4" />
              <span className="text-muted-foreground text-xs">
                {t("noItems")}
              </span>
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border">
              <EntrySheetHeader translationNamespace="inventoryManagement.spotCheck" />
              <div
                ref={scrollRef}
                className="contain:strict relative min-h-0 flex-1 overflow-auto"
              >
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    position: "relative",
                  }}
                >
                  {virtualItems.map((vi) => {
                    const item = filtered[vi.index];
                    const eff =
                      item.id in counts ? counts[item.id] : item.actual_qty;
                    const unitName =
                      unitNameById.get(item.inventory_unit_id) ?? "";
                    return (
                      <div
                        key={vi.key}
                        data-index={vi.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${vi.start}px)`,
                        }}
                      >
                        <EntryItemRow
                          id={item.id}
                          index={vi.index}
                          sequenceNo={item.sequence_no}
                          productId={item.product_id}
                          productName={item.product_name}
                          productCode={item.product_code}
                          productLocalName={item.product_local_name}
                          productSku={item.product_sku}
                          inventoryUnitName={unitName}
                          committedQty={eff}
                          isCounted={isCountedFn(item)}
                          onCommit={handleCommitCount}
                          onOpenCalc={handleOpenCalc}
                          onAdvance={handleAdvance}
                          commitOnChange
                          NotesDialog={ScEntryNotesDialog}
                          translationNamespace="inventoryManagement.spotCheck"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom action bar ─────────── */}
        <div className="border-border/60 bg-card/80 -mx-4 border-t px-4 py-3 backdrop-blur-xl">
          <TooltipProvider delayDuration={100}>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {totalItems > 0 && uncountedCount === 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={handleSubmitReview}
                      disabled={reviewSc.isPending}
                      className="rounded-full"
                    >
                      <SendHorizontal aria-hidden="true" />
                      {reviewSc.isPending
                        ? t("submittingForReview")
                        : t("submitForReview")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {t("submitForReviewTooltip")}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <>
                  {uncountedCount > 0 && (
                    <Button
                      variant="warning"
                      className="rounded-full"
                      size="sm"
                      onClick={handleSetUncountedToZero}
                    >
                      {t("setEmptyToZero", { count: uncountedCount })}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={handleSave}
                    disabled={totalItems === 0 || saveSc.isPending}
                  >
                    <Save className="size-4" aria-hidden="true" />
                    {saveSc.isPending ? t("saving") : t("saveForResume")}
                  </Button>
                </>
              )}
            </div>
          </TooltipProvider>
        </div>

        {/* Import dialog */}
        <EntryImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          items={importItemRefs}
          onApply={handleApplyImport}
        />

        {/* Calculator dialog */}
        <CalculatorDialog
          open={!!calcItem}
          onOpenChange={(v) => {
            if (!v) setCalcItem(null);
          }}
          productId={calcItem?.productId ?? ""}
          productName={calcItem?.name ?? ""}
          baseUnitName={calcItem?.unit ?? ""}
          onConfirm={(total) => {
            if (calcItem) {
              setCounts((prev) => ({ ...prev, [calcItem.id]: total }));
            }
          }}
        />
      </div>
    </div>
  );
}
