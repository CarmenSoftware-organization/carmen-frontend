"use no memo";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
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
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { ApiError } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";
import { useUpdateAccountMapping } from "./use-account-mapping";
import { SourceBadge } from "./coam-cells";

interface CoamEditSheetProps {
  readonly row: AccountMappingRow | null;
  readonly onClose: () => void;
}

/** ครอบด้วย key={row.id} เพื่อให้ state แก้ไขเริ่มใหม่ทุกครั้งที่เปลี่ยนแถว */
export function CoamEditSheet({ row, onClose }: CoamEditSheetProps) {
  if (!row) return null;
  return <CoamEditSheetBody key={row.id} row={row} onClose={onClose} />;
}

function CoamEditSheetBody({
  row,
  onClose,
}: {
  readonly row: AccountMappingRow;
  readonly onClose: () => void;
}) {
  const t = useTranslations("config.chartOfAccountMapping");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const errorToast = useErrorToast();
  const update = useUpdateAccountMapping();
  // undefined = ไม่แตะ, null = กลับไปใช้ default, string = แก้ทับ
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [costCenter, setCostCenter] = useState<string | null | undefined>(
    undefined,
  );

  const accountOverridden = row.account.source === "override";
  const ccOverridden = row.cost_center.source === "override";
  const shownAccount =
    account === undefined
      ? accountOverridden
        ? row.account.code
        : null
      : account;
  const shownCc =
    costCenter === undefined
      ? ccOverridden
        ? row.cost_center.id
        : null
      : costCenter;

  const save = () => {
    update.mutate(
      {
        id: row.id,
        doc_version: row.doc_version,
        ...(account !== undefined ? { account_code: account } : {}),
        ...(costCenter !== undefined ? { cost_center_id: costCenter } : {}),
      },
      {
        onSuccess: () => {
          toast.success(tt("updateSuccess", { entity: t("title") }));
          onClose();
        },
        onError: (err) => {
          if (
            err instanceof ApiError &&
            err.statusCode === 409 &&
            !err.appCode
          ) {
            // list ถูก invalidate แล้ว → แถวล่าสุดจะถูกโหลดเอง
            toast.error(t("conflict"));
            onClose();
            return;
          }
          errorToast(err); // 422 ฯลฯ: ข้อความจาก error catalog
        },
      },
    );
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("editTitle")}</SheetTitle>
          <SheetDescription>
            {row.location.code} · {row.item_group.code} · {row.movement}
            {row.adjustment_type ? ` · ${row.adjustment_type.code}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <Field>
            <FieldLabel>{t("costCenter")}</FieldLabel>
            <LookupCostCenter
              value={shownCc}
              onValueChange={(id) => setCostCenter(id)}
              modal
              allowDeselect
            />
            <p className="text-muted-foreground text-xs">
              {!ccOverridden && row.cost_center.id
                ? t("defaultValue", {
                    value: `${row.cost_center.code ?? ""} ${row.cost_center.name ?? ""}`,
                  })
                : !ccOverridden
                  ? t("noDefault")
                  : null}
            </p>
            {(ccOverridden || costCenter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCostCenter(null)}
              >
                {t("resetToDefault")}
              </Button>
            )}
          </Field>
          <Field>
            <FieldLabel>{t("account")}</FieldLabel>
            <LookupChartOfAccount
              value={shownAccount ?? ""}
              onValueChange={(code) => setAccount(code || null)}
            />
            <p className="text-muted-foreground text-xs">
              {!accountOverridden && row.account.code
                ? t("defaultValue", {
                    value: `${row.account.code} ${row.account.name ?? ""}`,
                  })
                : !accountOverridden
                  ? t("noDefault")
                  : null}
            </p>
            <div className="flex items-center gap-2">
              <SourceBadge
                source={
                  account === undefined
                    ? row.account.source
                    : account === null
                      ? null
                      : "override"
                }
              />
              {(accountOverridden || account) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAccount(null)}
                >
                  {t("resetToDefault")}
                </Button>
              )}
            </div>
          </Field>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={
              update.isPending ||
              (account === undefined && costCenter === undefined)
            }
          >
            {tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
