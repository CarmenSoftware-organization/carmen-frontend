import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Info, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { VendorEmptySection } from "./vendor-empty-section";
import { EMPTY_VENDOR_INFO, type VendorFormValues } from "./vendor-form-schema";

interface VendorInfoTabProps {
  readonly form: ReturnType<typeof useForm<VendorFormValues>>;
  readonly isDisabled: boolean;
  readonly infoFields: ReturnType<
    typeof useFieldArray<VendorFormValues, "info">
  >["fields"];
  readonly prependInfo: ReturnType<
    typeof useFieldArray<VendorFormValues, "info">
  >["prepend"];
  readonly removeInfo: ReturnType<
    typeof useFieldArray<VendorFormValues, "info">
  >["remove"];
}

export function VendorInfo({
  form,
  isDisabled,
  infoFields,
  prependInfo,
  removeInfo,
}: VendorInfoTabProps) {
  const t = useTranslations("vendorManagement.vendor");
  const isView = isDisabled && !form.formState.isSubmitting;

  return (
    <CompactSection
      // โหมดดู: ป้าย–ค่าเป็นช่องของกริดในการ์ดเดียว · โหมดแก้: แต่ละแถวมีกรอบของตัวเอง
      frameless={!isView || infoFields.length === 0}
      title={t("info.title")}
      description={t("infoDesc")}
      count={infoFields.length}
      action={
        !isView ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => prependInfo(EMPTY_VENDOR_INFO)}
          >
            <Plus />
            {t("info.addInfo")}
          </Button>
        ) : undefined
      }
    >
      {infoFields.length === 0 ? (
        <VendorEmptySection
          compact={isView}
          icon={Info}
          title={t("info.noInfo")}
          description={t("info.noInfoDesc")}
        />
      ) : isView ? (
        <FieldGrid>
          {infoFields.map((field, index) => {
            const item = form.getValues(`info.${index}`);
            return (
              <SettingField
                key={field.id}
                label={item.label}
                value={item.value}
              />
            );
          })}
        </FieldGrid>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,28rem),1fr))] gap-2">
          {infoFields.map((field, index) => (
            <InfoRow
              key={field.id}
              form={form}
              index={index}
              isDisabled={isDisabled}
              onRemove={() => removeInfo(index)}
              t={t}
            />
          ))}
        </div>
      )}
    </CompactSection>
  );
}

function InfoRow({
  form,
  index,
  isDisabled,
  onRemove,
  t,
}: {
  readonly form: ReturnType<typeof useForm<VendorFormValues>>;
  readonly index: number;
  readonly isDisabled: boolean;
  readonly onRemove: () => void;
  readonly t: (key: string) => string;
}) {
  return (
    <div className="border-border/40 bg-background/40 hover:border-foreground/30 grid min-w-0 grid-cols-[1fr_1fr_7rem_auto] items-start gap-2 rounded-lg border p-2 transition-colors">
      <Input
        placeholder={t("info.labelPlaceholder")}
        className="border-border/40 hover:border-foreground/50 focus-visible:border-primary h-8 rounded-md border bg-transparent text-xs shadow-none transition-colors focus-visible:ring-0"
        disabled={isDisabled}
        maxLength={100}
        {...form.register(`info.${index}.label`)}
      />
      <Input
        placeholder={t("info.valuePlaceholder")}
        className="border-border/40 hover:border-foreground/50 focus-visible:border-primary h-8 rounded-md border bg-transparent text-xs shadow-none transition-colors focus-visible:ring-0"
        disabled={isDisabled}
        maxLength={256}
        {...form.register(`info.${index}.value`)}
      />
      <Controller
        control={form.control}
        name={`info.${index}.data_type`}
        render={({ field: dtField }) => (
          <Select
            value={dtField.value}
            onValueChange={dtField.onChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="h-8 rounded-md text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">{t("info.typeString")}</SelectItem>
              <SelectItem value="number">{t("info.typeNumber")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <Button
        type="button"
        size="icon-xs"
        aria-label={t("info.removeInfo")}
        onClick={onRemove}
        variant="ghost"
        className="text-muted-foreground hover:text-destructive mt-0.5"
      >
        <X />
      </Button>
    </div>
  );
}
