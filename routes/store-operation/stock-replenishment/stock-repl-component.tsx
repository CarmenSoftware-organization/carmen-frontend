import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  MapPin,
  RefreshCcw,
  ShoppingCart,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { ErrorState } from "@/components/ui/error-state";
import { WarningDialog } from "@/components/ui/warning-dialog";
import { ListPageShell } from "@/components/share/list-page-shell";
import SearchInput from "@/components/search-input";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { cn } from "@/lib/utils";
import { useStockReplenishment } from "./use-stock-replenishment";
import { useCreatableWorkflows } from "@/hooks/use-workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { Location, ProductLocation } from "@/types/stock-replenishment";
import { StockReplLocation } from "./stock-repl-location";
import { StockReplPrWizard, type StockReplPrRow } from "./stock-repl-pr-wizard";
import { StockReplSrWizard } from "./stock-repl-sr-wizard";

const filterLocations = (locations: Location[], search: string): Location[] => {
  if (!search) return locations;
  const term = search.toLowerCase();
  return locations
    .map((loc) => ({
      ...loc,
      products_location: loc.products_location.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term) ||
          (p.local_name ?? "").toLowerCase().includes(term) ||
          p.category.name.toLowerCase().includes(term) ||
          p.sub_category.name.toLowerCase().includes(term) ||
          p.item_group.name.toLowerCase().includes(term),
      ),
    }))
    .filter((loc) => loc.products_location.length > 0);
};

