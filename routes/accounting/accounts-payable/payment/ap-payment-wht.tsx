import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { ACTIVE_ONLY_FILTER } from "@/hooks/use-lookup-pagination";
import { createConfigApi } from "@/lib/config-crud";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { LookupAccountingMaster } from "@/components/lookup/lookup-accounting-master";
import { ApReadValue } from "../shared/ap-read-value";
import type { ApPayment } from "@/types/accounts-payable";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import type { PaymentErrorKey, PaymentWhtRow } from "./ap-payment-form";
import { percentOf } from "../shared/ap-decimal";

interface WhtProfile {
  id: string;
  name: string;
  tax_rate: number;
  wht_pnd_form?: string | null;
  wht_income_type?: string | null;
}

const profileApi = createConfigApi<WhtProfile, never>({
  endpoint: API_ENDPOINTS.TAX_PROFILES,
  label: "WHT profiles",
});

// เงินบาทไม่เกิน 2 ตำแหน่ง — backend ปัดเศษเงียบ ๆ ถ้าให้พิมพ์เกิน ยอดบนจอจะไม่ตรงที่บันทึก
const DECIMAL_RE = /^\d*(\.\d{0,2})?$/;
const TH = "px-2 py-1.5 text-xs font-medium whitespace-nowrap";
const TD = "px-2 py-1.5 text-xs align-middle";

