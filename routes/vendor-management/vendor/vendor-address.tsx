import { useEffect, useState } from "react";
import { Controller, type useFieldArray, type useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useQueryClient } from "@tanstack/react-query";
import type { VendorFormValues } from "./vendor-form-schema";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ADDRESS_TYPE_OPTIONS } from "@/constant/vendor";
import {
  Contact,
  Landmark,
  Mail,
  MapPin,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { EMPTY_VENDOR_ADDRESS } from "./vendor-form-schema";
import { LookupThaiProvince } from "@/components/lookup/lookup-thai-province";
import { LookupThaiDistrict } from "@/components/lookup/lookup-thai-district";
import { LookupThaiSubDistrict } from "@/components/lookup/lookup-thai-subdistrict";
import type {
  ThaiDistrict,
  ThaiProvince,
  ThaiSubDistrict,
} from "@/hooks/use-thai-address";
import { CACHE_STATIC } from "@/lib/cache-config";
import { cn } from "@/lib/utils";
import { SettingSection } from "@/components/ui/setting-section";
import { VendorEmptySection } from "./vendor-empty-section";

interface VendorAddressTabProps {
  form: ReturnType<typeof useForm<VendorFormValues>>;
  isDisabled: boolean;
  addressFields: ReturnType<
    typeof useFieldArray<VendorFormValues, "vendor_address">
  >["fields"];
  prependAddress: ReturnType<
    typeof useFieldArray<VendorFormValues, "vendor_address">
  >["prepend"];
  removeAddress: (index: number) => void;
}

export function VendorAddress({
  form,
  isDisabled,
  addressFields,
  prependAddress,
  removeAddress,
}: VendorAddressTabProps) {
  "use no memo";
  const t = useTranslations("vendorManagement.vendor");
  const isView = isDisabled && !form.formState.isSubmitting;
  const handleAdd = () => prependAddress(EMPTY_VENDOR_ADDRESS);

  return (
    <SettingSection
      frameless
      title={t("addressesLabel")}
      description={t("addressesDesc")}
      count={addressFields.length}
      action={
        !isView ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAdd}
          >
            <Plus />
            {t("address.addAddress")}
          </Button>
        ) : undefined
      }
    >
      <div className="sm:col-span-2">
        {addressFields.length === 0 ? (
          <VendorEmptySection
            compact={isView}
            icon={MapPin}
            title={t("address.noAddresses")}
            description={t("address.noAddressesDesc")}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {addressFields.map((field, index) => (
              <AddressRow
                key={field.id}
                form={form}
                index={index}
                isDisabled={isDisabled}
                onRemove={() => removeAddress(index)}
              />
            ))}
          </div>
        )}
      </div>
    </SettingSection>
  );
}

interface AddressRowProps {
  form: ReturnType<typeof useForm<VendorFormValues>>;
  index: number;
  isDisabled: boolean;
  onRemove: () => void;
}

const ADDRESS_TYPE_ICON: Record<string, LucideIcon> = {
  contact_address: Contact,
  mailing_address: Mail,
  register_address: Landmark,
};

