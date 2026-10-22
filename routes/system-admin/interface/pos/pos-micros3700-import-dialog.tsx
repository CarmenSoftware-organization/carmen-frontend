import { useState } from "react";
import { Link } from "react-router";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import {
  useAmountFormatter,
  useQuantityFormatter,
} from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getUserErrorMessage } from "@/lib/error-message";
import { importStatusLabel } from "./pos-import-status";
import type {
  PosMicros3700CheckResult,
  PosMicros3700OutletAction,
  PosMicros3700OutletCheck,
  PosMicros3700OutletResult,
} from "./pos-sale-types";
import { outletErrorMessage, useImportMicros3700 } from "./use-pos-sale";

/** ข้อความที่อ่านจาก PDF พร้อมข้อมูลไฟล์ — ถือไว้ในหน่วยความจำจน dialog ปิด */
export interface Micros3700Payload {
  file_name: string;
  lines: string[][];
  extract_ms: number;
  page_count: number;
}

/** ผล `check` ที่พร้อมนำเข้า */
export type Micros3700Ready = Extract<PosMicros3700CheckResult, { kind: "ready" }>;

type Decision = "skip" | "overwrite";

const ACTION_TONE: Record<PosMicros3700OutletAction, DotTone> = {
  imported: "success",
  overwritten: "success",
  skipped: "neutral",
  failed: "destructive",
};

/**
 * dialog นำเข้ารายงาน Micros 3700 — สรุปต่อ Outlet + footing → เลือกข้าม/เขียนทับ Outlet
 * ที่มีอยู่แล้ว → นำเข้า → ผลต่อ Outlet
 *
 * เขียนทับ Outlet ที่ยืนยันแล้วต้องยกเลิก Stock Out เดิม จึงต้องมีสิทธิ์ `stock_out.delete`
 * (backend ตรวจซ้ำ) · `needs_resolution` = มีคนนำเข้าวันเดียวกันระหว่างนี้ → แทนตารางด้วยชุดใหม่
 * ให้เลือกอีกครั้ง · parent unmount dialog เมื่อปิด state ทั้งหมดจึงล้างเอง
 *
 * @param props.open เปิดอยู่หรือไม่
 * @param props.onOpenChange เรียกเมื่อ dialog ต้องเปิด/ปิด
 * @param props.payload บรรทัดข้อความของไฟล์ที่ตรวจแล้ว
 * @param props.check ผล `check` แบบ `ready`
 * @returns React element ของ dialog
 */
