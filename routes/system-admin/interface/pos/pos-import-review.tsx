import { useState } from "react";
import { useNavigate } from "react-router";
import { CalendarX, Ban, TriangleAlert } from "lucide-react";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { useCan } from "@/hooks/use-can";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { PERMISSIONS } from "@/constant/permissions";
import { formatDate } from "@/lib/date-utils";
import { PosConfirmDialog } from "./pos-confirm-dialog";
import { importStatusTone } from "./pos-import-status";
import { PosOutletReviewCard } from "./pos-outlet-review-card";
import type {
  PosBrand,
  PosImportDetail,
  PosOutletPreview,
  PosPreview,
} from "./pos-sale-types";
import { usePosImport, usePosImportPreview } from "./use-pos-sale";

const LEGACY_EXPORT_WARNING = "legacy_export_version";

/** ตัวเลขของการ์ดสรุปสามใบ */
function summarize(detail: PosImportDetail, preview: PosPreview | undefined) {
  const outlets = preview?.outlets ?? [];
  const mappedOutlets = outlets.filter((o) => o.location !== null).length;

  // เมนูที่ขายในไฟล์นี้ (ไม่ซ้ำ) เทียบกับเมนูที่ยังไม่มีสูตรจากทุก Outlet
  const itemIds = new Set(detail.lines.map((l) => l.item.id));
  const unmappedIds = new Set(
    outlets.flatMap((o) => o.unmapped_items.map((u) => u.item_id)),
  );

  // วัตถุดิบนับไม่ซ้ำข้าม Outlet — สินค้าเดียวกันที่ขาดในหลาย Outlet นับครั้งเดียว
  const productIds = new Set<string>();
  const shortIds = new Set<string>();
  for (const o of outlets) {
    for (const g of o.ingredients) {
      productIds.add(g.product_id);
      if (g.is_short) shortIds.add(g.product_id);
    }
  }

  return {
    outlets: outlets.length,
    mappedOutlets,
    pendingOutlets: outlets.length - mappedOutlets,
    items: itemIds.size,
    mappedItems: itemIds.size - unmappedIds.size,
    pendingItems: unmappedIds.size,
    ingredients: productIds.size,
    shortIngredients: shortIds.size,
  };
}

/**
 * หน้าตรวจวัตถุดิบและยืนยันตัดสต็อกของการนำเข้ายอดขาย POS หนึ่งรายการ
 *
 * ยืนยันทีละ Outlet = Stock Out หนึ่งใบต่อ Outlet · ยืนยันเฉพาะเมนูที่ผูกสูตรแล้ว เมนูที่ค้างผูก
 * ถูกข้ามและยืนยันรอบถัดไปได้หลังผูก
 *
 * @param props.brand แบรนด์จาก URL — ต้องตรงกับแบรนด์ของการนำเข้า
 * @param props.importId id ของการนำเข้า
 * @param props.expired license ของ interface หมดอายุ (ดูได้ ยืนยันไม่ได้)
 * @returns React element ของหน้า
 */
