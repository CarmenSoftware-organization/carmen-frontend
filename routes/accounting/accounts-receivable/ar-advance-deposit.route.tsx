import { useState, type FormEvent } from "react";
import { useTranslations } from "use-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ErrorState } from "@/components/ui/error-state";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { isoToDateInput } from "@/lib/date-utils";
import { round2 } from "@/lib/currency-utils";
import {
  PreviewRegister,
  PreviewSummary,
  PreviewStatus,
} from "../operations/preview-register";
import {
  advanceDepositSummary,
  readAdvanceDeposits,
  saveAdvanceDeposit,
  type AdvanceDeposit,
} from "./ar-advance-deposit-model";

export function Component() {
  const bu = useBuCode();
  return bu ? <AdvanceDeposits key={bu} bu={bu} /> : null;
}

function AdvanceDeposits({ bu }: { readonly bu: string }) {
  const t = useTranslations("accounting.operations");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { canWrite } = useCan();
  const [state, setState] = useState(() => {
    try {
      return { rows: readAdvanceDeposits(bu), error: false };
    } catch {
      return { rows: [] as AdvanceDeposit[], error: true };
    }
  });
  const [selected, setSelected] = useState<AdvanceDeposit | null>(null);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(() =>
    isoToDateInput(new Date().toISOString()),
  );
  const summary = advanceDepositSummary(state.rows);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const data = new FormData(event.currentTarget);
    try {
      const id = crypto.randomUUID();
      setState({
        rows: saveAdvanceDeposit(bu, {
          id,
          number: `AD-SAMPLE-${id.slice(0, 8)}`,
          date,
          party: String(data.get("party") ?? ""),
          reference: String(data.get("reference") ?? ""),
          amount: Number(data.get("amount")),
          applied: 0,
          status: "draft",
        }),
        error: false,
      });
      setAdding(false);
      toast.success(t("savedSample"));
    } catch {
      toast.error(t("saveError"));
    }
  }
  if (state.error) return <ErrorState message={t("storageError")} />;
  return (
    <PreviewRegister
      title={t("deposit.title")}
      description={t("deposit.desc")}
      pageKey={LIST_PAGE_KEYS.AR_ADVANCE_DEPOSIT}
      rows={state.rows}
      statuses={[
        "draft",
        "available",
        "partially_applied",
        "fully_applied",
        "refunded",
      ]}
      onOpen={setSelected}
      partyLabel={t("customer")}
      amountLabel={t("deposit.received")}
      actions={
        <Button size="sm" disabled={!canWrite} onClick={() => setAdding(true)}>
          <Plus />
          {t("deposit.add")}
        </Button>
      }
      summary={
        <PreviewSummary
          items={[
            { label: t("count"), value: summary.count },
            { label: t("deposit.received"), value: money(summary.received) },
            { label: t("deposit.applied"), value: money(summary.applied) },
            { label: t("deposit.available"), value: money(summary.available) },
          ]}
        />
      }
      extraColumns={[
        {
          id: "balance",
          header: t("deposit.available"),
          accessorFn: (row) =>
            row.status === "draft" || row.status === "refunded"
              ? 0
              : round2(row.amount - row.applied),
          meta: {
            headerClassName: "text-right",
            cellClassName: "text-right tabular-nums",
          },
          cell: ({ getValue }) => money(getValue<number>()),
        },
      ]}
    >
      <Dialog
        open={adding || !!selected}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setSelected(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.number ?? t("deposit.add")}</DialogTitle>
            <DialogDescription>{t("mockNotice")}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: t("customer"), value: selected.party },
                { label: t("reference"), value: selected.reference },
                { label: t("date"), value: selected.date },
                {
                  label: tc("status"),
                  value: <PreviewStatus status={selected.status} />,
                },
                { label: t("deposit.received"), value: money(selected.amount) },
                { label: t("deposit.applied"), value: money(selected.applied) },
              ].map((item) => (
                <Field key={item.label}>
                  <FieldLabel>{item.label}</FieldLabel>
                  <FieldPlainText>{item.value}</FieldPlainText>
                </Field>
              ))}
            </div>
          ) : (
            <form onSubmit={save} className="space-y-3">
              <Field>
                <FieldLabel htmlFor="ad-party" required>
                  {t("customer")}
                </FieldLabel>
                <Input id="ad-party" name="party" required maxLength={150} />
              </Field>
              <Field>
                <FieldLabel htmlFor="ad-reference" required>
                  {t("reference")}
                </FieldLabel>
                <Input
                  id="ad-reference"
                  name="reference"
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                <FieldLabel required>{t("date")}</FieldLabel>
                <DatePicker
                  value={date ? `${date}T00:00:00` : ""}
                  onValueChange={(value) => setDate(isoToDateInput(value))}
                  hideClear
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ad-amount" required>
                  {t("amountThb")}
                </FieldLabel>
                <Input
                  id="ad-amount"
                  name="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max="999999999"
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdding(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={!canWrite}>
                  {t("saveSample")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PreviewRegister>
  );
}
