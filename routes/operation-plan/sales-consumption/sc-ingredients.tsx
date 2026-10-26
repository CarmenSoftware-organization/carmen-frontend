import { useMemo } from "react";
import { Link } from "react-router";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import EmptyComponent from "@/components/empty-component";
import {
  useAmountFormatter,
  useQuantityFormatter,
} from "@/hooks/use-number-formatter";
import type {
  ScDetail,
  ScIngredientGroup,
  ScIngredientProduct,
  ScVerifyResult,
} from "@/types/sales-consumption";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { stockOutPath } from "../import-pos/pos-import-status";

const RIGHT = {
  headerClassName: "text-right",
  cellClassName: "text-right tabular-nums",
  skeleton: columnSkeletons.number,
};

interface Check {
  available: number;
  short: number;
}

interface ScIngredientsProps {
  readonly sc: ScDetail;
  /** ผลตรวจล่าสุดในหน้านี้ — null = ยังไม่ตรวจ หรือหมดอายุ (stale) */
  readonly verify: ScVerifyResult | null;
}

/**
 * แท็บวัตถุดิบ — กลุ่มละ location: หัวกลุ่ม + ตารางสินค้าที่จะตัด
 * pending = ต้นทุนเป็นประมาณการและมีคอลัมน์ผลตรวจ on-hand · หลัง post ค่ามาจากใบจ่ายออก
 *
 * @returns React element ของแท็บ
 */
