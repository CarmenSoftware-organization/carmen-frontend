import { useTranslations } from "use-intl";
import { currenciesIso } from "@/constant/currencies-iso";
import { LookupCombobox } from "./lookup-combobox";

interface LookupCurrencyIsoProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

export function LookupCurrencyIso({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  error,
}: LookupCurrencyIsoProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");

  return (
    <LookupCombobox
      resizeKey="currency-iso"
      size={size}
      value={value}
      onValueChange={(id) => onValueChange(id)}
      items={currenciesIso}
      getId={(c) => c.code}
      getLabel={(c) => `${c.code} — ${c.name}`}
      getSearchValue={(c) => `${c.code} ${c.name} ${c.country}`}
      renderSelected={(c) => `${c.code} — ${c.name}`}
      placeholder={placeholder ?? tl("select", { entity: tfl("currencyCode") })}
      searchPlaceholder={tl("search", { entity: tfl("currency") })}
      disabled={disabled}
      className={className}
      modal
      popoverClassName="z-60"
      error={error}
    />
  );
}
