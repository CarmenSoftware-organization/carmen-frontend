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
import {
  EnumField,
  FIRST_SECTION_PAIR,
  TextField,
  ToggleField,
} from "./interface-fields";

export const posSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string(),
  api_key: z.string(),
  sync_frequency: z.enum(["manual", "hourly", "daily"]),
  default_location_code: z.string(),
  consumption_posting: z.enum(["recipe", "direct"]),
});

export type PosFormValues = z.infer<typeof posSchema>;

export const EMPTY_POS: PosFormValues = {
  enabled: false,
  endpoint: "",
  api_key: "",
  sync_frequency: "manual",
  default_location_code: "",
  consumption_posting: "recipe",
};

/**
 * แปลงค่าจาก app_config เป็นค่า form
 *
 * `api_key` ที่ backend ส่งมาเป็น mask (`***ENCRYPTED***`) ถูกเก็บไว้ตามเดิม — ถ้า user
 * ไม่แตะ ค่านี้จะถูกส่งกลับขึ้นไปแล้ว backend คืนค่าลับเดิมให้ (ดู `retainMaskedSecrets`)
 */
export function toFormValues(
  value: Record<string, unknown> | undefined,
): PosFormValues {
  if (!value) return EMPTY_POS;
  const parsed = posSchema.safeParse({ ...EMPTY_POS, ...value });
  return parsed.success ? parsed.data : EMPTY_POS;
}

export function toApiValue(values: PosFormValues): Record<string, unknown> {
  return { ...values };
}

// derive dropdown options from the schema so the two never drift
const FREQUENCIES = posSchema.shape.sync_frequency.options;
const POSTINGS = posSchema.shape.consumption_posting.options;

/**
 * หน้า config ของ POS brand เดียว — ตั้งค่าการดึงยอดขาย/การใช้วัตถุดิบจากระบบขายหน้าร้าน
 *
 * brand (Micros / Infrasys / Square) มาจาก route param — เก็บใน key `interface_pos_<brand>`
 * ไม่ใช่ field ในฟอร์ม
 *
 * @returns React element ของหน้า POS interface
 */
export default function PosInterfaceForm() {
  const t = useTranslations("systemAdmin.interface");
  const tp = useTranslations("systemAdmin.interface.pos");
  const { brand } = useParams<{ brand: string }>();
  const navigate = useNavigate();
  const { value, isLoading, isError, refetch, save, isSaving } =
    useInterfaceConfig(`interface_pos_${brand}`);

  const form = useForm<PosFormValues>({
    resolver: zodResolver(posSchema) as Resolver<PosFormValues>,
    defaultValues: EMPTY_POS,
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
      onCancel={() => form.reset(value ? toFormValues(value) : EMPTY_POS)}
      isSaving={isSaving}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
    >
      {/* การเชื่อมต่อ | การซิงก์ — หมวดละ 3 ช่อง */}
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
              label={t("endpoint")}
              field={form.register("endpoint")}
              viewValue={form.watch("endpoint")}
              error={form.formState.errors.endpoint?.message}
              placeholder="https://pos.example.com"
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

        <CompactSection title={tp("sync")} description={tp("syncDesc")}>
          <FieldGrid>
            <EnumField
              label={tp("syncFrequency")}
              value={form.watch("sync_frequency")}
              options={FREQUENCIES}
              optionLabel={(f) => t(`frequencyOption.${f}`)}
              onChange={(v) =>
                form.setValue("sync_frequency", v, { shouldDirty: true })
              }
            />
            <TextField
              label={tp("defaultLocationCode")}
              field={form.register("default_location_code")}
              viewValue={form.watch("default_location_code")}
              error={form.formState.errors.default_location_code?.message}
              placeholder="L1"
            />
            <EnumField
              label={tp("consumptionPosting")}
              value={form.watch("consumption_posting")}
              options={POSTINGS}
              optionLabel={(p) => tp(`postingOption.${p}`)}
              onChange={(v) =>
                form.setValue("consumption_posting", v, { shouldDirty: true })
              }
            />
          </FieldGrid>
        </CompactSection>
      </div>
    </InterfacePageLayout>
  );
}
