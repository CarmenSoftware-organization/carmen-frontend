import { useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { PreviewRegister, PreviewSummary } from "./preview-register";
import {
  outputTaxSamples,
  outputTaxSummary,
  type OutputTaxRecord,
} from "./operations-model";

export function Component() {
  const bu = useBuCode();
  return bu ? <OutputTax key={bu} /> : null;
}

function OutputTax() {
  const t = useTranslations("accounting.operations");
  const { canWrite } = useCan();
  const money = useAmountFormatter();
  const [params, setParams] = useSearchParams();
  const requestedTaxPoint = params.get("taxPoint");
  const taxPoint =
    requestedTaxPoint === "due" || requestedTaxPoint === "undue"
      ? requestedTaxPoint
      : "all";
  const [rows, setRows] = useState(outputTaxSamples);
  const [period, setPeriod] = useState("2026-11");
  const [selected, setSelected] = useState<OutputTaxRecord | null>(null);
  const [taxId, setTaxId] = useState("");
  const [preparedScope, setPreparedScope] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const visible = rows.filter(
    (row) =>
      row.period === period &&
      (taxPoint === "all" || row.taxPoint === taxPoint),
  );
  const scope = `${period}:${taxPoint}`;
  const summary = outputTaxSummary(visible);
  function review() {
    if (!selected || !canWrite || !/^\d{13}$/.test(taxId)) return;
    setRows((current) =>
      current.map((row) =>
        row.id === selected.id ? { ...row, taxId, status: "ready" } : row,
      ),
    );
    setPreparedScope(null);
    setSelected(null);
    toast.success(t("tax.reviewed"));
  }
  return (
    <PreviewRegister
      title={t("tax.title")}
      description={t("tax.desc")}
      pageKey={LIST_PAGE_KEYS.OUTPUT_TAX}
      rows={visible}
      statuses={["pending", "exception", "ready"]}
      partyLabel={t("customer")}
      amountLabel={t("tax.outputVat")}
      onOpen={(row) => {
        setSelected(row);
        setTaxId(row.taxId);
      }}
      actions={
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value)}>
            <SelectTrigger size="sm" aria-label={t("tax.period")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["2026-11", "2026-10"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={taxPoint}
            onValueChange={(value) =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (value === "all") next.delete("taxPoint");
                  else next.set("taxPoint", value);
                  return next;
                },
                { replace: true },
              )
            }
          >
            <SelectTrigger size="sm" aria-label={t("tax.taxPoint")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["all", "due", "undue"].map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`tax.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!canWrite || !summary.canPrepare}
            onClick={() => {
              if (canWrite && summary.canPrepare) {
                setPreparedScope(scope);
                setPreview(true);
              }
            }}
          >
            {t("tax.prepare")}
          </Button>
        </div>
      }
      summary={
        <>
          <PreviewSummary
            items={[
              { label: t("tax.base"), value: money(summary.base) },
              { label: t("tax.outputVat"), value: money(summary.vat) },
              { label: t("tax.exceptions"), value: summary.exceptions },
              {
                label: t("tax.stage"),
                value: t(
                  preparedScope === scope
                    ? "tax.prepared"
                    : taxPoint === "undue"
                      ? "tax.awaitingReceipt"
                      : summary.canPrepare
                        ? "tax.ready"
                        : "tax.review",
                ),
              },
            ]}
          />
          <p className="text-muted-foreground text-xs">{t("tax.pipeline")}</p>
        </>
      }
      extraColumns={[
        {
          accessorKey: "taxPoint",
          header: t("tax.taxPoint"),
          size: 155,
          cell: ({ row }) => t(`tax.${row.original.taxPoint}`),
        },
        {
          accessorKey: "base",
          header: t("tax.base"),
          size: 130,
          meta: {
            headerClassName: "text-right",
            cellClassName: "text-right tabular-nums",
          },
          cell: ({ row }) => money(row.original.base),
        },
      ]}
    >
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.number}</DialogTitle>
            <DialogDescription>{t("tax.reviewDesc")}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <Field>
                <FieldLabel>{t("customer")}</FieldLabel>
                <FieldPlainText>{selected.party}</FieldPlainText>
              </Field>
              <Field>
                <FieldLabel>{t("reference")}</FieldLabel>
                <FieldPlainText>{selected.reference}</FieldPlainText>
              </Field>
              <Field>
                <FieldLabel>{t("tax.taxPoint")}</FieldLabel>
                <FieldPlainText>{t(`tax.${selected.taxPoint}`)}</FieldPlainText>
              </Field>
              <Field>
                <FieldLabel htmlFor="vat-tax-id">{t("tax.taxId")}</FieldLabel>
                <Input
                  id="vat-tax-id"
                  inputMode="numeric"
                  maxLength={13}
                  value={taxId}
                  onChange={(event) => setTaxId(event.target.value)}
                  disabled={!canWrite}
                />
              </Field>
              <p className="text-muted-foreground text-xs">
                {t("tax.sampleTaxId")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              size="sm"
              disabled={!canWrite || !/^\d{13}$/.test(taxId)}
              onClick={review}
            >
              {t("tax.markReviewed")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("tax.previewTitle")} · {period}
            </DialogTitle>
            <DialogDescription>{t("tax.previewNotice")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field>
              <FieldLabel>{t("tax.base")}</FieldLabel>
              <FieldPlainText>{money(summary.base)} THB</FieldPlainText>
            </Field>
            <Field>
              <FieldLabel>{t("tax.outputVat")}</FieldLabel>
              <FieldPlainText>{money(summary.vat)} THB</FieldPlainText>
            </Field>
            <p className="text-warning-ink text-xs">
              {t("tax.inputVatMissing")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </PreviewRegister>
  );
}
