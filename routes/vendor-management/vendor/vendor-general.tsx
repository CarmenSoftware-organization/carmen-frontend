import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupBuType } from "@/components/lookup/lookup-bu-type";
import { StatusSwitch } from "@/components/ui/status-switch";
import { StatusBadge } from "@/components/ui/status-badge";
import { SettingSection } from "@/components/ui/setting-section";
import type { VendorFormValues } from "./vendor-form-schema";
import { VendorRatingInput, VendorRatingStars } from "./vendor-rating";

interface VendorGeneralProps {
  readonly form: ReturnType<typeof useForm<VendorFormValues>>;
  readonly isDisabled: boolean;
}

export function VendorGeneral({ form, isDisabled }: VendorGeneralProps) {
  const t = useTranslations("vendorManagement.vendor");
  const tfl = useTranslations("field");
  const isView = isDisabled && !form.formState.isSubmitting;

  const businessTypes = form.getValues("business_types");
  const rating = form.getValues("rating");

  return (
    <SettingSection first title={tfl("general")} description={t("generalDesc")}>
      {/* Name */}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="vendor-name">
          {tfl("name")}
          {!isView && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {isView ? (
          <FieldPlainText>{form.getValues("name")}</FieldPlainText>
        ) : (
          <FieldInput
            id="vendor-name"
            placeholder={t("namePlaceholder")}
            disabled={isDisabled}
            error={form.formState.errors.name?.message}
            maxLength={100}
            {...form.register("name")}
          />
        )}
      </Field>

      {/* Code */}
      <Field>
        <FieldLabel htmlFor="vendor-code">
          {tfl("code")}
          {!isView && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {isView ? (
          <FieldPlainText>{form.getValues("code")}</FieldPlainText>
        ) : (
          <FieldInput
            id="vendor-code"
            placeholder={t("codePlaceholder")}
            disabled={isDisabled}
            error={form.formState.errors.code?.message}
            maxLength={10}
            {...form.register("code")}
          />
        )}
      </Field>

      {/* Rating — ครึ่งขวาข้าง Code (Code ยาวสุด 10 ตัว ครึ่งแถวพอ) */}
      <Field>
        <FieldLabel htmlFor="vendor-rating">{t("rating")}</FieldLabel>
        {isView ? (
          <FieldPlainText>
            {rating == null ? (
              <span className="text-muted-foreground font-normal">
                {t("notRated")}
              </span>
            ) : (
              <VendorRatingStars value={rating} />
            )}
          </FieldPlainText>
        ) : (
          <Controller
            control={form.control}
            name="rating"
            render={({ field }) => (
              <VendorRatingInput
                id="vendor-rating"
                value={field.value}
                onChange={field.onChange}
                disabled={isDisabled}
              />
            )}
          />
        )}
      </Field>

      {/* Business type — เต็มแถว ไม่แชร์กับ Code
          ชื่อประเภทธุรกิจยาวได้ถึง 40 ตัวอักษร ("Furniture, Fixtures & Equipment
          (FF&E)") และเลือกได้หลายอัน ขณะที่ Code ยาวสุด 10 ตัว การจับคู่กันในแถว
          เดียวคือให้ครึ่งที่ไม่ต้องใช้กับ Code แล้วบีบครึ่งที่ต้องใช้จนล้น */}
      <Field className="sm:col-span-2">
        <FieldLabel>{tfl("businessType")}</FieldLabel>
        {isView ? (
          <FieldPlainText>
            {businessTypes && businessTypes.length > 0
              ? businessTypes.map((b) => b.name).join(", ")
              : null}
          </FieldPlainText>
        ) : (
          <Controller
            control={form.control}
            name="business_types"
            render={({ field }) => (
              <LookupBuType
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
              />
            )}
          />
        )}
      </Field>

      {/* Tax ID + Branch No. — คู่กันในแถวเดียว ใบกำกับภาษีอ้างถึงทั้งสองค่าพร้อมกัน */}
      <Field>
        <FieldLabel htmlFor="vendor-tax-no">{t("taxNo")}</FieldLabel>
        {isView ? (
          <FieldPlainText className="tabular-nums">
            {form.getValues("tax_no") || null}
          </FieldPlainText>
        ) : (
          <FieldInput
            id="vendor-tax-no"
            placeholder={t("taxNoPlaceholder")}
            disabled={isDisabled}
            error={form.formState.errors.tax_no?.message}
            maxLength={20}
            autoComplete="off"
            className="tabular-nums"
            {...form.register("tax_no")}
          />
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="vendor-branch-no">{t("branchNo")}</FieldLabel>
        {isView ? (
          <FieldPlainText className="tabular-nums">
            {form.getValues("branch_no") || null}
          </FieldPlainText>
        ) : (
          <FieldInput
            id="vendor-branch-no"
            placeholder={t("branchNoPlaceholder")}
            disabled={isDisabled}
            error={form.formState.errors.branch_no?.message}
            maxLength={10}
            autoComplete="off"
            className="tabular-nums"
            {...form.register("branch_no")}
          />
        )}
      </Field>

      {/* Description */}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="vendor-description">
          {tfl("description")}
        </FieldLabel>
        {isView ? (
          <FieldPlainText className="whitespace-pre-wrap">
            {form.getValues("description")}
          </FieldPlainText>
        ) : (
          <Textarea
            id="vendor-description"
            placeholder={tfl("optional")}
            rows={2}
            maxLength={256}
            disabled={isDisabled}
            className="resize-none"
            {...form.register("description")}
          />
        )}
      </Field>

      {/* Status */}
      <Field className="sm:col-span-2">
        <FieldLabel>{tfl("status")}</FieldLabel>
        {isView ? (
          // ครอบด้วย FieldPlainText เพื่อให้ badge นับเป็น "ค่าโหมด view" เหมือน
          // field อื่นในหน้าเดียวกัน — label เงียบลงและระยะ label→ค่าเท่ากันทั้ง section
          <FieldPlainText>
            <StatusBadge active={form.getValues("is_active")} />
          </FieldPlainText>
        ) : (
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="vendor-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isDisabled}
              />
            )}
          />
        )}
      </Field>
    </SettingSection>
  );
}
