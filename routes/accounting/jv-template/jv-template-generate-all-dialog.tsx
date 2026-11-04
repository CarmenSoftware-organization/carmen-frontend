import { useState } from "react";
import { Link } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useBuCode } from "@/hooks/use-bu-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  jvTemplateDetailPath,
  type JvTemplatePageKind,
} from "./jv-template-config";
import { jvTemplateErrorText, periodLabel } from "./jv-template-labels";
import { jvTemplateRepository } from "./jv-template-repository";
import type { JvGenerateAllResult } from "./jv-template-types";
import {
  JV_TEMPLATE_QUERY_KEYS,
  useGenerateAllDueJvTemplates,
} from "./use-jv-template";
import { useOpenGlPeriods } from "./use-open-gl-periods";

/**
 * ชื่อ template ของผลลัพธ์ — ดึงทีละตัวด้วย key เดียวกับ `useJvTemplate` (cache ร่วมกัน)
 * เพราะ filter `id in` ของ list ยืนยันไม่ได้ว่า gateway ส่งต่อถึง QueryParams · ชุดผลลัพธ์เล็ก
 */
function useTemplateNames(ids: readonly string[]) {
  const buCode = useBuCode() ?? "";
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: JV_TEMPLATE_QUERY_KEYS.detail(buCode, id),
      queryFn: () => jvTemplateRepository.get(buCode, id),
      enabled: Boolean(buCode),
    })),
  });
  const map = new Map<string, string>();
  ids.forEach((id, i) => {
    const d = results[i]?.data;
    if (d) map.set(id, `${d.code} · ${d.name}`);
  });
  return map;
}

/** รัน generate ให้ทุก template ที่ active และถึงกำหนดในงวดที่เลือก (ทุกชนิด) แล้วสรุปผล 3 กลุ่ม */
export function JvTemplateGenerateAllDialog({
  open,
  onOpenChange,
  kind,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly kind: JvTemplatePageKind;
}) {
  const t = useTranslations("accounting.jvTemplate");
  const tc = useTranslations("common");
  const { periods, isLoading } = useOpenGlPeriods();
  const generateAll = useGenerateAllDueJvTemplates();
  const [periodId, setPeriodId] = useState("");
  const [result, setResult] = useState<JvGenerateAllResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPeriodId("");
      setResult(null);
      setErrorText(null);
    }
  }

  const ids = result
    ? [
        ...new Set([
          ...result.generated.map((r) => r.template_id),
          ...result.skipped.map((r) => r.template_id),
          ...result.failed.map((r) => r.template_id),
        ]),
      ]
    : [];
  const names = useTemplateNames(ids);
  const nameOf = (id: string) => names.get(id) ?? id;

  const run = () => {
    setErrorText(null);
    generateAll.mutate(periodId, {
      onSuccess: setResult,
      onError: (err) => setErrorText(jvTemplateErrorText(t, err)),
    });
  };

  const reasonLabel = (reason: "already_run" | "not_due") =>
    reason === "already_run" ? t("reasonAlreadyRun") : t("reasonNotDue");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !generateAll.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("generateAll")}</DialogTitle>
          {!result && (
            <DialogDescription>{t("generateAllHint")}</DialogDescription>
          )}
        </DialogHeader>

        {!result ? (
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("period")}</span>
            {!isLoading && periods.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("noOpenPeriod")}
              </p>
            ) : (
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-full" disabled={isLoading}>
                  <SelectValue placeholder={t("period")} />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {periodLabel(p.fiscal_year, p.period_number)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errorText && (
              <p role="alert" className="text-destructive text-sm">
                {errorText}
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto text-sm">
            <section>
              <h3 className="font-medium">
                {t("resultCreated")} ({result.generated.length})
              </h3>
              <ul className="mt-1 space-y-1">
                {result.generated.map((r) => (
                  <li
                    key={r.jv_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{nameOf(r.template_id)}</span>
                    <Link
                      to={`/accounting/journal-voucher/${r.jv_id}`}
                      className="text-primary shrink-0 hover:underline"
                      title={t("openJv")}
                    >
                      {r.jv_no}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-medium">
                {t("resultSkipped")} ({result.skipped.length})
              </h3>
              <ul className="mt-1 space-y-1">
                {result.skipped.map((r) => (
                  <li
                    key={r.template_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{nameOf(r.template_id)}</span>
                    <span className="text-muted-foreground shrink-0">
                      {reasonLabel(r.reason)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-medium">
                {t("resultFailed")} ({result.failed.length})
              </h3>
              <ul className="mt-1 space-y-1">
                {result.failed.map((r) => (
                  <li
                    key={r.template_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      to={jvTemplateDetailPath(kind, r.template_id)}
                      className="text-primary truncate hover:underline"
                      title={t("openTemplate")}
                    >
                      {nameOf(r.template_id)}
                    </Link>
                    <span className="text-destructive shrink-0">
                      {jvTemplateErrorText(t, r.code)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>{tc("close")}</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={generateAll.isPending}
              >
                {tc("cancel")}
              </Button>
              <Button
                onClick={run}
                disabled={!periodId || generateAll.isPending}
              >
                {generateAll.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t("run")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