/** WHT ที่คำนวณจาก allocations (wht-preview) แก้ยอดทับได้ → ส่งเป็น is_override */
export function PaymentWhtSection({
  rows,
  manual = false,
  editable,
  calculating,
  stale,
  error,
  errors,
  onChange,
  onAdd,
  onRemove,
  onRecalculate,
  payee,
  condition = "withholding",
  onConditionChange,
}: {
  readonly rows: readonly PaymentWhtRow[];
  readonly manual?: boolean;
  readonly editable: boolean;
  readonly calculating: boolean;
  /** allocations เปลี่ยนแล้วแต่ WHT ยังไม่ได้คำนวณใหม่ (รอ/กำลังคำนวณ/ล้มเหลว) */
  readonly stale: boolean;
  /** ข้อความ error ของ wht-preview รอบล่าสุด */
  readonly error: string | null;
  readonly errors: ReadonlySet<PaymentErrorKey>;
  readonly onChange: (key: string, patch: Partial<PaymentWhtRow>) => void;
  readonly onAdd: () => void;
  readonly onRemove: (key: string) => void;
  readonly onRecalculate: () => void;
  readonly payee?: ApPayment | null;
  readonly condition?: "withholding" | "paid_permanently" | "paid_once";
  readonly onConditionChange?: (
    condition: "withholding" | "paid_permanently" | "paid_once",
  ) => void;
}) {
  const t = useTranslations("accounting.accountsPayable.payment.detail.wht");
  const format = useAmountFormatter();
  const ui = useTranslations("accounting.accountsPayable.ui");
  const taxProfile = useTranslations("config.taxProfile");
  const bu = useBuCode();
  const profiles = useQuery({
    queryKey: [QUERY_KEYS.TAX_PROFILES, bu, "ap-wht-profiles"],
    enabled: editable && !!bu && rows.some((row) => !!row.wht_tax_profile_id),
    queryFn: () =>
      fetchAllPages((page, perpage) =>
        profileApi.getList(bu!, {
          page,
          perpage,
          filter: `tax_type|string:wht,${ACTIVE_ONLY_FILTER}`,
        }),
      ),
  });
  const noProfiles = profiles.isSuccess && profiles.data.length === 0;
  return (
    <Card className="min-w-0 gap-3 rounded-none border-0 bg-transparent py-0">
      <CardHeader className="flex flex-wrap items-center justify-between px-0">
        <CardTitle>{t("title")}</CardTitle>
        {editable && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAdd}
              disabled={rows.length >= 3 || calculating}
              title={rows.length >= 3 ? t("limit") : undefined}
            >
              <Plus className="size-4" />
              {t("add")}
            </Button>
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
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {editable && noProfiles && (
          <p className="text-muted-foreground mb-2 text-xs">
            {t("noProfiles")}
          </p>
        )}
        {editable && (manual || rows.some((row) => row.is_override)) && (
          <p className="text-muted-foreground mb-2 text-xs">
            {t("manualOverride")}
          </p>
        )}
        {rows.length > 0 && (
          <Field className="mb-4 max-w-sm">
            <FieldLabel required>{ui("whtCondition")}</FieldLabel>
            {editable ? (
              <Select
                value={condition}
                onValueChange={(value) =>
                  onConditionChange?.(value as typeof condition)
                }
              >
                <SelectTrigger aria-label={ui("whtCondition")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["withholding", "paid_permanently", "paid_once"] as const
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {ui(`whtConditions.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ApReadValue>{ui(`whtConditions.${condition}`)}</ApReadValue>
            )}
          </Field>
        )}
        {payee && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ui("payeeName"), payee.payee_name],
              [ui("taxId"), payee.payee_tax_no],
              [ui("branchNo"), payee.payee_branch_no],
              [ui("address"), payee.payee_address],
            ].map(([label, value]) => (
              <Field key={label}>
                <FieldLabel>{label}</FieldLabel>
                <ApReadValue>{value || "—"}</ApReadValue>
              </Field>
            ))}
          </div>
        )}
        {editable && error && (
          <p role="alert" className="text-destructive mb-2 text-xs">
            {t("previewFailed", { message: error })}
          </p>
        )}
        {editable && profiles.isError && (
          <p role="alert" className="text-destructive mb-2 text-xs">
            {t("profileLoadError")}{" "}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void profiles.refetch()}
            >
              {ui("retry")}
            </Button>
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
            <table className="w-full min-w-[44rem] text-left">
              <thead>
                <tr className="border-b">
                  <th className={TH}>
                    <FieldLabel required>{ui("whtServiceType")}</FieldLabel>
                  </th>
                  <th className={TH}>
                    <FieldLabel required>{ui("whtForm")}</FieldLabel>
                  </th>
                  <th className={TH}>{t("incomeType")}</th>
                  <th className={`${TH} text-right`}>{t("rate")}</th>
                  <th className={`${TH} text-right`}>{t("base")}</th>
                  <th className={`${TH} text-right`}>{t("amount")}</th>
                  {editable && <th className={TH} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className={TD}>
                      {editable && !row.wht_tax_profile_id ? (
                        <LookupAccountingMaster
                          kind="service"
                          value={row.wht_service_type_id}
                          defaultLabel={row.name}
                          disabled={calculating}
                          onChange={(id, item) =>
                            onChange(row.key, {
                              wht_tax_profile_id: null,
                              wht_service_type_id: id,
                              name: item?.description ?? "",
                              income_type: item?.description ?? null,
                              rate: String(item?.rate_percent ?? 0),
                              wht_amount: percentOf(
                                row.base_amount || "0",
                                String(item?.rate_percent ?? 0),
                              ),
                              is_override: false,
                            })
                          }
                        />
                      ) : editable ? (
                        <Select
                          value={row.wht_tax_profile_id ?? ""}
                          disabled={
                            profiles.isLoading ||
                            profiles.isError ||
                            calculating
                          }
                          onValueChange={(id) => {
                            const profile = profiles.data?.find(
                              (item) => item.id === id,
                            );
                            if (!profile) return;
                            onChange(row.key, {
                              wht_tax_profile_id: id,
                              name: profile.name,
                              rate: String(profile.tax_rate),
                              pnd_form: profile.wht_pnd_form,
                              income_type: profile.wht_income_type,
                              wht_amount: percentOf(
                                row.base_amount || "0",
                                String(profile.tax_rate),
                              ),
                              is_override: true,
                            });
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="min-w-44"
                            aria-label={`${t("profile")} ${row.name}`}
                          >
                            <SelectValue placeholder={t("profile")} />
                          </SelectTrigger>
                          <SelectContent>
                            {noProfiles && (
                              <SelectItem value="__empty__" disabled>
                                {t("noProfiles")}
                              </SelectItem>
                            )}
                            {!profiles.data?.some(
                              (item) => item.id === row.wht_tax_profile_id,
                            ) &&
                              row.wht_tax_profile_id && (
                                <SelectItem
                                  value={row.wht_tax_profile_id ?? ""}
                                  disabled
                                >
                                  {row.name}
                                </SelectItem>
                              )}
                            {(profiles.data ?? []).map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        row.name || "—"
                      )}
                      {row.is_override && (
                        <span className="text-warning-ink ml-2">
                          {t("override")}
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {editable && !row.wht_tax_profile_id ? (
                        <LookupAccountingMaster
                          kind="form"
                          value={row.wht_form_id}
                          defaultLabel={row.wht_form_label}
                          disabled={calculating}
                          onChange={(id, item) =>
                            onChange(row.key, {
                              wht_form_id: id,
                              wht_form_label: item
                                ? `${item.code} · ${item.description}`
                                : undefined,
                            })
                          }
                        />
                      ) : (
                        row.wht_form_label ||
                        (row.pnd_form
                          ? taxProfile.has(row.pnd_form)
                            ? taxProfile(row.pnd_form)
                            : row.pnd_form
                          : "—")
                      )}
                    </td>
                    <td className={TD}>{row.income_type || "—"}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {format(Number(row.rate || 0))}%
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {editable ? (
                        <Input
                          aria-label={`${t("base")} ${row.name}`}
                          inputMode="decimal"
                          className="ml-auto w-32 text-right tabular-nums"
                          value={row.base_amount}
                          disabled={calculating}
                          onChange={(event) => {
                            if (DECIMAL_RE.test(event.target.value))
                              onChange(row.key, {
                                base_amount: event.target.value,
                                wht_amount: percentOf(
                                  event.target.value || "0",
                                  row.rate,
                                ),
                                is_override: true,
                              });
                          }}
                        />
                      ) : (
                        format(Number(row.base_amount || 0))
                      )}
                    </td>
                    <td className={TD}>
                      {editable ? (
                        <Input
                          aria-label={`${t("amount")} ${row.name}`}
                          inputMode="decimal"
                          className="ml-auto w-32 text-right tabular-nums"
                          value={row.wht_amount}
                          disabled={calculating}
                          onChange={(event) => {
                            if (DECIMAL_RE.test(event.target.value))
                              onChange(row.key, {
                                wht_amount: event.target.value,
                                is_override: true,
                              });
                          }}
                        />
                      ) : (
                        <span className="block text-right tabular-nums">
                          {format(Number(row.wht_amount || 0))}
                        </span>
                      )}
                    </td>
                    {editable && (
                      <td className={TD}>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${t("remove")} ${row.name}`}
                          disabled={calculating}
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
        {errors.has("whtAmount") && (
          <p className="text-destructive mt-2 text-xs">{t("errors.amount")}</p>
        )}
      </CardContent>
    </Card>
  );
}
