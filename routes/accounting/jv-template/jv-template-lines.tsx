import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
  type Control,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldInput,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { InputAmount } from "@/components/ui/input/input-amount";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { useCostCenterById } from "@/hooks/use-cost-center";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import type { JvTemplateType } from "./jv-template-types";
import {
  defaultLinesFor,
  moneyUnits,
  RATIO_SCALE,
  ratioUnits,
  type JvTemplateFormValues,
} from "./jv-template-form-schema";

const TH = "h-10 px-3 py-2 text-left text-xs font-medium";
const TD = "px-3 py-2 align-top";

/**
 * ตารางบรรทัดของ template — คอลัมน์ตามชนิด
 * - recurring: บัญชี · cost center · คำอธิบาย · เดบิต · เครดิต + ยอดรวมและสถานะสมดุล
 * - allocation: บัญชี · cost center · คำอธิบาย · ฝั่ง · อัตราส่วน + ผลรวมต่อฝั่ง + ยอดที่ปันให้แต่ละบรรทัด
 * - amortize: สองบรรทัดคงที่ (เดบิต / เครดิต) เพิ่มลบไม่ได้
 *
 * ตารางเลื่อนแนวนอนในกรอบของตัวเอง หน้าจอแคบไม่ดันทั้งหน้าให้ล้น
 */
