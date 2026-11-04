import { RefreshCw } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import type { DecimalString } from "@/types/accounts-payable";
import type { PaymentErrorKey, PaymentWhtRow } from "./ap-payment-form";

// เงินบาทไม่เกิน 2 ตำแหน่ง — backend ปัดเศษเงียบ ๆ ถ้าให้พิมพ์เกิน ยอดบนจอจะไม่ตรงที่บันทึก
const DECIMAL_RE = /^\d*(\.\d{0,2})?$/;
const TH = "px-2 py-1.5 text-xs font-medium whitespace-nowrap";
const TD = "px-2 py-1.5 text-xs align-middle";

/** WHT ที่คำนวณจาก allocations (wht-preview) แก้ยอดทับได้ → ส่งเป็น is_override */
export function PaymentWhtSection({
  rows,
  editable,
  calculating,
  stale,
  error,
  errors,
  onChangeAmount,
  onRecalculate,
}: {
  readonly rows: readonly PaymentWhtRow[];
  readonly editable: boolean;
  readonly calculating: boolean;
  /** allocations เปลี่ยนแล้วแต่ WHT ยังไม่ได้คำนวณใหม่ (รอ/กำลังคำนวณ/ล้มเหลว) */
  readonly stale: boolean;
  /** ข้อความ error ของ wht-preview รอบล่าสุด */
  readonly error: string | null;
  readonly errors: ReadonlySet<PaymentErrorKey>;
  readonly onChangeAmount: (key: string, amount: DecimalString) => void;
  readonly onRecalculate: () => void;
}) {
  const t = useTranslations("accounting.accountsPayable.payment.detail.wht");
  const format = useAmountFormatter();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("title")}</CardTitle>
        {editable && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={calculating}
            onClick={onRecalculate}
          >
            <RefreshCw className="size-4" />
            {calculating ? t("calculating") : t("recalculate")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editable && error && (
          <p role="alert" className="text-destructive mb-2 text-xs">
            {t("previewFailed", { message: error })}
          </p>
        )}
        {editable && stale && !calculating && (
          <p role="status" className="text-warning-ink mb-2 text-xs">
            {t("stale")}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left">
              <thead>
                <tr className="border-b">
                  <th className={TH}>{t("profile")}</th>
                  <th className={`${TH} text-right`}>{t("rate")}</th>
                  <th className={`${TH} text-right`}>{t("base")}</th>
                  <th className={`${TH} text-right`}>{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className={TD}>
                      {row.name || "—"}
                      {row.is_override && (
                        <span className="text-warning-ink ml-2">
                          {t("override")}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {format(Number(row.rate || 0))}%
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {format(Number(row.base_amount || 0))}
                    </td>
                    <td className={TD}>
                      {editable ? (
                        <Input
                          aria-label={`${t("amount")} ${row.name}`}
                          inputMode="decimal"
                          className="ml-auto w-32 text-right tabular-nums"
                          value={row.wht_amount}
                          onChange={(event) => {
                            if (DECIMAL_RE.test(event.target.value))
                              onChangeAmount(row.key, event.target.value);
                          }}
                        />
                      ) : (
                        <span className="block text-right tabular-nums">
                          {format(Number(row.wht_amount || 0))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errors.has("whtAmount") && (
          <p className="text-destructive mt-2 text-xs">
            {t("errors.amount")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
