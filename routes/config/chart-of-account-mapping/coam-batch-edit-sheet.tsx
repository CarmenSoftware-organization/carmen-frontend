"use no memo";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";
import {
  useBatchUpdateAccountMapping,
  type BatchUpdateAccountMappingResult,
  type BatchUpdateAccountMappingVariables,
} from "./use-account-mapping";
import { MOVEMENT_KEY } from "./use-coam-table";

type Mode = "keep" | "set" | "reset";

interface CoamBatchEditSheetProps {
  readonly rows: AccountMappingRow[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (result: BatchUpdateAccountMappingResult) => void;
}

/** สรุป "A, B, C +2" — กันหัว sheet ยาวเกินเมื่อเลือกหลาย location */
const summarize = (values: string[]) => {
  const unique = [...new Set(values)];
  return unique.length > 3
    ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`
    : unique.join(", ");
};

/**
 * แก้ account / cost center ของหลายแถวด้วยค่าเดียวกัน — แต่ละช่องเลือก ไม่เปลี่ยน / ตั้งเป็น / คืนค่าเริ่มต้น
 * mount ใหม่ทุกครั้งที่เปิด (caller ใส่ key) ให้ state เริ่มที่ "ไม่เปลี่ยน" เสมอ
 */
export function CoamBatchEditSheet({
  rows,
  open,
  onClose,
  onDone,
}: CoamBatchEditSheetProps) {
  const t = useTranslations("config.chartOfAccountMapping");
  const tc = useTranslations("common");
  const errorToast = useErrorToast();
  const batch = useBatchUpdateAccountMapping();
  const [ccMode, setCcMode] = useState<Mode>("keep");
  const [cc, setCc] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<Mode>("keep");
  const [account, setAccount] = useState("");

  const ccReady = ccMode !== "set" || !!cc;
  const accountReady = accountMode !== "set" || !!account;
  const canSave =
    rows.length > 0 &&
    (ccMode !== "keep" || accountMode !== "keep") &&
    ccReady &&
    accountReady &&
    !batch.isPending;

  const save = () => {
    const body: BatchUpdateAccountMappingVariables = {
      items: rows.map((r) => ({ id: r.id, doc_version: r.doc_version })),
      ...(ccMode === "set" ? { cost_center_id: cc } : {}),
      ...(ccMode === "reset" ? { cost_center_id: null } : {}),
      ...(accountMode === "set" ? { account_code: account } : {}),
      ...(accountMode === "reset" ? { account_code: null } : {}),
    };
    batch.mutate(body, {
      onSuccess: (result) => onDone(result),
      onError: (err) => errorToast(err), // 422 ฯลฯ: ข้อความจาก error catalog — ไม่ปิด sheet
    });
  };

  const modeRadios = (
    value: Mode,
    onChange: (m: Mode) => void,
    name: string,
  ) => (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as Mode)}
      className="flex flex-wrap gap-4"
      aria-label={name}
    >
      {(["keep", "set", "reset"] as const).map((m) => (
        <Label key={m} className="flex items-center gap-2">
          <RadioGroupItem value={m} />
          {t(
            m === "keep"
              ? "modeKeep"
              : m === "set"
                ? "modeSet"
                : "resetToDefault",
          )}
        </Label>
      ))}
    </RadioGroup>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("batchEditTitle", { count: rows.length })}</SheetTitle>
          <SheetDescription>
            {t("batchEditDesc", {
              locations: summarize(rows.map((r) => r.location.code)),
              movements: summarize(
                rows.map((r) => t(MOVEMENT_KEY[r.movement])),
              ),
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <Field>
            <FieldLabel>{t("costCenter")}</FieldLabel>
            {modeRadios(ccMode, setCcMode, t("costCenter"))}
            {ccMode === "set" && (
              <LookupCostCenter
                value={cc}
                onValueChange={(id) => setCc(id)}
                modal
              />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("account")}</FieldLabel>
            {modeRadios(accountMode, setAccountMode, t("account"))}
            {accountMode === "set" && (
              <LookupChartOfAccount
                value={account}
                onValueChange={(code) => setAccount(code)}
              />
            )}
          </Field>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
