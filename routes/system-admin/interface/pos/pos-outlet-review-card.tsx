import { Link } from "react-router";
import { ArrowRight, PackageMinus } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAmountFormatter,
  useQuantityFormatter,
} from "@/hooks/use-number-formatter";
import { cn } from "@/lib/utils";
import { stockOutPath } from "./pos-import-status";
import type {
  PosImportLine,
  PosImportOutlet,
  PosIngredientSource,
  PosOutletPreview,
} from "./pos-sale-types";

const SOURCE_LIMIT = 2;

const th = "text-muted-foreground px-3 py-2 text-xs font-medium";
const td = "px-3 py-2";

/**
 * Outlet ของการยืนยันตัดสต็อกหนึ่งใบ — หัวการ์ด (Outlet → Location, ความคืบหน้า, ใบ Stock Out,
 * ปุ่มยืนยัน + เหตุที่ยืนยันไม่ได้) และแท็บ ยอดขาย / วัตถุดิบที่จะตัด / ค้างผูก
 *
 * @param props.preview ตัวอย่างการตัดของ Outlet (จาก `/preview`)
 * @param props.outlet ยอดขายของ Outlet (จากรายละเอียดการนำเข้า) — `undefined` ถ้าหาไม่เจอ
 * @param props.lines บรรทัดยอดขายของ Outlet นี้
 * @param props.blockedBy เหตุที่ผู้ใช้ยืนยันไม่ได้ (`license` / `permission`) — `null` = ยืนยันได้
 *   (ไม่รวม `preview.can_confirm`)
 * @param props.notInPreview Outlet มีในรายละเอียดแต่ไม่อยู่ใน preview — แสดงยอดขายแต่ยืนยันไม่ได้
 * @param props.isConfirming มีการยืนยันวิ่งอยู่ หรือข้อมูลกำลัง refetch หลังยืนยัน
 * @param props.itemsHref ลิงก์ไปแท็บผูกเมนูของแบรนด์
 * @param props.onConfirm เปิด dialog ยืนยัน
 * @returns React element ของการ์ด
 */
