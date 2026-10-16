import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { SettingSection } from "@/components/ui/setting-section";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useInterfaceConfig } from "./use-interface-config";
import { InterfacePageLayout } from "./interface-page-layout";
import { EnumField, TextField, ToggleField } from "./interface-fields";

export const COA_ON_DUPLICATE = ["skip", "upsert", "error"] as const;
export const COA_ON_LOCAL_ONLY = ["keep", "delete"] as const;

export const syncPolicySchema = z.object({
  on_duplicate: z.enum(COA_ON_DUPLICATE),
  on_local_only: z.enum(COA_ON_LOCAL_ONLY),
});

export const carmenGlSchema = z.object({
  enabled: z.boolean(),
  api_server: z.string(),
  authorize_token: z.string(),
  account_code_path: z.string(),
  department_path: z.string(),
  vendor_path: z.string(),
  set_account_mapping_all_items: z.boolean(),
  allow_posting_transfer_to_gl: z.boolean(),
  /**
   * ฝั่ง backend เป็น `.optional()` โดยตั้งใจ (คอนฟิกเก่ายังไม่มีคีย์นี้) แต่ฝั่งฟอร์ม
   * บังคับให้มีเสมอ — schema ที่ไม่มีคีย์นี้จะ strip ค่าที่ผู้ใช้ตั้งไว้ทิ้งตอน Save
   */
  sync_policy: syncPolicySchema,
});

export type CarmenGlFormValues = z.infer<typeof carmenGlSchema>;

export const EMPTY_CARMEN_GL: CarmenGlFormValues = {
  enabled: false,
  api_server: "",
  authorize_token: "",
  account_code_path: "api/interface/accountCode",
  department_path: "api/interface/department",
  vendor_path: "api/interface/vendor",
  set_account_mapping_all_items: true,
  allow_posting_transfer_to_gl: false,
  // ตรงกับ fallback ของ backend ตอน import (`?? "skip"` / `?? "keep"`) — คอนฟิกที่ยังไม่เคย
  // ตั้งค่านี้จึงถูกบันทึกด้วยค่าที่ให้พฤติกรรมเดิมทุกประการ ไม่ใช่ค่าที่เปลี่ยนผลลัพธ์เงียบ ๆ
  sync_policy: { on_duplicate: "skip", on_local_only: "keep" },
};

export function toFormValues(
  value: Record<string, unknown> | undefined,
): CarmenGlFormValues {
  if (!value) return EMPTY_CARMEN_GL;
  // `sync_policy` ต้อง merge ลึกอีกชั้น — คอนฟิกเก่าไม่มีคีย์นี้เลย และถ้ามีมาแค่ครึ่งเดียว
  // การ merge ตื้นจะทำให้ทั้งฟอร์ม parse ไม่ผ่านแล้วตกไปเป็น EMPTY ทั้งก้อน
  const parsed = carmenGlSchema.safeParse({
    ...EMPTY_CARMEN_GL,
    ...value,
    sync_policy: {
      ...EMPTY_CARMEN_GL.sync_policy,
      ...(value.sync_policy as Record<string, unknown> | undefined),
    },
  });
  return parsed.success ? parsed.data : EMPTY_CARMEN_GL;
}

export function toApiValue(
  values: CarmenGlFormValues,
): Record<string, unknown> {
  return { ...values };
}

/**
 * หน้า config ของ Carmen GL (Carmen 4 legacy) — API server + authorize token +
 * endpoint path 3 เส้น + option การ post GL
 *
 * brand เดียวที่ใช้ฟอร์มนี้คือ carmen_gl (form override ใน registry) — config key จึง fix ได้
 *
 * `authorize_token` เป็น secret: backend เข้ารหัสตอนเก็บและ mask ตอน GET — ถ้าผู้ใช้ไม่แตะ
 * ช่องนี้ ฟอร์มส่ง mask กลับและ backend คง token เดิม (pattern เดียวกับ api_key ของ POS/PMS)
 *
 * @returns React element ของหน้า Carmen GL interface
 */
