import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { BackButton } from "@/components/share/back-button";
import { Button } from "@/components/ui/button";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { ScDetail, ScStatus } from "@/types/sales-consumption";
import { stockOutPath } from "../import-pos/pos-import-status";

const STATUS_TONE: Record<ScStatus, DotTone> = {
  pending: "warning",
  posted: "success",
  voided: "neutral",
};

interface ScDetailHeaderProps {
  readonly sc: ScDetail;
  readonly canWrite: boolean;
  /** Void ใช้สิทธิ์ stock_out.delete และไม่ผูกกับ POS ที่เปิดอยู่ */
  readonly canVoid: boolean;
  /** บรรทัดขายที่ยังขาด Location/สูตร */
  readonly unresolvedLines: number;
  /** บรรทัดที่ค้าง + บรรทัดที่แตกสูตรไม่ได้ — ตัวนี้ที่บล็อก verify/post */
  readonly unresolvedCount: number;
  readonly canPost: boolean;
  readonly onBack: () => void;
  readonly onVerify: () => void;
  readonly onPost: () => void;
  readonly onVoid: () => void;
  readonly isVerifying: boolean;
  readonly isPosting: boolean;
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: "warning";
}) {
  return (
    <div className="bg-card rounded-lg border px-4 py-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${tone === "warning" ? "text-warning-ink" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * ข้อความสถานะข้างปุ่ม — ลำดับ: ยังค้างระบุ → ยังไม่ verify → verify เก่า → ของขาด → พร้อม
 */
function statusHint(
  sc: ScDetail,
  unresolvedCount: number,
  t: ReturnType<typeof useTranslations>,
): string {
  if (unresolvedCount > 0)
    return t("hint.unresolved", { count: unresolvedCount });
  const v = sc.verification;
  if (!v) return t("hint.notVerified");
  if (v.stale) return t("hint.stale");
  if (v.ok === false) return t("hint.short");
  return t("hint.ready", { count: sc.ingredients.length });
}

/**
 * หัวหน้า SC detail — ย้อนกลับ, เลขที่ + สถานะ, ปุ่ม Verify/Post/Void, ช่องข้อมูลสี่ช่อง
 * และแถวการ์ดสรุป (Mapped / Ignored / Need mapping / Ingredient cost)
 *
 * ปุ่มหลักมีตัวเดียว: Post (pending) · Verify และ Void เป็นปุ่มรอง
 *
 * @returns React element ของหัวหน้า
 */
export function ScDetailHeader({
  sc,
  canWrite,
  canVoid,
  unresolvedLines,
  unresolvedCount,
  canPost,
  onBack,
  onVerify,
  onPost,
  onVoid,
  isVerifying,
  isPosting,
}: ScDetailHeaderProps) {
  const t = useTranslations("operationPlan.salesConsumption.detail");
  const tStatus = useTranslations("operationPlan.salesConsumption.list.status");
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();

  const isPending = sc.status === "pending";
  const busy = isVerifying || isPosting;
  const mapped = sc.lines.filter(
    (l) => l.state === "ok" && !l.is_ignored,
  ).length;
  const ignored = sc.lines.filter((l) => l.is_ignored).length;
  const ingredientCost = sc.ingredients.reduce((s, g) => s + g.total_cost, 0);
  const replacement = sc.status === "voided" ? sc.replaced_by : null;
  const importNames = sc.imports
    .map((i) => `${i.store_name ?? i.file_name} (${t(`brand.${i.brand}`)})`)
    .join("\n");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton onClick={onBack} label={t("back")} />
        <h1 className="text-xl font-semibold">{sc.sc_no}</h1>
        <StatusDotBadge tone={STATUS_TONE[sc.status]}>
          {tStatus(sc.status)}
        </StatusDotBadge>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isPending && (
            <span className="text-muted-foreground text-sm" role="status">
              {statusHint(sc, unresolvedCount, t)}
            </span>
          )}
          {sc.status === "voided" && (
            <span className="text-muted-foreground text-sm">
              {replacement ? (
                <>
                  {t("header.replacedByPrefix")}{" "}
                  <Link
                    to={`/operation-plan/sales-consumption/${replacement.id}`}
                    className="text-primary hover:underline"
                  >
                    {replacement.sc_no}
                  </Link>
                </>
              ) : (
                t("hint.voidedNote")
              )}
            </span>
          )}
          {isPending && canWrite && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unresolvedCount > 0 || busy}
                onClick={onVerify}
              >
                {isVerifying
                  ? t("actions.verifying")
                  : sc.verification
                    ? t("actions.reverify")
                    : t("actions.verify")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canPost || busy}
                onClick={onPost}
              >
                {isPosting ? t("actions.posting") : t("actions.post")}
              </Button>
            </>
          )}
          {sc.status === "posted" && canVoid && (
            <Button type="button" variant="outline" size="sm" onClick={onVoid}>
              {t("actions.void")}
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label={t("header.saleDate")}>
          {formatDate(`${sc.sale_date.slice(0, 10)}T00:00:00`, dateFormat)}
        </Field>
        <Field label={t("header.imports")}>
          <span title={importNames}>
            {t("header.importsCount", { count: sc.imports.length })}
          </span>
        </Field>
        <Field label={t("header.salesAmount")}>
          <span className="tabular-nums">{formatAmount(sc.sales_amount)}</span>
        </Field>
        <Field label={t("header.stockOuts")}>
          {sc.stock_outs.length === 0
            ? t("header.none")
            : sc.stock_outs.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  {s.voided ? (
                    // ใบที่ void แล้วถูกลบแบบ soft เปิดหน้า Stock Out ไม่ได้ — แสดงเป็นข้อความ
                    <span className="text-muted-foreground">
                      <span className="line-through">
                        {s.so_no ?? s.id.slice(0, 8)}
                      </span>{" "}
                      ({t("header.stockOutVoided")})
                    </span>
                  ) : (
                    <Link
                      to={stockOutPath(s.id)}
                      className="text-primary hover:underline"
                    >
                      {s.so_no ?? s.id.slice(0, 8)}
                    </Link>
                  )}
                </span>
              ))}
        </Field>
      </dl>

      {sc.status === "posted" && sc.late_lines > 0 && (
        <p className="text-warning-ink text-sm" role="status">
          {t("header.lateLines", { count: sc.late_lines })}
        </p>
      )}

      {sc.missing_stores.length > 0 && (
        <p className="text-warning-ink text-sm" role="status">
          {t("header.missingStores", { stores: sc.missing_stores.join(", ") })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("cards.mapped")} value={mapped} />
        <StatCard label={t("cards.ignored")} value={ignored} />
        <StatCard
          label={t("cards.needMapping")}
          value={unresolvedLines}
          tone={unresolvedLines > 0 ? "warning" : undefined}
        />
        <StatCard
          label={
            isPending
              ? t("cards.ingredientCostEstimated")
              : t("cards.ingredientCost")
          }
          value={formatAmount(ingredientCost)}
        />
      </div>
    </div>
  );
}