export function PosOutletReviewCard({
  preview,
  outlet,
  lines,
  blockedBy,
  notInPreview = false,
  isConfirming,
  itemsHref,
  onConfirm,
}: {
  readonly preview: PosOutletPreview;
  readonly outlet: PosImportOutlet | undefined;
  readonly lines: PosImportLine[];
  readonly blockedBy: "license" | "permission" | null;
  readonly notInPreview?: boolean;
  readonly isConfirming: boolean;
  readonly itemsHref: string;
  readonly onConfirm: () => void;
}) {
  const t = useTranslations("systemAdmin.interface.posSale.review");
  const tBlock = useTranslations("systemAdmin.interface.posSale.blockReason");
  const tUnresolved = useTranslations(
    "systemAdmin.interface.posSale.unresolvedReason",
  );
  const formatQty = useQuantityFormatter();
  const formatAmount = useAmountFormatter();

  const lineCount = outlet?.line_count ?? lines.length;
  const confirmedCount = outlet?.confirmed_line_count ?? 0;
  const percent = lineCount > 0 ? (confirmedCount / lineCount) * 100 : 0;
  const stockOutIds = outlet?.stock_out_ids ?? [];
  const pendingCount =
    preview.unmapped_items.length + preview.unresolved.length;

  const sourceText = (sources: PosIngredientSource[]) => {
    const shown = sources
      .slice(0, SOURCE_LIMIT)
      .map((s) => `${s.item_desc} ×${formatQty(s.sale_qty)}`)
      .join(", ");
    const rest = sources.length - SOURCE_LIMIT;
    return rest > 0 ? `${shown} ${t("sourcesMore", { count: rest })}` : shown;
  };

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
            <span>
              {preview.code} · {preview.name}
            </span>
            <ArrowRight className="text-muted-foreground size-4" aria-hidden />
            {preview.location ? (
              <span>
                {preview.location.code} · {preview.location.name}
              </span>
            ) : (
              <span className="text-destructive">{t("outlet.notMapped")}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Progress
              value={percent}
              variant="auto"
              className="w-32"
              aria-label={t("outlet.progress", {
                confirmed: confirmedCount,
                total: lineCount,
              })}
            />
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("outlet.progress", {
                confirmed: confirmedCount,
                total: lineCount,
              })}
            </span>
          </div>
          {stockOutIds.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {stockOutIds.map((id, i) => (
                <Link
                  key={id}
                  to={stockOutPath(id)}
                  className="text-primary hover:underline"
                >
                  {t("outlet.stockOut", { n: i + 1 })}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConfirm}
            disabled={
              !preview.can_confirm || blockedBy !== null || isConfirming
            }
          >
            <PackageMinus />
            {t("outlet.confirm")}
          </Button>
          {(preview.block_reasons.length > 0 ||
            blockedBy !== null ||
            notInPreview) && (
            <ul className="text-muted-foreground space-y-0.5 text-xs sm:text-right">
              {blockedBy === "license" && <li>{t("outlet.licenseLocked")}</li>}
              {blockedBy === "permission" && (
                <li>{t("outlet.noPermission")}</li>
              )}
              {notInPreview && <li>{t("outlet.notInPreview")}</li>}
              {preview.block_reasons.map((r) => (
                <li key={r}>{tBlock(r)}</li>
              ))}
            </ul>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">{t("tabs.sales")}</TabsTrigger>
            <TabsTrigger value="ingredients">
              {t("tabs.ingredients")} ({preview.ingredients.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              {t("tabs.pending")} ({pendingCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            {lines.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                {t("emptyLines")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[36rem] text-xs">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className={cn(th, "text-left")}>
                        {t("columns.item")}
                      </th>
                      <th className={cn(th, "text-right")}>
                        {t("columns.qty")}
                      </th>
                      <th className={cn(th, "text-right")}>
                        {t("columns.unitPrice")}
                      </th>
                      <th className={cn(th, "text-right")}>
                        {t("columns.total")}
                      </th>
                      <th className={cn(th, "text-left")}>
                        {t("columns.state")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className={td}>
                          <span className="text-muted-foreground">
                            {l.item.code}
                          </span>{" "}
                          {l.item.desc1}
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          {formatQty(l.qty)}
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          {formatAmount(l.unit_price)}
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          {formatAmount(l.total)}
                        </td>
                        <td
                          className={cn(
                            td,
                            l.stock_out_id
                              ? "text-success-ink"
                              : "text-muted-foreground",
                          )}
                        >
                          {l.stock_out_id
                            ? t("lineState.confirmed")
                            : t("lineState.pending")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ingredients">
            {preview.ingredients.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                {t("emptyIngredients")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[40rem] text-xs">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className={cn(th, "text-left")}>
                        {t("columns.product")}
                      </th>
                      <th className={cn(th, "text-right")}>
                        {t("columns.deduct")}
                      </th>
                      <th className={cn(th, "text-right")}>
                        {t("columns.available")}
                      </th>
                      <th className={cn(th, "text-left")}>
                        {t("columns.sources")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.ingredients.map((g) => (
                      <tr
                        key={g.product_id}
                        className={cn(
                          "border-b last:border-0",
                          g.is_short && "text-destructive",
                        )}
                      >
                        <td className={td}>
                          <span
                            className={cn(
                              !g.is_short && "text-muted-foreground",
                            )}
                          >
                            {g.product_code}
                          </span>{" "}
                          {g.product_name}
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          {formatQty(g.qty)} {g.inventory_unit.name}
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          {formatQty(g.available)}
                          {g.is_short && (
                            <span className="sr-only"> {t("shortLabel")}</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            td,
                            !g.is_short && "text-muted-foreground",
                          )}
                        >
                          {sourceText(g.sources)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {pendingCount === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                {t("emptyPending")}
              </p>
            ) : (
              <>
                {preview.unmapped_items.length > 0 && (
                  <section className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold">
                          {t("unmappedTitle", {
                            count: preview.unmapped_items.length,
                          })}
                        </h4>
                        <p className="text-muted-foreground text-xs">
                          {t("unmappedHint")}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="xs">
                        <Link to={itemsHref}>{t("goMapItems")}</Link>
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 border-b">
                          <tr>
                            <th className={cn(th, "text-left")}>
                              {t("columns.item")}
                            </th>
                            <th className={cn(th, "text-right")}>
                              {t("columns.qty")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.unmapped_items.map((u) => (
                            <tr
                              key={u.item_id}
                              className="border-b last:border-0"
                            >
                              <td className={td}>
                                <span className="text-muted-foreground">
                                  {u.code}
                                </span>{" "}
                                {u.desc1}
                              </td>
                              <td className={cn(td, "text-right tabular-nums")}>
                                {formatQty(u.qty)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                {preview.unresolved.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold">
                      {t("unresolvedTitle", {
                        count: preview.unresolved.length,
                      })}
                    </h4>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[36rem] text-xs">
                        <thead className="bg-muted/40 border-b">
                          <tr>
                            <th className={cn(th, "text-left")}>
                              {t("columns.item")}
                            </th>
                            <th className={cn(th, "text-left")}>
                              {t("columns.recipe")}
                            </th>
                            <th className={cn(th, "text-left")}>
                              {t("columns.ingredient")}
                            </th>
                            <th className={cn(th, "text-left")}>
                              {t("columns.reason")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.unresolved.map((u) => (
                            <tr
                              key={`${u.item_code}|${u.recipe_code}|${u.ingredient_name}|${u.reason}`}
                              className="border-b last:border-0"
                            >
                              <td className={td}>{u.item_code}</td>
                              <td className={td}>{u.recipe_code}</td>
                              <td className={td}>{u.ingredient_name}</td>
                              <td className={cn(td, "text-destructive")}>
                                {tUnresolved(u.reason)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