export function JvTemplateLines({
  type,
  control,
  readOnly,
}: {
  readonly type: JvTemplateType;
  readonly control: Control<JvTemplateFormValues>;
  readonly readOnly: boolean;
}) {
  const t = useTranslations("accounting.jvTemplate");
  const tc = useTranslations("common");
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const { errors } = useFormState({ control });
  const lines = useWatch({ control, name: "lines" }) ?? [];
  const allocateAmount = useWatch({ control, name: "allocate_amount" }) ?? 0;

  const fixedRows = type === "amortize";
  const canEditRows = !readOnly && !fixedRows;
  const lineErr = (i: number) => errors.lines?.[i];
  const gridError = errors.lines?.message ?? errors.lines?.root?.message;

  const sideLabel = (side: string | null) =>
    side === "debit" ? t("debit") : side === "credit" ? t("credit") : "";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <h2 className="text-sm font-semibold">{t("lines")}</h2>
          <p className="text-muted-foreground text-xs">
            {t(`linesDesc_${type}`)}
          </p>
        </div>
        {canEditRows && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append(
                type === "allocation"
                  ? {
                      ...defaultLinesFor("allocation")[0],
                      allocation_ratio: null,
                    }
                  : defaultLinesFor(type)[0],
              )
            }
          >
            <Plus />
            {t("addLine")}
          </Button>
        )}
      </div>
      {gridError && <FieldError>{gridError}</FieldError>}
      <div className="min-w-0 shrink-0 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-xs">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className={cn(TH, "w-8 text-right")}>#</th>
              <th className={cn(TH, "min-w-56")}>{t("account")}</th>
              <th className={cn(TH, "min-w-44")}>{t("costCenter")}</th>
              <th className={cn(TH, "min-w-44")}>{t("description")}</th>
              {type === "recurring" && (
                <>
                  <th className={cn(TH, "w-32 text-right")}>{t("debit")}</th>
                  <th className={cn(TH, "w-32 text-right")}>{t("credit")}</th>
                </>
              )}
              {type !== "recurring" && (
                <th className={cn(TH, "w-28")}>{t("side")}</th>
              )}
              {type === "allocation" && (
                <>
                  <th className={cn(TH, "w-28 text-right")}>{t("ratio")}</th>
                  <th className={cn(TH, "w-32 text-right")}>
                    {t("allocatedPreview")}
                  </th>
                </>
              )}
              {canEditRows && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {fields.map((row, i) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td
                  className={cn(
                    TD,
                    "text-muted-foreground pt-3 text-right tabular-nums",
                  )}
                >
                  {i + 1}
                </td>
                <td className={TD}>
                  <Controller
                    control={control}
                    name={`lines.${i}.chart_of_accounts_id`}
                    render={({ field }) => (
                      <LookupChartOfAccountById
                        value={field.value || null}
                        onValueChange={(id) => field.onChange(id ?? "")}
                        readOnly={readOnly}
                        modal={false}
                        error={lineErr(i)?.chart_of_accounts_id?.message}
                      />
                    )}
                  />
                </td>
                <td className={TD}>
                  <Controller
                    control={control}
                    name={`lines.${i}.cost_center_id`}
                    render={({ field }) =>
                      readOnly ? (
                        <CostCenterText id={field.value} />
                      ) : (
                        <LookupCostCenter
                          value={field.value}
                          onValueChange={(id) => field.onChange(id)}
                          modal={false}
                          allowDeselect
                        />
                      )
                    }
                  />
                </td>
                <td className={TD}>
                  <Controller
                    control={control}
                    name={`lines.${i}.description`}
                    render={({ field }) =>
                      readOnly ? (
                        <FieldPlainText>{field.value}</FieldPlainText>
                      ) : (
                        <FieldInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          aria-label={t("description")}
                        />
                      )
                    }
                  />
                </td>

                {type === "recurring" &&
                  (["debit", "credit"] as const).map((side) => (
                    <td key={side} className={TD}>
                      <Controller
                        control={control}
                        name={`lines.${i}.${side}`}
                        render={({ field }) =>
                          readOnly ? (
                            <FieldPlainText className="w-full justify-end tabular-nums">
                              {field.value ? formatCurrency(field.value) : ""}
                            </FieldPlainText>
                          ) : (
                            <InputAmount
                              decimals={2}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="text-right tabular-nums"
                              aria-label={t(side)}
                              error={
                                side === "debit"
                                  ? lineErr(i)?.debit?.message
                                  : undefined
                              }
                            />
                          )
                        }
                      />
                    </td>
                  ))}

                {type !== "recurring" && (
                  <td className={TD}>
                    {fixedRows || readOnly ? (
                      <FieldPlainText>
                        {sideLabel(lines[i]?.side)}
                      </FieldPlainText>
                    ) : (
                      <Controller
                        control={control}
                        name={`lines.${i}.side`}
                        render={({ field }) => (
                          <FieldSelect
                            value={field.value ?? ""}
                            onValueChange={field.onChange}
                            placeholder={t("side")}
                            error={lineErr(i)?.side?.message}
                          >
                            <SelectContent>
                              <SelectItem value="debit">
                                {t("debit")}
                              </SelectItem>
                              <SelectItem value="credit">
                                {t("credit")}
                              </SelectItem>
                            </SelectContent>
                          </FieldSelect>
                        )}
                      />
                    )}
                  </td>
                )}

                {type === "allocation" && (
                  <>
                    <td className={TD}>
                      <Controller
                        control={control}
                        name={`lines.${i}.allocation_ratio`}
                        render={({ field }) =>
                          readOnly ? (
                            <FieldPlainText className="w-full justify-end tabular-nums">
                              {field.value == null
                                ? ""
                                : Number(field.value).toFixed(4)}
                            </FieldPlainText>
                          ) : (
                            <InputAmount
                              decimals={4}
                              value={field.value ?? 0}
                              onValueChange={field.onChange}
                              className="text-right tabular-nums"
                              aria-label={t("ratio")}
                              error={lineErr(i)?.allocation_ratio?.message}
                            />
                          )
                        }
                      />
                    </td>
                    <td
                      className={cn(
                        TD,
                        "text-muted-foreground pt-3 text-right tabular-nums",
                      )}
                    >
                      {formatCurrency(
                        (Number(allocateAmount) || 0) *
                          (ratioUnits(lines[i]?.allocation_ratio) /
                            RATIO_SCALE),
                      )}
                    </td>
                  </>
                )}

                {canEditRows && (
                  <td className={cn(TD, "text-right")}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(i)}
                      disabled={fields.length <= 1}
                      aria-label={tc("removeRow")}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function JvTemplateSummary({
  type,
  control,
}: {
  readonly type: JvTemplateType;
  readonly control: Control<JvTemplateFormValues>;
}) {
  const t = useTranslations("accounting.jvTemplate");
  const lines = useWatch({ control, name: "lines" }) ?? [];
  const allocateAmount = useWatch({ control, name: "allocate_amount" }) ?? 0;
  const totalAmount = useWatch({ control, name: "total_amount" }) ?? 0;
  const totals = lines.reduce(
    (acc, l) => {
      acc.debit += moneyUnits(l?.debit);
      acc.credit += moneyUnits(l?.credit);
      if (l?.side) acc.ratio[l.side] += ratioUnits(l.allocation_ratio);
      return acc;
    },
    { debit: 0, credit: 0, ratio: { debit: 0, credit: 0 } },
  );

  return (
    <SummaryFooterBar
      hasRecord
      items={[
        { key: "lines", label: t("lines"), value: lines.length },
        ...(type === "recurring"
          ? [
              {
                key: "debit",
                label: t("debit"),
                value: formatCurrency(totals.debit / 100),
              },
              {
                key: "credit",
                label: t("credit"),
                value: formatCurrency(totals.credit / 100),
              },
            ]
          : type === "allocation"
            ? [
                {
                  key: "debit-ratio",
                  label: `${t("ratioSum")} · ${t("debit")}`,
                  value: (totals.ratio.debit / RATIO_SCALE).toFixed(4),
                },
                {
                  key: "credit-ratio",
                  label: `${t("ratioSum")} · ${t("credit")}`,
                  value: (totals.ratio.credit / RATIO_SCALE).toFixed(4),
                },
                {
                  key: "amount",
                  label: t("allocateAmount"),
                  value: formatCurrency(allocateAmount),
                },
              ]
            : [
                {
                  key: "amount",
                  label: t("totalAmount"),
                  value: formatCurrency(totalAmount),
                },
              ]),
      ]}
    >
      {type === "recurring" && (
        <TotalChip
          ok={totals.debit === totals.credit}
          okLabel={t("balanced")}
          badLabel={t("unbalanced")}
        />
      )}
      {type === "allocation" && (
        <TotalChip
          ok={
            totals.ratio.debit === RATIO_SCALE &&
            totals.ratio.credit === RATIO_SCALE
          }
          okLabel={t("balanced")}
          badLabel={t("unbalanced")}
        />
      )}
    </SummaryFooterBar>
  );
}

/** โหมดดู — ชื่อ cost center เป็นข้อความ (ว่าง = "—") ไม่ใช่ combobox ที่ disabled */
function CostCenterText({ id }: { readonly id: string | null }) {
  const { data } = useCostCenterById(id || undefined);
  return (
    <FieldPlainText>
      {id && data && data.id === id ? `${data.code} · ${data.name}` : null}
    </FieldPlainText>
  );
}

function TotalChip({
  ok,
  okLabel,
  badLabel,
}: {
  readonly ok: boolean;
  readonly okLabel: string;
  readonly badLabel: string;
}) {
  return (
    <StatusDotBadge tone={ok ? "success" : "warning"}>
      {ok ? okLabel : badLabel}
    </StatusDotBadge>
  );
}