const AddressRow = ({ form, index, isDisabled, onRemove }: AddressRowProps) => {
  "use no memo";
  const t = useTranslations("vendorManagement.vendor");
  const addressTypeLabels: Record<string, string> = {
    contact_address: t("address.contactAddress"),
    mailing_address: t("address.mailingAddress"),
    register_address: t("address.registeredAddress"),
  };
  const hasError =
    !!form.formState.errors.vendor_address?.[index]?.address_type;
  const initialCountry =
    form.getValues(`vendor_address.${index}.country`) ?? "";
  const [isThai, setIsThai] = useState(
    !initialCountry || initialCountry === "Thailand",
  );
  const [provinceCode, setProvinceCode] = useState<number | "">("");
  const [districtCode, setDistrictCode] = useState<number | "">("");
  const [subdistrictCode, setSubdistrictCode] = useState<number | "">("");
  const queryClient = useQueryClient();

  const loadThaiData = () =>
    Promise.all([
      queryClient.ensureQueryData<ThaiSubDistrict[]>({
        queryKey: ["thai-subdistricts-all"],
        queryFn: () =>
          fetch("/data/thai-subdistricts.json").then((r) => r.json()),
        ...CACHE_STATIC,
      }),
      queryClient.ensureQueryData<ThaiDistrict[]>({
        queryKey: ["thai-districts-all"],
        queryFn: () => fetch("/data/thai-districts.json").then((r) => r.json()),
        ...CACHE_STATIC,
      }),
      queryClient.ensureQueryData<ThaiProvince[]>({
        queryKey: ["thai-provinces"],
        queryFn: () => fetch("/data/thai-provinces.json").then((r) => r.json()),
        ...CACHE_STATIC,
      }),
    ]);

  // ผู้ใช้พิมพ์รหัสไปรษณีย์เอง → เติมจังหวัด/อำเภอ(/ตำบลถ้ามีตัวเดียว) ลงฟอร์ม
  const resolveFromPostalCode = async (postalCode: string) => {
    if (postalCode.length !== 5) return;

    const [allSub, allDist, allProv] = await loadThaiData();

    const matches = allSub.filter((d) => d.postalCode === Number(postalCode));
    if (matches.length === 0) return;

    const first = matches[0];
    const district = allDist.find((d) => d.districtCode === first.districtCode);
    const province = allProv.find((p) => p.provinceCode === first.provinceCode);

    setProvinceCode(first.provinceCode);
    setDistrictCode(first.districtCode);
    form.setValue(
      `vendor_address.${index}.province`,
      province?.provinceNameEn ?? "",
    );
    form.setValue(
      `vendor_address.${index}.district`,
      district?.districtNameEn ?? "",
    );

    form.setValue(`vendor_address.${index}.country`, "Thailand");

    if (matches.length === 1) {
      setSubdistrictCode(matches[0].subdistrictCode);
      form.setValue(
        `vendor_address.${index}.sub_district`,
        matches[0].subdistrictNameEn,
      );
    } else {
      setSubdistrictCode("");
      form.setValue(`vendor_address.${index}.sub_district`, "");
    }
  };

  // เปิดที่อยู่เดิม → หา code ของ dropdown จาก "ชื่อที่บันทึกไว้" อย่างเดียว ห้ามเขียนฟอร์ม
  // เดิมเรียก resolveFromPostalCode ตอน mount (ทั้งโหมดดูและแก้ไข) ซึ่ง setValue ทับ:
  // รหัสไปรษณีย์ที่ครอบหลายตำบล (พบบ่อย) ทำให้ sub_district กลายเป็น "" แล้วกด Save
  // ส่งค่าว่างไปโดยไม่มีใครเห็น (dropdown ยังโชว์ตำบลเดิม) และถ้ารหัสคร่อมหลายอำเภอ
  // จังหวัด/อำเภอถูกทับด้วยของตำบลแรก · ชื่อที่หาไม่เจอ (ข้อมูลเก่า/สะกดต่าง) ปล่อย
  // dropdown ว่างไว้ ค่าในฟอร์มยังอยู่ครบ
  useEffect(() => {
    if (!isThai) return;
    const savedProvince =
      form.getValues(`vendor_address.${index}.province`) ?? "";
    const savedDistrict =
      form.getValues(`vendor_address.${index}.district`) ?? "";
    const savedSubDistrict =
      form.getValues(`vendor_address.${index}.sub_district`) ?? "";
    const postalCode =
      form.getValues(`vendor_address.${index}.postal_code`) ?? "";
    if (!savedProvince && !postalCode) return;

    let cancelled = false;
    loadThaiData().then(([allSub, allDist, allProv]) => {
      if (cancelled) return;
      const province = allProv.find((p) => p.provinceNameEn === savedProvince);
      if (!province) return;
      setProvinceCode(province.provinceCode);

      const district = allDist.find(
        (d) =>
          d.provinceCode === province.provinceCode &&
          d.districtNameEn === savedDistrict,
      );
      if (!district) return;
      setDistrictCode(district.districtCode);

      const sub = allSub.find(
        (s) =>
          s.districtCode === district.districtCode &&
          s.subdistrictNameEn === savedSubDistrict,
      );
      if (sub) setSubdistrictCode(sub.subdistrictCode);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePostalCodeChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    form.setValue(`vendor_address.${index}.postal_code`, value);
    if (isThai) {
      await resolveFromPostalCode(value);
    }
  };

  const handleLocationChange = (value: string) => {
    const isThailand = value === "thai";
    setIsThai(isThailand);

    if (!isThailand) {
      // Switching to International - reset Thai selections
      setProvinceCode("");
      setDistrictCode("");
      setSubdistrictCode("");
    } else {
      // Switching to Thailand - auto-fill country
      form.setValue(`vendor_address.${index}.country`, "Thailand");
    }
  };

  return (
    <div className="border-border/60 bg-card rounded-xl border p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Controller
            control={form.control}
            name={`vendor_address.${index}.address_type`}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
              >
                <SelectTrigger
                  className={cn(
                    "h-7 w-56 text-xs",
                    hasError && "border-destructive",
                  )}
                >
                  <SelectValue placeholder={t("address.typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPE_OPTIONS.map((opt) => {
                    const Icon = ADDRESS_TYPE_ICON[opt.value];
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          {Icon && (
                            <Icon
                              className="text-muted-foreground size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          {addressTypeLabels[opt.value] ?? opt.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          />
          <RadioGroup
            value={isThai ? "thai" : "international"}
            onValueChange={handleLocationChange}
            disabled={isDisabled}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-1">
              <RadioGroupItem value="thai" id={`thai-${index}`} />
              <Label
                htmlFor={`thai-${index}`}
                className="text-micro cursor-pointer font-normal"
              >
                {t("address.thailand")}
              </Label>
            </div>
            <div className="flex items-center gap-1">
              <RadioGroupItem
                value="international"
                id={`international-${index}`}
              />
              <Label
                htmlFor={`international-${index}`}
                className="text-micro cursor-pointer font-normal"
              >
                {t("address.international")}
              </Label>
            </div>
          </RadioGroup>
        </div>
        {!isDisabled && (
          <Button
            type="button"
            size="icon-xs"
            aria-label={t("address.removeAddress")}
            onClick={onRemove}
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
          >
            <X />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Input
          placeholder={t("address.addressLine1")}
          disabled={isDisabled}
          maxLength={256}
          {...form.register(`vendor_address.${index}.address_line1`)}
        />

        <Input
          placeholder={t("address.addressLine2")}
          disabled={isDisabled}
          maxLength={256}
          {...form.register(`vendor_address.${index}.address_line2`)}
        />

        {isThai ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <LookupThaiProvince
                value={provinceCode}
                onValueChange={(code) => {
                  setProvinceCode(code);
                  setDistrictCode("");
                  setSubdistrictCode("");
                }}
                onItemChange={(province) => {
                  form.setValue(
                    `vendor_address.${index}.province`,
                    province.provinceNameEn,
                  );
                  form.setValue(`vendor_address.${index}.district`, "");
                  form.setValue(`vendor_address.${index}.sub_district`, "");
                  form.setValue(`vendor_address.${index}.postal_code`, "");
                }}
                disabled={isDisabled}
              />
              <LookupThaiDistrict
                provinceCode={provinceCode}
                value={districtCode}
                onValueChange={(code) => {
                  setDistrictCode(code);
                  setSubdistrictCode("");
                }}
                onItemChange={(district) => {
                  form.setValue(
                    `vendor_address.${index}.district`,
                    district.districtNameEn,
                  );
                  form.setValue(`vendor_address.${index}.sub_district`, "");
                  form.setValue(`vendor_address.${index}.postal_code`, "");
                }}
                disabled={isDisabled}
              />
              <LookupThaiSubDistrict
                districtCode={districtCode}
                value={subdistrictCode}
                onValueChange={setSubdistrictCode}
                onItemChange={(subdistrict) => {
                  form.setValue(
                    `vendor_address.${index}.sub_district`,
                    subdistrict.subdistrictNameEn,
                  );
                  form.setValue(
                    `vendor_address.${index}.postal_code`,
                    subdistrict.postalCode.toString(),
                  );
                }}
                disabled={isDisabled}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t("address.postalCodeAuto")}
                disabled={isDisabled}
                maxLength={5}
                {...form.register(`vendor_address.${index}.postal_code`, {
                  onChange: handlePostalCodeChange,
                })}
              />
              <Input
                placeholder={t("address.country")}
                disabled
                value="Thailand"
                readOnly
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Input
                  placeholder={t("address.city")}
                  className={`h-7 text-xs ${form.formState.errors.vendor_address?.[index]?.city ? "ring-destructive ring-1" : ""}`}
                  disabled={isDisabled}
                  maxLength={100}
                  {...form.register(`vendor_address.${index}.city`)}
                />
                {form.formState.errors.vendor_address?.[index]?.city && (
                  <p className="text-destructive text-micro-legal">
                    {form.formState.errors.vendor_address[index].city.message}
                  </p>
                )}
              </div>
              <Input
                placeholder={t("address.district")}
                disabled={isDisabled}
                maxLength={100}
                {...form.register(`vendor_address.${index}.district`)}
              />
              <Input
                placeholder={t("address.subDistrict")}
                disabled={isDisabled}
                maxLength={100}
                {...form.register(`vendor_address.${index}.sub_district`)}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder={t("address.provinceState")}
                disabled={isDisabled}
                maxLength={100}
                {...form.register(`vendor_address.${index}.province`)}
              />
              <Input
                placeholder={t("address.postalCode")}
                disabled={isDisabled}
                maxLength={20}
                {...form.register(`vendor_address.${index}.postal_code`)}
              />
              <Input
                placeholder={t("address.country")}
                disabled={isDisabled}
                maxLength={100}
                {...form.register(`vendor_address.${index}.country`)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
