import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useInterfaceConfig } from "./use-interface-config";
import { InterfacePageLayout } from "./interface-page-layout";
import { FIRST_SECTION_PAIR, TextField, ToggleField } from "./interface-fields";

export const pmsSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string(),
  api_key: z.string(),
  property_code: z.string(),
  post_city_ledger: z.boolean(),
  post_credit_card: z.boolean(),
});

export type PmsFormValues = z.infer<typeof pmsSchema>;

export const EMPTY_PMS: PmsFormValues = {
  enabled: false,
  endpoint: "",
  api_key: "",
  property_code: "",
  post_city_ledger: false,
  post_credit_card: false,
};

export function toFormValues(
  value: Record<string, unknown> | undefined,
): PmsFormValues {
  if (!value) return EMPTY_PMS;
  const parsed = pmsSchema.safeParse({ ...EMPTY_PMS, ...value });
  return parsed.success ? parsed.data : EMPTY_PMS;
}

export function toApiValue(values: PmsFormValues): Record<string, unknown> {
  return { ...values };
}

/**
 * หน้า config ของ PMS brand เดียว — ตั้งค่าการ post City Ledger / Credit Card จากระบบ PMS
 *
 * brand (Opera / Protel) มาจาก route param — เก็บใน key `interface_pms_<brand>`
 * ไม่ใช่ field ในฟอร์ม
 *
 * City Ledger และ Credit Card เป็นสองอย่างที่ Carmen ดึงจาก PMS ผ่าน API
 * (ดู kb-carmen AR-posting_pms.md)
 *
 * @returns React element ของหน้า PMS interface
 */
export default function PmsInterfaceForm() {
  const t = useTranslations("systemAdmin.interface");
  const tp = useTranslations("systemAdmin.interface.pms");
  const { brand } = useParams<{ brand: string }>();
  const navigate = useNavigate();
  const { value, isLoading, isError, refetch, save, isSaving } =
    useInterfaceConfig(`interface_pms_${brand}`);

  const form = useForm<PmsFormValues>({
    resolver: zodResolver(pmsSchema) as Resolver<PmsFormValues>,
    defaultValues: EMPTY_PMS,
  });

  useEffect(() => {
    if (value) form.reset(toFormValues(value));
  }, [value, form]);

  const submit = form.handleSubmit(
    (values) =>
      save(toApiValue(values), {
        onSuccess: () => {
          toast.success(t("saved"));
          // กลับหน้ารายการ interface — guard ของหน้านี้ดักเฉพาะคลิกลิงก์กับปุ่ม back
          // ไม่ดัก navigate() จากโค้ด จึงไม่ต้อง reset form ก่อน
          navigate("/system-admin/interface");
        },
      }),
    () => scrollToFirstInvalidField(),
  );

  return (
    <InterfacePageLayout
      title={tp(`brand.${brand}`)}
      description={tp("desc")}
      onSave={submit}
      // คืนค่าที่บันทึกไว้ ไม่ใช่ค่า default — ยกเลิกแล้วต้องได้ของเดิมกลับมา
      onCancel={() => form.reset(value ? toFormValues(value) : EMPTY_PMS)}
      isSaving={isSaving}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
    >
      {/* การเชื่อมต่อ | การ post — วางเคียงกันบนจอกว้าง */}
      <div className={FIRST_SECTION_PAIR}>
        <CompactSection
          title={tp("connection")}
          description={tp("connectionDesc")}
        >
          <FieldGrid>
            <ToggleField
              label={t("enabled")}
              checked={form.watch("enabled")}
              onChange={(v) =>
                form.setValue("enabled", v, { shouldDirty: true })
              }
            />
            <TextField
              label={tp("propertyCode")}
              field={form.register("property_code")}
              viewValue={form.watch("property_code")}
              error={form.formState.errors.property_code?.message}
              placeholder="P1"
            />
            <TextField
              label={t("endpoint")}
              field={form.register("endpoint")}
              viewValue={form.watch("endpoint")}
              error={form.formState.errors.endpoint?.message}
              placeholder="https://pms.example.com"
            />
            <TextField
              label={t("apiKey")}
              field={form.register("api_key")}
              viewValue={form.watch("api_key")}
              error={form.formState.errors.api_key?.message}
              type="password"
              revealLabels={{ show: t("showSecret"), hide: t("hideSecret") }}
              hint={t("apiKeyHint")}
            />
          </FieldGrid>
        </CompactSection>

        <CompactSection title={tp("posting")} description={tp("postingDesc")}>
          <FieldGrid>
            <ToggleField
              label={tp("postCityLedger")}
              checked={form.watch("post_city_ledger")}
              onChange={(v) =>
                form.setValue("post_city_ledger", v, { shouldDirty: true })
              }
            />
            <ToggleField
              label={tp("postCreditCard")}
              checked={form.watch("post_credit_card")}
              onChange={(v) =>
                form.setValue("post_credit_card", v, { shouldDirty: true })
              }
            />
          </FieldGrid>
        </CompactSection>
      </div>
    </InterfacePageLayout>
  );
}
