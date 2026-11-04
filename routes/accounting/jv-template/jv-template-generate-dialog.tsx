import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import type { JvTemplate } from "./jv-template-types";
import { jvTemplateErrorText, periodLabel } from "./jv-template-labels";
import { useGenerateJvTemplate } from "./use-jv-template";
import { useOpenGlPeriods } from "./use-open-gl-periods";

const periodKey = (fy: number, no: number) => fy * 100 + no;

/** สร้าง JV ฉบับร่างจาก template ตัวเดียว — เลือกได้เฉพาะงวดที่เปิดอยู่และอยู่ในช่วง from..to ของ template */
export function JvTemplateGenerateDialog({
  open,
  onOpenChange,
  template,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly template: JvTemplate;
}) {
  const t = useTranslations("accounting.jvTemplate");
  const tc = useTranslations("common");
  const navigate = useNavigate();
  const { periods, isLoading } = useOpenGlPeriods();
  const generate = useGenerateJvTemplate();
  const [periodId, setPeriodId] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  const inRange = useMemo(() => {
    const from = periodKey(template.from_fiscal_year, template.from_period_no);
    const to = periodKey(template.to_fiscal_year, template.to_period_no);
    return periods.filter((p) => {
      const k = periodKey(p.fiscal_year, p.period_number);
      return k >= from && k <= to;
    });
  }, [periods, template]);

  // เปิดใหม่ทุกครั้งเริ่มจากฟอร์มว่าง (ปรับ state ระหว่าง render ตาม React docs)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPeriodId("");
      setErrorText(null);
    }
  }

  const run = () => {
    setErrorText(null);
    generate.mutate(
      { id: template.id, glPeriodId: periodId },
      {
        onSuccess: (result) => {
          toast.success(t("generated", { jvNo: result.jv_no }), {
            action: {
              label: t("openJv"),
              onClick: () =>
                navigate(`/accounting/journal-voucher/${result.jv_id}`),
            },
          });
          onOpenChange(false);
        },
        onError: (err) => setErrorText(jvTemplateErrorText(t, err)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !generate.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("generate")}</DialogTitle>
          <DialogDescription>
            {template.code} · {template.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <span className="text-sm font-medium">{t("period")}</span>
          {!isLoading && inRange.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noOpenPeriod")}</p>
          ) : (
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-full" disabled={isLoading}>
                <SelectValue placeholder={t("period")} />
              </SelectTrigger>
              <SelectContent>
                {inRange.map((p) => (
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generate.isPending}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={run} disabled={!periodId || generate.isPending}>
            {generate.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
