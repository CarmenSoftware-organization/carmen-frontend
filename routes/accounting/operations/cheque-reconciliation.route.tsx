import { useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import {
  PreviewRegister,
  PreviewSummary,
  PreviewStatus,
} from "./preview-register";
import {
  canReconcileCheque,
  chequeSamples,
  type ChequeRecord,
} from "./operations-model";

export function Component() {
  const bu = useBuCode();
  return bu ? <ChequeManagement key={bu} /> : null;
}

function ChequeManagement() {
  const t = useTranslations("accounting.operations");
  const { canWrite } = useCan();
  const money = useAmountFormatter();
  const [rows, setRows] = useState(chequeSamples);
  const [selected, setSelected] = useState<ChequeRecord | null>(null);
  const outstanding = rows.filter((row) =>
    ["on_hand", "in_transit"].includes(row.status),
  );
  const sum = (items: ChequeRecord[]) =>
    money(items.reduce((total, row) => total + row.amount, 0));
  function reconcile() {
    if (!selected || !canWrite || !canReconcileCheque(selected)) return;
    setRows((current) =>
      current.map((row) =>
        row.id === selected.id ? { ...row, status: "cleared" } : row,
      ),
    );
    setSelected(null);
    toast.success(t("cheque.reconciled"));
  }
  return (
    <PreviewRegister
      title={t("cheque.title")}
      description={t("cheque.desc")}
      pageKey={LIST_PAGE_KEYS.CHEQUE_RECONCILIATION}
      rows={rows}
      statuses={["on_hand", "in_transit", "cleared", "bounced"]}
      partyLabel={t("customer")}
      amountLabel={t("amountThb")}
      onOpen={setSelected}
      summary={
        <PreviewSummary
          items={[
            { label: t("cheque.outstanding"), value: sum(outstanding) },
            {
              label: t("cheque.cleared"),
              value: sum(rows.filter((row) => row.status === "cleared")),
            },
            {
              label: t("cheque.returned"),
              value: rows.filter((row) => row.status === "bounced").length,
            },
            {
              label: t("cheque.matchable"),
              value: rows.filter(canReconcileCheque).length,
            },
          ]}
        />
      }
      extraColumns={[
        {
          accessorKey: "bank",
          header: t("cheque.bank"),
          size: 180,
        },
      ]}
    >
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.number}</SheetTitle>
            <SheetDescription>{t("cheque.matchDesc")}</SheetDescription>
          </SheetHeader>
          {selected && (
            <>
              <div className="grid gap-4 overflow-auto px-4 text-xs">
                {[
                  { label: t("customer"), value: selected.party },
                  { label: t("cheque.bank"), value: selected.bank },
                  { label: t("reference"), value: selected.reference },
                  {
                    label: t("cheque.bookAmount"),
                    value: money(selected.amount),
                  },
                  {
                    label: t("cheque.statementNumber"),
                    value: selected.statementNumber || "—",
                  },
                  {
                    label: t("cheque.statementAmount"),
                    value: money(selected.statementAmount),
                  },
                  {
                    label: t("cheque.clearingDate"),
                    value: selected.statementDate || "—",
                  },
                  {
                    label: t("cheque.variance"),
                    value: money(selected.amount - selected.statementAmount),
                  },
                ].map((item) => (
                  <Field key={item.label}>
                    <FieldLabel>{item.label}</FieldLabel>
                    <FieldPlainText>{item.value}</FieldPlainText>
                  </Field>
                ))}
                <PreviewStatus status={selected.status} />
                {!canReconcileCheque(selected) &&
                  selected.status !== "cleared" && (
                    <p className="text-warning-ink">{t("cheque.unmatched")}</p>
                  )}
              </div>
              <SheetFooter>
                <Button
                  size="sm"
                  onClick={reconcile}
                  disabled={!canWrite || !canReconcileCheque(selected)}
                >
                  {t("cheque.reconcile")}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PreviewRegister>
  );
}
