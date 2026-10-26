import { useMemo } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { LookupLocation } from "@/components/lookup/lookup-location";
import { LookupRecipe } from "@/components/lookup/lookup-recipe";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import EmptyComponent from "@/components/empty-component";
import {
  useAmountFormatter,
  useQuantityFormatter,
} from "@/hooks/use-number-formatter";
import { getUserErrorMessage } from "@/lib/error-message";
import type {
  ScDetail,
  ScLine,
  ScUpdateLinesInput,
} from "@/types/sales-consumption";
import { useUpdateScLines } from "./use-sales-consumption";

const RIGHT = {
  headerClassName: "text-right",
  cellClassName: "text-right tabular-nums",
  skeleton: columnSkeletons.number,
};

interface ScSalesLinesProps {
  readonly sc: ScDetail;
  /** สิทธิ์แก้ (license + permission) — แก้ได้เมื่อ pending เท่านั้น */
  readonly canWrite: boolean;
}

/**
 * ตารางบรรทัดขายของวัน — ระบุ Location และสูตรต่อบรรทัด (ค่าตั้งต้นจาก master mapping)
 * pending + มีสิทธิ์ = แก้ได้ทีละบรรทัด · posted/voided = ข้อความล้วน
 *
 * @returns React element ของตาราง
 */
export function ScSalesLines({ sc, canWrite }: ScSalesLinesProps) {
  "use no memo";
  const t = useTranslations("operationPlan.salesConsumption.detail.lines");
  const tErr = useTranslations("errors");
  const formatQty = useQuantityFormatter();
  const formatAmount = useAmountFormatter();
  const { mutate } = useUpdateScLines(sc.id);
  const editable = canWrite && sc.status === "pending";

  const columns = useMemo<ColumnDef<ScLine>[]>(() => {
    const save = (body: ScUpdateLinesInput) =>
      mutate(body, {
        onSuccess: () => toast.success(t("saved")),
        onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
      });
    return [
      {
        id: "outlet",
        header: t("columns.outlet"),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.outlet.code}</span>{" "}
            <span className="text-muted-foreground">
              {row.original.outlet.name}
            </span>
          </span>
        ),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "location",
        header: t("columns.location"),
        cell: ({ row }) => {
          const line = row.original;
          if (line.state === "not_counted") return <NotCounted t={t} />;
          const loc = line.location;
          const hint = !loc
            ? t("outletNotMapped")
            : line.location_source === "line"
              ? t("changedLine")
              : t("fromOutlet");
          return (
            <div className="min-w-48 space-y-0.5">
              {editable ? (
                <div className="flex items-center gap-1">
                  <LookupLocation
                    size="xs"
                    value={loc?.id ?? ""}
                    defaultLabel={loc ? `${loc.code} · ${loc.name}` : undefined}
                    onValueChange={(id) =>
                      id && save({ line_ids: [line.id], location_id: id })
                    }
                  />
                  {line.location_source === "line" && (
                    <ResetButton
                      label={t("resetToMaster")}
                      onClick={() =>
                        save({ line_ids: [line.id], location_id: null })
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  {loc ? `${loc.code} · ${loc.name}` : "–"}
                </div>
              )}
              {editable && (
                <div
                  className={`text-xs ${loc ? "text-muted-foreground" : "text-warning-ink"}`}
                >
                  {hint}
                </div>
              )}
            </div>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "item",
        header: t("columns.item"),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.item.code}</span>{" "}
            <span className="text-muted-foreground">
              {row.original.item.desc1}
            </span>
          </span>
        ),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "recipe",
        header: t("columns.recipe"),
        cell: ({ row }) => {
          const line = row.original;
          if (line.state === "not_counted") return <NotCounted t={t} />;
          const recipe = line.recipe;
          const fromLine = line.recipe_source === "line";
          const hint =
            !recipe && !line.is_ignored
              ? t("itemNotMapped")
              : fromLine
                ? t("changedLine")
                : t("fromItem");
          if (!editable) {
            return line.is_ignored ? (
              <StatusDotBadge tone="neutral">{t("ignored")}</StatusDotBadge>
            ) : (
              <span className="text-sm">
                {recipe ? `${recipe.code} · ${recipe.name}` : "–"}
              </span>
            );
          }
          return (
            <div className="min-w-56 space-y-0.5">
              <div className="flex items-center gap-1">
                <LookupRecipe
                  size="xs"
                  value={line.is_ignored ? "" : (recipe?.id ?? "")}
                  defaultLabel={
                    recipe && !line.is_ignored
                      ? `${recipe.code} · ${recipe.name}`
                      : undefined
                  }
                  placeholder={line.is_ignored ? t("ignored") : undefined}
                  onValueChange={(id) =>
                    id &&
                    save({
                      line_ids: [line.id],
                      recipe_id: id,
                      ...(line.is_ignored && { is_ignored: false }),
                    })
                  }
                />
                {!line.is_ignored && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      save({ line_ids: [line.id], is_ignored: true })
                    }
                  >
                    {t("ignore")}
                  </Button>
                )}
                {(fromLine || line.is_ignored) && (
                  <ResetButton
                    label={t("resetToMaster")}
                    onClick={() =>
                      save({
                        line_ids: [line.id],
                        recipe_id: null,
                        is_ignored: null,
                      })
                    }
                  />
                )}
              </div>
              <div
                className={`text-xs ${!recipe && !line.is_ignored ? "text-warning-ink" : "text-muted-foreground"}`}
              >
                {hint}
              </div>
              {fromLine && (line.is_ignored || recipe) && (
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() =>
                      save(
                        line.is_ignored
                          ? {
                              line_ids: [line.id],
                              is_ignored: true,
                              set_item_default: true,
                            }
                          : {
                              line_ids: [line.id],
                              recipe_id: recipe?.id,
                              set_item_default: true,
                            },
                      )
                    }
                  />
                  {t("setItemDefault")}
                </label>
              )}
            </div>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "qty",
        header: t("columns.qty"),
        cell: ({ row }) => formatQty(row.original.qty),
        enableSorting: false,
        meta: RIGHT,
      },
      {
        id: "amount",
        header: t("columns.amount"),
        cell: ({ row }) => formatAmount(row.original.total),
        enableSorting: false,
        meta: RIGHT,
      },
    ];
  }, [t, tErr, editable, mutate, formatQty, formatAmount]);

  const table = useReactTable({
    data: sc.lines,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // แก้บรรทัดแล้ว data ถูกโหลดใหม่ — ห้ามเด้งกลับหน้าแรก
    autoResetPageIndex: false,
    initialState: { pagination: { pageIndex: 0, pageSize: 50 } },
  });

  return (
    <DataGrid
      table={table}
      recordCount={sc.lines.length}
      tableLayout={{ headerSticky: true, rowClamp: false }}
      emptyMessage={<EmptyComponent />}
    >
      <DataGridContainer className="flex flex-col">
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
        <DataGridPagination sizes={[50, 100, 200]} />
      </DataGridContainer>
    </DataGrid>
  );
}

function NotCounted({ t }: { readonly t: (key: string) => string }) {
  return (
    <span className="text-muted-foreground text-sm">{t("notCounted")}</span>
  );
}

function ResetButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <X />
    </Button>
  );
}