export default function CarmenGlInterfaceForm() {
  const t = useTranslations("systemAdmin.interface");
  const ta = useTranslations("systemAdmin.interface.accounting");
  const tc = useTranslations("systemAdmin.interface.accounting.carmenGl");
  const { brand } = useParams<{ brand: string }>();
  const navigate = useNavigate();
  const { value, isLoading, isError, refetch, save, isSaving } =
    useInterfaceConfig("interface_accounting_carmen_gl");

  const form = useForm<CarmenGlFormValues>({
    resolver: zodResolver(carmenGlSchema) as Resolver<CarmenGlFormValues>,
    defaultValues: EMPTY_CARMEN_GL,
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
      title={ta(`brand.${brand}`)}
      description={tc("desc")}
      onSave={submit}
      // คืนค่าที่บันทึกไว้ ไม่ใช่ค่า default — ยกเลิกแล้วต้องได้ของเดิมกลับมา
      onCancel={() => form.reset(value ? toFormValues(value) : EMPTY_CARMEN_GL)}
      isSaving={isSaving}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
    >
      <SettingSection
        first
        title={tc("connection")}
        description={tc("connectionDesc")}
      >
        <ToggleField
          label={t("enabled")}
          checked={form.watch("enabled")}
          onChange={(v) => form.setValue("enabled", v, { shouldDirty: true })}
        />
        <TextField
          label={tc("apiServer")}
          field={form.register("api_server")}
          error={form.formState.errors.api_server?.message}
          placeholder="https://dev.carmen4.com/carmen.api/"
          className="sm:col-span-2"
        />
        <TextField
          label={tc("authorizeToken")}
          field={form.register("authorize_token")}
          error={form.formState.errors.authorize_token?.message}
          type="password"
          revealLabels={{ show: t("showSecret"), hide: t("hideSecret") }}
          // hint เฉพาะของ brand นี้ ไม่ใช่ `t("apiKeyHint")` ที่ POS/PMS ใช้ — backend ส่งค่านี้
          // เป็น Authorization header ตรง ๆ ทั้งก้อน (`Authorization: ${token}`) ค่าที่ไม่มี
          // scheme นำหน้าจึงได้ 401 จาก Carmen 4 โดยที่ฝั่งเราดูเหมือนตั้งค่าครบทุกช่อง
          hint={tc("authorizeTokenHint")}
          className="sm:col-span-2"
        />
      </SettingSection>

      <SettingSection title={tc("endpoints")} description={tc("endpointsDesc")}>
        <TextField
          label={tc("accountCodePath")}
          field={form.register("account_code_path")}
          error={form.formState.errors.account_code_path?.message}
        />
        <TextField
          label={tc("departmentPath")}
          field={form.register("department_path")}
          error={form.formState.errors.department_path?.message}
        />
        <TextField
          label={tc("vendorPath")}
          field={form.register("vendor_path")}
          error={form.formState.errors.vendor_path?.message}
        />
      </SettingSection>

      <SettingSection title={tc("options")} description={tc("optionsDesc")}>
        <ToggleField
          label={tc("setAccountMappingAllItems")}
          checked={form.watch("set_account_mapping_all_items")}
          onChange={(v) =>
            form.setValue("set_account_mapping_all_items", v, {
              shouldDirty: true,
            })
          }
        />
        <ToggleField
          label={tc("allowPostingTransferToGl")}
          checked={form.watch("allow_posting_transfer_to_gl")}
          onChange={(v) =>
            form.setValue("allow_posting_transfer_to_gl", v, {
              shouldDirty: true,
            })
          }
        />
      </SettingSection>

      <SettingSection title={tc("syncPolicy")} description={tc("syncPolicyDesc")}>
        <EnumField
          label={tc("onDuplicate")}
          value={form.watch("sync_policy.on_duplicate")}
          options={COA_ON_DUPLICATE}
          optionLabel={(o) => tc(`onDuplicateOption.${o}`)}
          onChange={(v) =>
            form.setValue("sync_policy.on_duplicate", v, { shouldDirty: true })
          }
        />
        <EnumField
          label={tc("onLocalOnly")}
          value={form.watch("sync_policy.on_local_only")}
          options={COA_ON_LOCAL_ONLY}
          optionLabel={(o) => tc(`onLocalOnlyOption.${o}`)}
          onChange={(v) =>
            form.setValue("sync_policy.on_local_only", v, { shouldDirty: true })
          }
        />
      </SettingSection>
    </InterfacePageLayout>
  );
}
