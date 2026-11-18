import { LookupAccountingMaster } from "@/components/lookup/lookup-accounting-master";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupBuType } from "@/components/lookup/lookup-bu-type";
import { StatusSwitch } from "@/components/ui/status-switch";
import { FieldGrid } from "@/components/share/compact-section";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
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

  const rating = form.getValues("rating");

  const master = useTranslations("accounting.accountsPayable.master");
  // ไม่มีการ์ด/หัวหมวดของตัวเองแล้ว — ช่องชุดนี้วางเป็น ribbon ในการ์ดหัวหน้า (ทรงเดียวกับหัว PR)
  // โหมดแก้: FieldGrid ปกติ (ช่องกรอกต้องการความกว้าง)
  // โหมดดู: ข้อความล้วน ค่าสั้น จึงแน่นกว่า FieldGrid — 2 คอลัมน์บนมือถือ · 4 ตั้งแต่ @2xl (HD 1366
  // กล่อง ~900px = 2 แถว) · 8 ตั้งแต่ 96rem (Full HD ขึ้นไป = แถวเดียว) · ค่าไม่ต้องสูงเท่าช่องกรอก
  // (min-h-8) ป้ายชิดค่า เท่า SettingField ของหัว PR
  const fields = (children: React.ReactNode) =>
    isView ? (
      <div className="@container">
        <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 @2xl:grid-cols-4 @min-[96rem]:grid-cols-8 [&_[data-slot=field-plain-text]]:min-h-0 [&_[data-slot=field]]:gap-0.5">
          {children}
        </div>
      </div>
    ) : (
      <FieldGrid>{children}</FieldGrid>
    );
  return fields(
    <>
      {/* Name / Code / Status ไม่แสดงในโหมดดู — แถบหัว (FormToolbar) มีครบทั้งสามค่าแล้ว
          การ์ดนี้เคยซ้ำของบนหัวเกือบครึ่งการ์ด */}
      {/* Name */}
      {!isView && (
        <Field className="@md:col-span-2">
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
      )}

      {/* Code */}
      {!isView && (
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
      )}

      {/* Rating */}
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

      {/* Business type — ช่องเดียวของกริด ชื่อยาว ("Furniture, Fixtures & Equipment (FF&E)") ตัดบรรทัดในช่อง
            โหมดดูอยู่ในบรรทัดตัวตนใต้ชื่อแล้ว (ทรงเดียวกับบรรทัดผู้ขอ · แผนก ของหัว PR) */}
      {!isView && (
        <Field>
          <FieldLabel>{tfl("businessType")}</FieldLabel>
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
        </Field>
      )}

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

      {/* บัญชีเจ้าหนี้ default — เปิดใบ AP จาก vendor นี้จะดึงบัญชีนี้ไปใช้ */}
      <Field>
        <FieldLabel>{t("apAccount")}</FieldLabel>
        <Controller
          control={form.control}
          name="ap_chart_of_accounts_id"
          render={({ field }) =>
            isView ? (
              <VendorApAccountText id={field.value} />
            ) : (
              <LookupChartOfAccountById
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
              />
            )
          }
        />
      </Field>

      {(
        [
          { kind: "payment", name: "payment_type_id" },
          { kind: "form", name: "wht_form_id" },
          { kind: "service", name: "wht_service_type_id" },
        ] as const
      ).map(({ kind, name }) => (
        <Field key={name}>
          <FieldLabel>{master(kind)}</FieldLabel>
          <Controller
            control={form.control}
            name={name}
            render={({ field }) => (
              <LookupAccountingMaster
                kind={kind}
                value={field.value}
                onChange={field.onChange}
                disabled={isDisabled}
                readOnly={isView}
                allowDeselect
              />
            )}
          />
        </Field>
      ))}
      {/* Description — โหมดดูเต็มแถวบนมือถือ · ช่องเดียวตั้งแต่ @2xl
          (แบบหัว PR) ช่องโหมดดู 8 ช่องจึงลงตัว 2 แถวที่ 4 คอลัมน์ / แถวเดียวที่ 8 คอลัมน์ */}
      <Field
        data-wide=""
        className={isView ? "col-span-2 @2xl:col-span-1" : "@md:col-span-2"}
      >
        <FieldLabel htmlFor="vendor-description">
          {tfl("description")}
        </FieldLabel>
        {isView ? (
          <FieldPlainText className="whitespace-pre-wrap">
            {form.getValues("description")?.trim() || null}
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

      {/* Status — โหมดดูมี badge บนแถบหัวแล้ว */}
      {!isView && (
        <Field>
          <FieldLabel>{tfl("status")}</FieldLabel>
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
        </Field>
      )}
    </>,
  );
}

/** โหมดดู — แปลง uuid → "code - ชื่อ" ด้วยการดึงแถวเดียว (response ของ vendor ไม่มี code) */
function VendorApAccountText({ id }: { readonly id: string | null }) {
  const { data: account } = useChartOfAccountById(id || undefined);
  return (
    <FieldPlainText>
      {account && account.id === id
        ? `${account.code} - ${account.description_1}`
        : null}
    </FieldPlainText>
  );
}