export function PosImportReview({
  brand,
  importId,
  expired,
}: {
  readonly brand: PosBrand;
  readonly importId: string;
  readonly expired: boolean;
}) {
  const t = useTranslations("systemAdmin.interface.posSale.review");
  const tHistory = useTranslations("systemAdmin.interface.posSale.history");
  const tStatus = useTranslations("systemAdmin.interface.posSale.importStatus");
  const navigate = useNavigate();
  const { can, canWrite } = useCan();
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const detailQuery = usePosImport(importId);
  const previewQuery = usePosImportPreview(importId);
  const [target, setTarget] = useState<PosOutletPreview | null>(null);

  const basePath = `/system-admin/interface/pos/${brand}`;
  const backPath = `${basePath}?tab=history`;
  const detail = detailQuery.data;
  const preview = previewQuery.data;

  if (detailQuery.isLoading) return <FormPageSkeleton />;
  if (detailQuery.error) {
    return (
      <ErrorState
        error={detailQuery.error}
        notFoundMessage={t("notFound")}
        onRetry={() => void detailQuery.refetch()}
        backTo={backPath}
      />
    );
  }
  if (!detail || detail.brand !== brand) {
    return <ErrorState notFoundMessage={t("notFound")} backTo={backPath} />;
  }

  const canConfirm =
    canWrite &&
    !expired &&
    can(PERMISSIONS.inventory_management.stock_out.create);
  const itemsHref = detail.store
    ? `${basePath}?tab=items&store=${detail.store.id}`
    : `${basePath}?tab=items`;
  const summary = summarize(detail, preview);
  const docDate = preview?.doc_date ?? detail.doc_date;
  const channel =
    detail.ingest_method === "manual" || detail.ingest_method === "sftp"
      ? tHistory(`channel.${detail.ingest_method}`)
      : detail.ingest_method;

  const title = [
    docDate ? formatDate(`${docDate}T00:00:00`, dateFormat) : null,
    detail.source ?? detail.store?.store_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const subtitle = [
    detail.file_name,
    channel,
    t("linesCount", { count: detail.total_records }),
    t("salesAmount", { amount: formatAmount(detail.total_sales_amount) }),
  ].join(" · ");

  return (
    <FormPageShell
      width="wide"
      header={
        <DocFormHeader
          flush
          title={title || t("titleFallback")}
          subtitle={subtitle}
          backLabel={t("back")}
          onBack={() => navigate(backPath)}
          badges={
            <>
              <StatusDotBadge tone={importStatusTone(detail.status)}>
                {tStatus(detail.status)}
              </StatusDotBadge>
              {detail.warnings.includes(LEGACY_EXPORT_WARNING) && (
                <span className="text-warning-ink flex items-center gap-1 text-xs">
                  <TriangleAlert className="size-4" aria-hidden />
                  {tHistory("legacyWarning")}
                </span>
              )}
            </>
          }
        />
      }
    >
      <div className="space-y-4">
        {detail.cancelled_at !== null && (
          <div
            role="alert"
            className="bg-muted flex items-center gap-2 rounded-md px-4 py-2 text-xs"
          >
            <Ban className="text-destructive size-4 shrink-0" aria-hidden />
            <span>{t("cancelledNotice")}</span>
          </div>
        )}
        {preview && !preview.is_in_open_period && (
          <div
            role="alert"
            className="bg-muted flex items-center gap-2 rounded-md px-4 py-2 text-xs"
          >
            <CalendarX
              className="text-destructive size-4 shrink-0"
              aria-hidden
            />
            <span>{t("periodClosed")}</span>
          </div>
        )}

        {previewQuery.error ? (
          <ErrorState
            error={previewQuery.error}
            onRetry={() => void previewQuery.refetch()}
          />
        ) : previewQuery.isLoading ? (
          <FormPageSkeleton />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label={t("summary.outlets")}
                value={summary.outlets}
                detail={t("summary.outletsDetail", {
                  mapped: summary.mappedOutlets,
                  pending: summary.pendingOutlets,
                })}
                alert={summary.pendingOutlets > 0}
              />
              <SummaryCard
                label={t("summary.items")}
                value={summary.items}
                detail={t("summary.itemsDetail", {
                  mapped: summary.mappedItems,
                  pending: summary.pendingItems,
                })}
                alert={summary.pendingItems > 0}
              />
              <SummaryCard
                label={t("summary.ingredients")}
                value={summary.ingredients}
                detail={t("summary.ingredientsDetail", {
                  short: summary.shortIngredients,
                })}
                alert={summary.shortIngredients > 0}
              />
            </div>

            {(preview?.outlets ?? []).length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                {t("noOutlets")}
              </p>
            ) : (
              (preview?.outlets ?? []).map((o) => (
                <PosOutletReviewCard
                  key={o.outlet_id}
                  preview={o}
                  outlet={detail.outlets.find((d) => d.id === o.outlet_id)}
                  lines={detail.lines.filter(
                    (l) => l.outlet_id === o.outlet_id,
                  )}
                  canConfirm={canConfirm}
                  isConfirming={target !== null}
                  itemsHref={itemsHref}
                  onConfirm={() => setTarget(o)}
                />
              ))
            )}
          </>
        )}
      </div>

      <PosConfirmDialog
        key={target?.outlet_id ?? "none"}
        importId={importId}
        outlet={target}
        docDate={docDate}
        onClose={() => setTarget(null)}
      />
    </FormPageShell>
  );
}

/** การ์ดตัวเลขสรุปหนึ่งใบ — `alert` = บรรทัดรายละเอียดเป็นสีเตือน */
function SummaryCard({
  label,
  value,
  detail,
  alert,
}: {
  readonly label: string;
  readonly value: number;
  readonly detail: string;
  readonly alert: boolean;
}) {
  return (
    <Card className="py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <p
          className={
            alert ? "text-warning-ink text-xs" : "text-muted-foreground text-xs"
          }
        >
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}