export function ScIngredients({ sc, verify }: ScIngredientsProps) {
  const t = useTranslations(
    "operationPlan.salesConsumption.detail.ingredients",
  );
  const tProblem = useTranslations(
    "operationPlan.salesConsumption.detail.problems",
  );
  const { dateTimeFormat } = useProfile();
  const isPending = sc.status === "pending";

  const checks = useMemo(() => {
    const byLocation = new Map<string, Map<string, Check>>();
    for (const g of verify?.groups ?? []) {
      byLocation.set(
        g.location_id,
        new Map(
          g.products.map((p) => [
            p.product_id,
            { available: p.available, short: p.short },
          ]),
        ),
      );
    }
    return byLocation;
  }, [verify]);

  const shortTotal = useMemo(
    () =>
      (verify?.groups ?? []).reduce(
        (n, g) => n + g.products.filter((p) => p.short > 0).length,
        0,
      ),
    [verify],
  );

  let summary: string | null = null;
  if (isPending) {
    if (verify) {
      summary =
        shortTotal > 0
          ? t("summaryShort", { count: shortTotal })
          : t("summaryOk");
    } else {
      if (sc.verification?.stale) summary = t("summaryStale");
      else if (sc.verification)
        summary = t("summaryVerifiedNoDetail", {
          time: formatDate(sc.verification.verified_at, dateTimeFormat),
        });
      else summary = t("summaryNotChecked");
    }
  }

  return (
    <div className="space-y-4">
      {summary && <p className="text-muted-foreground text-sm">{summary}</p>}
      {isPending && (
        <p className="text-muted-foreground text-xs">{t("estimateNote")}</p>
      )}

      {sc.ingredient_problems.length > 0 && (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 space-y-1 rounded-md border px-3 py-2 text-sm"
        >
          <div className="text-warning-ink flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden className="size-4" />
            {t("problemsTitle")}
          </div>
          <ul className="text-warning-ink list-disc pl-6">
            {sc.ingredient_problems.map((p) => (
              <li key={p.line_id}>
                {p.item_code} {p.item_desc} —{" "}
                {tProblem.has(p.reason) ? tProblem(p.reason) : p.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sc.ingredients.length === 0 ? (
        <EmptyComponent />
      ) : (
        sc.ingredients.map((g) => (
          <ScIngredientGroupCard
            key={g.location.id}
            group={g}
            isPending={isPending}
            checked={verify !== null}
            checks={checks.get(g.location.id)}
          />
        ))
      )}
    </div>
  );
}

interface GroupProps {
  readonly group: ScIngredientGroup;
  readonly isPending: boolean;
  readonly checked: boolean;
  readonly checks: Map<string, Check> | undefined;
}

function ScIngredientGroupCard({
  group,
  isPending,
  checked,
  checks,
}: GroupProps) {
  "use no memo";
  const t = useTranslations(
    "operationPlan.salesConsumption.detail.ingredients",
  );
  const formatQty = useQuantityFormatter();
  const formatAmount = useAmountFormatter();

  const shortCount = group.products.filter(
    (p) => (checks?.get(p.product_id)?.short ?? 0) > 0,
  ).length;

  const columns = useMemo<ColumnDef<ScIngredientProduct>[]>(() => {
    const cols: ColumnDef<ScIngredientProduct>[] = [
      {
        id: "product",
        header: t("columns.product"),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.code}</span>{" "}
            <span className="text-muted-foreground">{row.original.name}</span>
          </span>
        ),
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
        id: "unit",
        header: t("columns.unit"),
        cell: ({ row }) => row.original.unit,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "unit_cost",
        header: t("columns.unitCost"),
        cell: ({ row }) => formatAmount(row.original.unit_cost),
        enableSorting: false,
        meta: RIGHT,
      },
      {
        id: "total_cost",
        header: t("columns.totalCost"),
        cell: ({ row }) => formatAmount(row.original.total_cost),
        enableSorting: false,
        meta: RIGHT,
      },
    ];
    if (isPending) {
      cols.push(
        {
          id: "on_hand",
          header: t("columns.onHand"),
          cell: ({ row }) => {
            const c = checks?.get(row.original.product_id);
            return c ? formatQty(c.available) : t("dash");
          },
          enableSorting: false,
          meta: RIGHT,
        },
        {
          id: "can_deduct",
          header: t("columns.canDeduct"),
          cell: ({ row }) => {
            const c = checks?.get(row.original.product_id);
            if (!c)
              return (
                <span className="text-muted-foreground">{t("notChecked")}</span>
              );
            return c.short > 0 ? (
              <StatusDotBadge tone="destructive">
                {t("shortBy", { qty: formatQty(c.short) })}
              </StatusDotBadge>
            ) : (
              <StatusDotBadge tone="success">{t("yes")}</StatusDotBadge>
            );
          },
          enableSorting: false,
          meta: { skeleton: columnSkeletons.badge },
        },
      );
    }
    return cols;
  }, [t, isPending, checks, formatQty, formatAmount]);

  const table = useReactTable({
    data: group.products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold">
          {group.location.code} · {group.location.name}
        </h3>
        <span className="text-muted-foreground text-xs">
          {t("outlets", { outlets: group.outlets.join(", ") })}
        </span>
        <span className="text-muted-foreground text-xs">
          {t("productCount", { count: group.products.length })}
        </span>
        <span className="text-sm font-medium tabular-nums">
          {formatAmount(group.total_cost)}
        </span>
        {isPending &&
          (checked ? (
            shortCount > 0 ? (
              <StatusDotBadge tone="destructive">
                {t("shortCount", { count: shortCount })}
              </StatusDotBadge>
            ) : (
              <StatusDotBadge tone="success">{t("canDeduct")}</StatusDotBadge>
            )
          ) : (
            <span className="text-muted-foreground text-xs">
              {t("notChecked")}
            </span>
          ))}
        <span className="ml-auto text-xs">
          {group.stock_out ? (
            <Link
              to={stockOutPath(group.stock_out.id)}
              className="text-primary hover:underline"
            >
              {group.stock_out.so_no ?? group.stock_out.id.slice(0, 8)}
            </Link>
          ) : (
            <span className="text-muted-foreground">{t("stockOutOnPost")}</span>
          )}
        </span>
      </div>
      <DataGrid table={table} recordCount={group.products.length}>
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </section>
  );
}
