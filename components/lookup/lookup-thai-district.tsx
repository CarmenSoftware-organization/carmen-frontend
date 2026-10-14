import { useTranslations } from "use-intl";
import { useThaiDistricts, type ThaiDistrict } from "@/hooks/use-thai-address";
import { LookupCombobox } from "./lookup-combobox";

interface LookupThaiDistrictProps {
  readonly provinceCode: number | "";
  readonly value: number | "";
  readonly onValueChange: (districtCode: number) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly onItemChange?: (district: ThaiDistrict) => void;
  readonly error?: string;
}

export function LookupThaiDistrict({
  provinceCode,
  value,
  onValueChange,
  disabled,
  className,
  size,
  onItemChange,
  error,
}: LookupThaiDistrictProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const { data, isLoading } = useThaiDistricts(
    provinceCode === "" ? undefined : provinceCode,
  );

  const handleChange = (newValue: string, item?: ThaiDistrict) => {
    if (item) {
      onValueChange(item.districtCode);
      if (onItemChange) {
        onItemChange(item);
      }
    }
  };

  return (
    <LookupCombobox<ThaiDistrict>
      resizeKey="thai-district"
      size={size}
      value={value.toString()}
      onValueChange={handleChange}
      items={data ?? []}
      getId={(d) => d.districtCode.toString()}
      getLabel={(d) => d.districtNameEn}
      getSearchValue={(d) =>
        `${d.districtNameEn} ${d.districtNameTh} ${d.districtCode}`
      }
      disabled={disabled || !provinceCode}
      isLoading={isLoading}
      placeholder={tl("select", { entity: tfl("district") })}
      className={className}
      error={error}
    />
  );
}
