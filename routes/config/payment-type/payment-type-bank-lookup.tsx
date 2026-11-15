import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { MOCK_BANKS } from "../shared/ap-master-mock-data";

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
  return (
    <LookupCombobox
      value={value ?? ""}
      onValueChange={(id) => onChange(id || null)}
      items={MOCK_BANKS}
      getId={(item) => item.id}
      getLabel={(item) => item.code}
      getSearchValue={(item) => item.code}
      defaultLabel={defaultLabel}
      disabled={disabled}
      readOnly={readOnly}
      allowDeselect
      modal
    />
  );
}