export function PosMicros3700ImportDialog({
  open,
  onOpenChange,
  payload,
  check,
}: {
  readonly open: boolean;
  readonly onOpenChange: (v: boolean) => void;
  readonly payload: Micros3700Payload;
  readonly check: Micros3700Ready;
}) {
  const t = useTranslations("systemAdmin.interface.posSale.micros3700Upload");
  const tStatus = useTranslations("systemAdmin.interface.posSale.importStatus");
  const tc = useTranslations("common");
  const tErr = useTranslations("errors");
  const { can } = useCan();
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const formatQty = useQuantityFormatter();
  const importMutation = useImportMicros3700();
  const canVoidStockOut = can(PERMISSIONS.inventory_management.stock_out.delete);

  const [outlets, setOutlets] = useState<PosMicros3700OutletCheck[]>(
    check.outlets,
  );
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [results, setResults] = useState<PosMicros3700OutletResult[] | null>(
    null,
  );

  const pending = importMutation.isPending;
  const docDate = formatDate(`${check.doc_date}T00:00:00`, dateFormat);
  const footingDiff = Math.abs(
    check.footing.computed_total - check.footing.reported_total,
  );

  /** เขียนทับได้ไหม — Outlet ที่มี Stock Out แล้วต้องมีสิทธิ์ยกเลิก Stock Out */
  const overwriteAllowed = (o: PosMicros3700OutletCheck) =>
    canVoidStockOut || (o.existing?.stock_out_ids.length ?? 0) === 0;

  /** ทางเลือกที่จะส่งจริง — ค่าเริ่ม ข้าม และตกเป็น ข้าม เมื่อเขียนทับไม่ได้ */
  const decisionOf = (o: PosMicros3700OutletCheck): Decision =>
    decisions[o.code] === "overwrite" && overwriteAllowed(o)
      ? "overwrite"
      : "skip";

  const close = () => {
    if (!pending) onOpenChange(false);
  };

  const submit = () => {
    const existing = outlets.filter((o) => o.existing !== null);
    importMutation.mutate(
      {
        file_name: payload.file_name,
        lines: payload.lines,
        extract_ms: payload.extract_ms,
        overwrite_outlet_codes: existing
          .filter((o) => decisionOf(o) === "overwrite")
          .map((o) => o.code),
        skip_outlet_codes: existing
          .filter((o) => decisionOf(o) === "skip")
          .map((o) => o.code),
      },
      {
        onSuccess: (res) => {
          if (res.kind === "needs_resolution") {
            setOutlets(res.outlets);
            toast.warning(t("needsResolution"));
            return;
          }
          if (res.kind === "rejected") {
            onOpenChange(false);
            toast.error(importStatusLabel(tStatus, res.import.status), {
              description: res.import.error_message ?? payload.file_name,
            });
            return;
          }
          setResults(res.outlets);
        },
        onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
      },
    );
  };

  const header = (
    <DialogHeader>
      <DialogTitle>{results ? t("resultTitle") : t("title")}</DialogTitle>
      <DialogDescription>
        {[
          docDate,
          check.store_name,
          payload.file_name,
          t("pages", { count: payload.page_count }),
          check.detected_version,
        ]
          .filter(Boolean)
          .join(" · ")}
      </DialogDescription>
    </DialogHeader>
  );

  if (results) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-2xl">
          {header}
          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b">
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">
                    {t("columns.outlet")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("columns.result")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.code} className="border-b align-top last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground">{r.code}</span>{" "}
                      {r.name}
                    </td>
                    <td className="space-y-1 px-3 py-2">
                      <StatusDotBadge tone={ACTION_TONE[r.action]}>
                        {t(`outcome.${r.action}`)}
                      </StatusDotBadge>
                      {r.error && (
                        <p className="text-destructive">
                          {outletErrorMessage(r.error, tErr)}
                        </p>
                      )}
                      {r.voided_stock_out_ids.length > 0 && (
                        <p className="text-muted-foreground">
                          {t("voided", {
                            count: r.voided_stock_out_ids.length,
                          })}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.import_id && (
                        <Button asChild variant="ghost" size="xs">
                          <Link
                            to={`/system-admin/interface/pos/micros3700/imports/${r.import_id}`}
                            onClick={() => onOpenChange(false)}
                          >
                            {t("review")}
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl">
        {header}
        <p className="text-success-ink text-sm">
          {t("footingOk", { diff: formatAmount(footingDiff) })}
        </p>
        <div className="max-h-96 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">
                  {t("columns.outlet")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("columns.lines")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("columns.qty")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("columns.total")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("columns.reported")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("columns.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {outlets.map((o) => (
                <tr key={o.code} className="border-b align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="text-muted-foreground">{o.code}</span>{" "}
                    {o.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.line_count}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatQty(o.qty)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(o.total)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.reported_total === null
                      ? "-"
                      : formatAmount(o.reported_total)}
                  </td>
                  <td className="px-3 py-2">
                    <OutletStatusCell
                      outlet={o}
                      decision={decisionOf(o)}
                      overwriteAllowed={overwriteAllowed(o)}
                      disabled={pending}
                      onChange={(d) =>
                        setDecisions((prev) => ({ ...prev, [o.code]: d }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={pending}
          >
            <X />
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t("import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ช่องสถานะของ Outlet ในมุมมองสรุป — ใหม่ หรือ มีอยู่แล้ว + ทางเลือก ข้าม/เขียนทับ
 *
 * @param props.outlet Outlet ที่ตรวจแล้ว
 * @param props.decision ทางเลือกปัจจุบัน
 * @param props.overwriteAllowed เขียนทับได้ไหม (ไม่มีสิทธิ์ยกเลิก Stock Out = ไม่ได้)
 * @param props.disabled ปิดทุกตัวเลือกระหว่างนำเข้า
 * @param props.onChange เรียกเมื่อเปลี่ยนทางเลือก
 * @returns React element ของช่องสถานะ
 */
function OutletStatusCell({
  outlet,
  decision,
  overwriteAllowed,
  disabled,
  onChange,
}: {
  readonly outlet: PosMicros3700OutletCheck;
  readonly decision: Decision;
  readonly overwriteAllowed: boolean;
  readonly disabled: boolean;
  readonly onChange: (d: Decision) => void;
}) {
  const t = useTranslations("systemAdmin.interface.posSale.micros3700Upload");
  const formatAmount = useAmountFormatter();
  const existing = outlet.existing;

  if (!existing) {
    return <StatusDotBadge tone="success">{t("status.new")}</StatusDotBadge>;
  }

  const stockOutCount = existing.stock_out_ids.length;
  const overwriteId = `m3700-${outlet.code}-overwrite`;
  const skipId = `m3700-${outlet.code}-skip`;
  const overwriteItem = (
    <span className="flex items-center gap-1.5">
      <RadioGroupItem
        id={overwriteId}
        value="overwrite"
        disabled={disabled || !overwriteAllowed}
      />
      <Label htmlFor={overwriteId} className="text-xs font-normal">
        {t("decision.overwrite")}
      </Label>
    </span>
  );

  return (
    <div className="space-y-1.5">
      <StatusDotBadge tone="warning">{t("status.existing")}</StatusDotBadge>
      <p className="text-muted-foreground">
        {t("existingTotal", { amount: formatAmount(existing.total) })}
        {" · "}
        {t("existingConfirmed", {
          confirmed: existing.confirmed_line_count,
          total: existing.line_count,
        })}
      </p>
      <RadioGroup
        value={decision}
        onValueChange={(v) => onChange(v as Decision)}
        className="flex gap-4"
        aria-label={t("decision.label", { outlet: outlet.name })}
      >
        <span className="flex items-center gap-1.5">
          <RadioGroupItem id={skipId} value="skip" disabled={disabled} />
          <Label htmlFor={skipId} className="text-xs font-normal">
            {t("decision.skip")}
          </Label>
        </span>
        {overwriteAllowed ? (
          overwriteItem
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{overwriteItem}</span>
            </TooltipTrigger>
            <TooltipContent>{t("noVoidPermission")}</TooltipContent>
          </Tooltip>
        )}
      </RadioGroup>
      {decision === "overwrite" && stockOutCount > 0 && (
        <p className="text-warning-ink">
          {t("voidWarning", { count: stockOutCount })}
        </p>
      )}
    </div>
  );
}
