import { useTranslations } from "use-intl";
import {
  useThaiSubDistricts,
  type ThaiSubDistrict,
} from "@/hooks/use-thai-address";
import { LookupCombobox } from "./lookup-combobox";

interface LookupThaiSubDistrictProps {
  readonly districtCode: number | "";
  readonly value: number | "";
  readonly onValueChange: (subdistrictCode: number) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly onItemChange?: (subdistrict: ThaiSubDistrict) => void;
  readonly error?: string;
}

export function LookupThaiSubDistrict({
  districtCode,
  value,
  onValueChange,
  disabled,
  className,
  size,
  onItemChange,
  error,
}: LookupThaiSubDistrictProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const { data, isLoading } = useThaiSubDistricts(
    districtCode === "" ? undefined : districtCode,
  );

  const handleChange = (newValue: string, item?: ThaiSubDistrict) => {
    if (item) {
      onValueChange(item.subdistrictCode);
      if (onItemChange) {
        onItemChange(item);
      }
    }
  };

  return (
    <LookupCombobox<ThaiSubDistrict>
      resizeKey="thai-subdistrict"
      size={size}
      value={value.toString()}
      onValueChange={handleChange}
      items={data ?? []}
      getId={(d) => d.subdistrictCode.toString()}
      getLabel={(d) => d.subdistrictNameEn}
      getSearchValue={(d) =>
        `${d.subdistrictNameEn} ${d.subdistrictNameTh} ${d.subdistrictCode}`
      }
      disabled={disabled || !districtCode}
      isLoading={isLoading}
      placeholder={tl("select", { entity: tfl("subDistrict") })}
      className={className}
      error={error}
    />
  );
}
