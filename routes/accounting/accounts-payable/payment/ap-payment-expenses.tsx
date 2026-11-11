import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import type { PaymentErrorKey, PaymentExpenseRow } from "./ap-payment-form";

// เงินบาทไม่เกิน 2 ตำแหน่ง — backend ปัดเศษเงียบ ๆ ถ้าให้พิมพ์เกิน ยอดบนจอจะไม่ตรงที่บันทึก
const DECIMAL_RE = /^\d*(\.\d{0,2})?$/;
const TH = "px-2 py-1.5 text-xs font-medium whitespace-nowrap";
const TD = "px-2 py-1.5 text-xs align-middle";

/** ค่าธรรมเนียมธนาคาร/ค่าใช้จ่ายอื่นที่ลงบัญชีพร้อมใบจ่าย */
export function PaymentExpensesSection({
  rows,
  editable,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  readonly rows: readonly PaymentExpenseRow[];
  readonly editable: boolean;
  readonly errors: ReadonlySet<PaymentErrorKey>;
  readonly onAdd: () => void;
  readonly onChange: (key: string, patch: Partial<PaymentExpenseRow>) => void;
  readonly onRemove: (key: string) => void;
}) {
  const t = useTranslations(
    "accounting.accountsPayable.payment.detail.expenses",
  );
  const format = useAmountFormatter();
  if (!editable && rows.length === 0) return null;
  return (
    <Card className="min-w-0 gap-3 rounded-none border-0 bg-transparent py-0">
      <CardHeader className="flex flex-wrap items-center justify-between px-0">
        <CardTitle>{t("title")}</CardTitle>
        {editable && (
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left">
              <thead>
                <tr className="border-b">
                  <th className={TH}>{t("account")}</th>
                  <th className={TH}>{t("costCenter")}</th>
                  <th className={TH}>{t("description")}</th>
                  <th className={`${TH} text-right`}>{t("amount")}</th>
                  {editable && <th className={TH} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className={`${TD} min-w-48`}>
                      <LookupChartOfAccountById
                        value={row.chart_of_accounts_id}
                        disabled={!editable}
                        onValueChange={(id) =>
                          onChange(row.key, { chart_of_accounts_id: id })
                        }
                      />
                    </td>
                    <td className={`${TD} min-w-40`}>
                      <LookupCostCenter
                        value={row.cost_center_id}
                        disabled={!editable}
                        onValueChange={(id) =>
                          onChange(row.key, { cost_center_id: id })
                        }
                      />
                    </td>
                    <td className={`${TD} min-w-40`}>
                      <Input
                        aria-label={t("description")}
                        value={row.description}
                        readOnly={!editable}
                        onChange={(event) =>
                          onChange(row.key, { description: event.target.value })
                        }
                      />
                    </td>
                    <td className={TD}>
                      {editable ? (
                        <Input
                          aria-label={t("amount")}
                          inputMode="decimal"
                          className="ml-auto w-32 text-right tabular-nums"
                          value={row.amount}
                          onChange={(event) => {
                            if (DECIMAL_RE.test(event.target.value))
                              onChange(row.key, { amount: event.target.value });
                          }}
                        />
                      ) : (
                        <span className="block text-right tabular-nums">
                          {format(Number(row.amount || 0))}
                        </span>
                      )}
                    </td>
                    {editable && (
                      <td className={TD}>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={t("remove")}
                          onClick={() => onRemove(row.key)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errors.has("expense") && (
          <p className="text-destructive mt-2 text-xs">{t("error")}</p>
        )}
      </CardContent>
    </Card>
  );
}
