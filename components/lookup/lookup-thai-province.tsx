import { useTranslations } from "use-intl";
import { useThaiProvinces, type ThaiProvince } from "@/hooks/use-thai-address";
import { LookupCombobox } from "./lookup-combobox";

interface LookupThaiProvinceProps {
  readonly value: number | "";
  readonly onValueChange: (provinceCode: number) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly onItemChange?: (province: ThaiProvince) => void;
  readonly error?: string;
}

export function LookupThaiProvince({
  value,
  onValueChange,
  disabled,
  className,
  size,
  onItemChange,
  error,
}: LookupThaiProvinceProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const { data, isLoading } = useThaiProvinces();

  const handleChange = (newValue: string, item?: ThaiProvince) => {
    if (item) {
      onValueChange(item.provinceCode);
      if (onItemChange) {
        onItemChange(item);
      }
    }
  };

  return (
    <LookupCombobox<ThaiProvince>
      resizeKey="thai-province"
      size={size}
      value={value.toString()}
      onValueChange={handleChange}
      items={data ?? []}
      getId={(p) => p.provinceCode.toString()}
      getLabel={(p) => p.provinceNameEn}
      getSearchValue={(p) =>
        `${p.provinceNameEn} ${p.provinceNameTh} ${p.provinceCode}`
      }
      disabled={disabled}
      isLoading={isLoading}
      placeholder={tl("select", { entity: tfl("province") })}
      className={className}
      error={error}
    />
  );
}