export default function StockReplComponent() {
  const t = useTranslations("storeOperation.stockReplenishment");
  const tc = useTranslations("common");
  const tPr = useTranslations("procurement.purchaseRequest");
  const tSr = useTranslations("storeOperation.storeRequisition");
  const {
    data: locations,
    isLoading,
    error,
    refetch,
  } = useStockReplenishment();
  const [selections, setSelections] = useState<Map<string, Set<string>>>(
    new Map(),
  );
  const [search, setSearch] = useState("");
  // null = ผู้ใช้ยังไม่แตะ → กางคลังที่มีของวิกฤตไว้ก่อน ไม่งั้นจอแรกว่างเปล่า
  // ต้องกด Expand all ทุกครั้ง พอแตะครั้งแรกก็ยึดตามที่ผู้ใช้เลือกตลอด
  const [openOverride, setOpenOverride] = useState<Set<string> | null>(null);
  const [createDialog, setCreateDialog] = useState<"pr" | "sr" | null>(null);
  const [locationWarningOpen, setLocationWarningOpen] = useState(false);

  const openLocations =
    openOverride ??
    new Set(
      (locations ?? [])
        .filter((l) => l.products_location.some((p) => p.status === "critical"))
        .map((l) => l.location_id),
    );

  const handleOpenChange = (locationId: string, open: boolean) => {
    setOpenOverride(() => {
      const next = new Set(openLocations);
      if (open) {
        next.add(locationId);
      } else {
        next.delete(locationId);
      }
      return next;
    });
  };

  const filteredLocations = filterLocations(locations ?? [], search);

  const allExpanded =
    filteredLocations.length > 0 &&
    filteredLocations.every((l) => openLocations.has(l.location_id));

  const handleExpandAll = () => {
    setOpenOverride(new Set(filteredLocations.map((l) => l.location_id)));
  };

  const handleCollapseAll = () => {
    setOpenOverride(new Set());
  };

  const allProducts = filteredLocations.flatMap((l) => l.products_location);
  const summary = {
    locations: filteredLocations.length,
    critical: allProducts.filter((p) => p.status === "critical").length,
    warning: allProducts.filter((p) => p.status === "warning").length,
    low: allProducts.filter((p) => p.status === "low").length,
    // นับรายการ ไม่ใช่บวก reorder_qty — สินค้าคนละหน่วยกัน (จาน ขวด กิโล) บวกกันไม่ได้ความหมาย
    toReorder: allProducts.filter((p) => p.reorder_qty > 0).length,
  };

  const handleSelectionChange = (locationId: string, ids: Set<string>) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (ids.size === 0) {
        next.delete(locationId);
      } else {
        next.set(locationId, ids);
      }
      return next;
    });
  };

  // สิทธิ์สร้างเอกสารต้องรู้ตั้งแต่ตอนกดปุ่ม ไม่ใช่ปล่อยให้เปิด wizard แล้วไปเจอ
  // dropdown workflow ว่างเปล่า — เกณฑ์เดียวกับปุ่ม Add ของหน้า PR/SR เอง
  // (PR/SR ไม่มี permission .create ใน catalog ตัววัดคือมี workflow ที่เริ่มได้ไหม)
  const { canCreate: canCreatePr } = useCreatableWorkflows(WORKFLOW_TYPE.PR);
  const { canCreate: canCreateSr } = useCreatableWorkflows(WORKFLOW_TYPE.SR);

  const totalSelected = Array.from(selections.values()).reduce(
    (sum, ids) => sum + ids.size,
    0,
  );
  const hasSelection = totalSelected > 0;

  // PR ผูกคลังรายแถว (item.location_id ของ PR form) — แถวที่ติ๊กจึงต้องพกคลัง
  // ต้นสังกัดไปด้วย ส่วน SR ใช้แค่ตัวสินค้าเพราะคลังต้นทางเลือกทีเดียวทั้งใบ
  const getSelectedRows = (): StockReplPrRow[] => {
    if (!locations) return [];
    const result: StockReplPrRow[] = [];
    for (const loc of locations) {
      const ids = selections.get(loc.location_id);
      if (ids) {
        for (const product of loc.products_location) {
          if (ids.has(product.id)) {
            result.push({ location: loc, product });
          }
        }
      }
    }
    return result;
  };

  const getSelectedProducts = (): ProductLocation[] =>
    getSelectedRows().map((row) => row.product);

  // PR ติ๊กข้ามคลังได้ — payload รับ `location_id` เดียว wizard จึงยิงทีละคลัง
  // ได้ใบขอซื้อคลังละใบ ส่วน SR ทำแบบนั้นไม่ได้เพราะทั้งใบผูกคู่คลังต้นทาง-ปลายทาง
  // (selections ลบ entry ว่างออกเสมอ ดังนั้น size = จำนวนคลังที่มีของติ๊กจริง)
  const handleCreatePR = () => {
    if (!canCreatePr) {
      dispatchPermissionDenied(undefined, tPr("noCreatableWorkflow"));
      return;
    }
    setCreateDialog("pr");
  };

  const handleCreateSR = () => {
    if (!canCreateSr) {
      dispatchPermissionDenied(undefined, tSr("noCreatableWorkflow"));
      return;
    }
    if (selections.size > 1) {
      setLocationWarningOpen(true);
      return;
    }
    setCreateDialog("sr");
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      actions={
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCcw />
          {tc("refresh")}
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-auto sm:flex-initial">
            <SearchInput defaultValue={search} onSearch={setSearch} />
          </div>
        </div>
      }
    >
      {isLoading && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          {tc("loading")}
        </div>
      )}
      {!isLoading && locations && (
        <div className="space-y-3">
          <div className="bg-muted/30 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {t("nLocations", { count: summary.locations })}
            </span>
            <span className="font-semibold tabular-nums">
              {t("nToReorder", { count: summary.toReorder })}
            </span>
            {(summary.critical > 0 ||
              summary.warning > 0 ||
              summary.low > 0) && (
              <span className="text-muted-foreground/40">|</span>
            )}
            {/* ป้ายที่เป็น 0 ไม่บอกอะไร — ซ่อนเหมือนที่หัวคลังทำ */}
            {summary.critical > 0 && (
              <StatusDotBadge tone="destructive" size="xs">
                {t("nCritical", { count: summary.critical })}
              </StatusDotBadge>
            )}
            {summary.warning > 0 && (
              <StatusDotBadge tone="warning" size="xs">
                {t("nWarning", { count: summary.warning })}
              </StatusDotBadge>
            )}
            {summary.low > 0 && (
              <StatusDotBadge tone="neutral" size="xs">
                {t("nLow", { count: summary.low })}
              </StatusDotBadge>
            )}
            <span className="ml-auto">
              <Button
                size="xs"
                variant="ghost"
                onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                aria-label={allExpanded ? tc("collapseAll") : tc("expandAll")}
              >
                {allExpanded ? (
                  <ChevronsDownUp className="size-3.5" />
                ) : (
                  <ChevronsUpDown className="size-3.5" />
                )}
                {allExpanded ? tc("collapseAll") : tc("expandAll")}
              </Button>
            </span>
          </div>

          {filteredLocations.map((location) => (
            <StockReplLocation
              key={location.location_id}
              location={location}
              open={openLocations.has(location.location_id)}
              onOpenChange={(open) =>
                handleOpenChange(location.location_id, open)
              }
              selectedIds={
                selections.get(location.location_id) ?? new Set<string>()
              }
              onSelectionChange={handleSelectionChange}
            />
          ))}

          {/* แถบ action ติดขอบล่าง — เดิมโผล่เหนือรายการตอนติ๊กแถวแรก แล้วดันทุกอย่าง
              ข้างล่างลงไป ~50px อยู่ท้ายรายการแทนจึงไม่มีอะไรข้างบนขยับ */}
          {hasSelection && (
            <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t py-3 backdrop-blur">
              <span className="text-sm font-semibold tabular-nums">
                {t("nSelected", { count: totalSelected })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelections(new Map())}
              >
                <X />
                {tc("clear")}
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {/* จาง + aria-disabled แต่ยังกดได้ — กดแล้วเด้ง dialog บอกเหตุผล
                    ดีกว่าปุ่มตายที่ไม่บอกอะไรเลย (ทรงเดียวกับปุ่ม Add ของ
                    DocumentListActions ที่ถูก gate ด้วย permission) */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateSR}
                  aria-disabled={!canCreateSr || undefined}
                  className={cn(!canCreateSr && "opacity-50")}
                >
                  <FileText />
                  {t("createSr")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreatePR}
                  aria-disabled={!canCreatePr || undefined}
                  className={cn(!canCreatePr && "opacity-50")}
                >
                  <ShoppingCart />
                  {t("createPr")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <StockReplPrWizard
        open={createDialog === "pr"}
        onOpenChange={(open) => !open && setCreateDialog(null)}
        rows={getSelectedRows()}
        onCreated={() => setSelections(new Map())}
      />
      <StockReplSrWizard
        open={createDialog === "sr"}
        onOpenChange={(open) => !open && setCreateDialog(null)}
        location={getSelectedRows()[0]?.location}
        products={getSelectedProducts()}
        onCreated={() => setSelections(new Map())}
      />

      <WarningDialog
        open={locationWarningOpen}
        title={t("srOneLocationTitle")}
        description={t("srOneLocationDesc")}
        confirmLabel={tc("goBack")}
        onConfirm={() => setLocationWarningOpen(false)}
      />
    </ListPageShell>
  );
}
