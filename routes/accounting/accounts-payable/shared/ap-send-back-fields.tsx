import { useTranslations } from "use-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApPreviousStage } from "./use-ap-previous-stages";

/** ช่องเลือกขั้นที่จะส่งกลับ (บังคับเลือก) ใน dialog ส่งกลับของใบแจ้งหนี้/ใบจ่ายเงิน */
export interface SendBackLabels {
  readonly stage: string;
  readonly stagePlaceholder: string;
  readonly stagesError: string;
  readonly noStages: string;
}

export function ApSendBackFields({
  kind = "invoice",
  labels,
  stage,
  onStageChange,
  stages,
  isLoading,
  isError,
}: {
  readonly kind?: "invoice" | "payment";
  /** ข้อความเอง (เช่น AR Invoice) — ไม่ส่งจะอ่านจาก namespace ของ AP ตาม kind */
  readonly labels?: SendBackLabels;
  readonly stage: string;
  readonly onStageChange: (stage: string) => void;
  readonly stages: ApPreviousStage[];
  readonly isLoading: boolean;
  readonly isError: boolean;
}) {
  const tAp = useTranslations(
    `accounting.accountsPayable.${kind}.detail.reasonDialog.sendback`,
  );
  const t = (key: keyof SendBackLabels) => labels?.[key] ?? tAp(key);
  return (
    <div className="space-y-1.5">
      <Label>{t("stage")}</Label>
      <Select value={stage} onValueChange={onStageChange}>
        <SelectTrigger aria-label={t("stage")} disabled={isLoading}>
          <SelectValue placeholder={t("stagePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {stages.map((s) => (
            <SelectItem key={s.key} value={s.name}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="text-destructive text-xs" role="alert">
          {t("stagesError")}
        </p>
      )}
      {!isLoading && !isError && stages.length === 0 && (
        <p className="text-warning-ink text-xs">{t("noStages")}</p>
      )}
    </div>
  );
}
