import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { useBankAccounts } from "@/hooks/use-accounting-master";
import { useTranslations } from "use-intl";

export function PaymentTypeBankLookup({
  value,
  onChange,
  defaultLabel,
  disabled,
  readOnly,
}: {
  readonly value: string | null;
  readonly onChange: (id: string | null) => void;
  readonly defaultLabel?: string;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
}) {
  const banks = useBankAccounts();
  const t = useTranslations("config.apMaster");
  return (
    <LookupCombobox
      value={value ?? ""}
      onValueChange={(id) => onChange(id || null)}
      items={banks.data?.filter((bank) => bank.is_active) ?? []}
      getId={(item) => item.id}
      getLabel={(item) =>
        [item.code, item.account_name].filter(Boolean).join(" · ")
      }
      getSearchValue={(item) => `${item.code} ${item.account_name}`}
      defaultLabel={defaultLabel}
      disabled={disabled || banks.isLoading || !!banks.error}
      isLoading={banks.isLoading}
      error={banks.error ? t("bankAccountsLoadFailed") : undefined}
      readOnly={readOnly}
      allowDeselect
      modal
    />
  );
}
