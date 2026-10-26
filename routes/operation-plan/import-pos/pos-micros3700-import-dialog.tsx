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
} from "@/types/pos-sale";
import { outletErrorMessage, useImportMicros3700 } from "../shared/use-pos-sale";

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

/** ชุด live เดิมยังเป็นชุดเดียวกับที่ผู้ใช้เห็นไหม (import เดียวกัน + Stock Out ชุดเดียวกัน ลำดับใดก็ได้) */
function sameExisting(
  a: PosMicros3700OutletCheck["existing"],
  b: PosMicros3700OutletCheck["existing"],
): boolean {
  if (!a || !b) return a === b;
  if (a.import_id !== b.import_id) return false;
  const ids = new Set(a.stock_out_ids);
  const other = new Set(b.stock_out_ids);
  return ids.size === other.size && [...other].every((id) => ids.has(id));
}

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
 * Outlet ที่ชุดเดิมถูกตัดสต็อกไปกับ Sales Consumption ที่ post แล้วเขียนทับไม่ได้ (backend ปฏิเสธเสมอ)
 * ต้อง void Sales Consumption ของวันนั้นก่อน · การเขียนทับส่งชุด live + Stock Out ที่ผู้ใช้เห็นไปด้วย ·
 * `needs_resolution` = มีคนนำเข้า/ยืนยัน/เขียนทับวันเดียวกันระหว่างนี้ → แทนตารางด้วยชุดใหม่ และ
 * Outlet ที่ชุดเปลี่ยนกลับเป็น ข้าม ให้เลือกอีกครั้ง · parent unmount dialog เมื่อปิด state ทั้งหมดจึงล้างเอง
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
  const t = useTranslations("operationPlan.posSale.micros3700Upload");
  const tStatus = useTranslations("operationPlan.posSale.importStatus");
  const tc = useTranslations("common");
  const tErr = useTranslations("errors");
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const formatQty = useQuantityFormatter();
  const importMutation = useImportMicros3700();

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

  /** เขียนทับได้ไหม — ชุดเดิมที่มี Stock Out แล้ว (อยู่ใน SC ที่ post) ต้อง void SC ก่อน */
  const overwriteAllowed = (o: PosMicros3700OutletCheck) =>
    (o.existing?.stock_out_ids.length ?? 0) === 0;

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
        overwrite: existing
          .filter((o) => decisionOf(o) === "overwrite")
          .map((o) => ({
            code: o.code,
            import_id: o.existing?.import_id ?? "",
            stock_out_ids: o.existing?.stock_out_ids ?? [],
          })),
        skip_outlet_codes: existing
          .filter((o) => decisionOf(o) === "skip")
          .map((o) => o.code),
      },
      {
        onSuccess: (res) => {
          if (res.kind === "needs_resolution") {
            const seen = new Map(outlets.map((o) => [o.code, o.existing]));
            setDecisions((prev) => {
              const next = { ...prev };
              for (const o of res.outlets) {
                if (!sameExisting(seen.get(o.code) ?? null, o.existing))
                  delete next[o.code];
              }
              return next;
            });
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
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.import_id && (
                        <Button asChild variant="ghost" size="xs">
                          <Link
                            to={`/operation-plan/import-pos?import=${r.import_id}`}
                            onClick={() => onOpenChange(false)}
                          >
                            {t("viewLines")}
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
                      docDate={docDate}
                      scLink={`/operation-plan/sales-consumption?view=calendar&month=${check.doc_date.slice(0, 7)}`}
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
 * @param props.overwriteAllowed เขียนทับได้ไหม (ชุดเดิมอยู่ใน SC ที่ post แล้ว = ไม่ได้)
 * @param props.docDate วันขายที่จัดรูปแบบแล้ว
 * @param props.scLink ลิงก์ไปปฏิทิน Sales Consumption ของเดือนนั้น
 * @param props.disabled ปิดทุกตัวเลือกระหว่างนำเข้า
 * @param props.onChange เรียกเมื่อเปลี่ยนทางเลือก
 * @returns React element ของช่องสถานะ
 */
function OutletStatusCell({
  outlet,
  decision,
  overwriteAllowed,
  docDate,
  scLink,
  disabled,
  onChange,
}: {
  readonly outlet: PosMicros3700OutletCheck;
  readonly decision: Decision;
  readonly overwriteAllowed: boolean;
  readonly docDate: string;
  readonly scLink: string;
  readonly disabled: boolean;
  readonly onChange: (d: Decision) => void;
}) {
  const t = useTranslations("operationPlan.posSale.micros3700Upload");
  const formatAmount = useAmountFormatter();
  const existing = outlet.existing;

  if (!existing) {
    return <StatusDotBadge tone="success">{t("status.new")}</StatusDotBadge>;
  }

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
        {overwriteItem}
      </RadioGroup>
      {!overwriteAllowed && (
        <p className="text-muted-foreground">
          {t("inPostedSc", { date: docDate })}{" "}
          <Link to={scLink} className="text-primary hover:underline">
            {t("openSalesConsumption")}
          </Link>
        </p>
      )}
    </div>
  );
}
