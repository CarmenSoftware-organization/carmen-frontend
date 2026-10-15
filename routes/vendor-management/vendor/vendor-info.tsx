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
import { FieldPlainText } from "@/components/ui/field";
import { SettingSection } from "@/components/ui/setting-section";
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
    <SettingSection
      frameless
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
      <div className="sm:col-span-2">
        {infoFields.length === 0 ? (
          <VendorEmptySection
            compact={isView}
            icon={Info}
            title={t("info.noInfo")}
            description={t("info.noInfoDesc")}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {infoFields.map((field, index) => (
              <InfoRow
                key={field.id}
                form={form}
                index={index}
                isView={isView}
                isDisabled={isDisabled}
                onRemove={() => removeInfo(index)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </SettingSection>
  );
}

function InfoRow({
  form,
  index,
  isView,
  isDisabled,
  onRemove,
  t,
}: {
  readonly form: ReturnType<typeof useForm<VendorFormValues>>;
  readonly index: number;
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly onRemove: () => void;
  readonly t: (key: string) => string;
}) {
  if (isView) {
    const item = form.getValues(`info.${index}`);
    return (
      <div className="border-border/40 bg-background/40 grid grid-cols-[1fr_2fr_auto] items-center gap-3 rounded-lg border px-3 py-2">
        <FieldPlainText>{item.label}</FieldPlainText>
        <FieldPlainText>{item.value}</FieldPlainText>
        <span className="bg-muted text-muted-foreground text-micro-legal rounded-md px-2 py-0.5 font-semibold tracking-widest uppercase">
          {item.data_type}
        </span>
      </div>
    );
  }

  return (
    <div className="border-border/40 bg-background/40 hover:border-foreground/30 grid grid-cols-[1fr_1fr_8rem_auto] items-start gap-2 rounded-lg border p-2 transition-colors">
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
