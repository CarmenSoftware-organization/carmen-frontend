import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { SettingSection } from "@/components/ui/setting-section";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useInterfaceConfig } from "../use-interface-config";
import { InterfacePageLayout } from "../interface-page-layout";
import { TextField, ToggleField } from "../interface-fields";
import { PosOperations } from "./pos-operations";

/** mask ที่ backend ส่งกลับแทนรหัสผ่านที่เก็บไว้ */
const ENCRYPTED_MASK = "***ENCRYPTED***";

/** ตรงกับ regex ฝั่ง backend — 24 ชั่วโมง HH:mm */
const SCHEDULE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const simphonySchema = z.object({
  enabled: z.boolean(),
  sftp_host: z.string(),
  sftp_port: z.coerce.number().int().min(1).max(65535),
  sftp_username: z.string(),
  sftp_password: z.string(),
  remote_folder_path: z.string(),
  file_pattern: z.string(),
  schedule_time: z.string().regex(SCHEDULE_TIME),
});

export type SimphonyFormValues = z.infer<typeof simphonySchema>;

export const EMPTY_SIMPHONY: SimphonyFormValues = {
  enabled: false,
  sftp_host: "",
  sftp_port: 22,
  sftp_username: "",
  sftp_password: "",
  remote_folder_path: "/export/",
  file_pattern: "GLExport_*.txt",
  schedule_time: "03:00",
};

/**
 * แปลงค่าจาก app_config เป็นค่า form
 *
 * `sftp_password` ที่ backend ส่งมาเป็น mask (`***ENCRYPTED***`) ถูกเก็บไว้ตามเดิม — ถ้า
 * user ไม่แตะ ค่านี้จะถูกส่งกลับขึ้นไปแล้ว backend คืนรหัสเดิมให้
 */
export function toSimphonyFormValues(
  value: Record<string, unknown> | undefined,
): SimphonyFormValues {
  if (!value) return EMPTY_SIMPHONY;
  const parsed = simphonySchema.safeParse({ ...EMPTY_SIMPHONY, ...value });
  return parsed.success ? parsed.data : EMPTY_SIMPHONY;
}

/**
 * หน้าตั้งค่า Oracle Simphony — SFTP + รอบดึงไฟล์ และแท็บงานนำเข้า/ผูกรหัส
 *
 * @returns React element ของหน้า Simphony
 */
export default function PosSimphonyForm() {
  const t = useTranslations("systemAdmin.interface");
  const tp = useTranslations("systemAdmin.interface.posSale.simphony");
  const { value, isLoading, isError, refetch, save, isSaving } =
    useInterfaceConfig("interface_pos_simphony");

  const form = useForm<SimphonyFormValues>({
    resolver: zodResolver(simphonySchema) as Resolver<SimphonyFormValues>,
    defaultValues: EMPTY_SIMPHONY,
  });

  useEffect(() => {
    if (value) form.reset(toSimphonyFormValues(value));
  }, [value, form]);

  const errors = form.formState.errors;
  const submit = form.handleSubmit(
    (values) =>
      save(
        { ...values },
        {
          // อยู่หน้าเดิม — reset เป็นค่าที่เพิ่งบันทึก: refetch แล้วค่าเหมือนเดิมทุกประการ
          // reference ไม่เปลี่ยน useEffect([value]) จึงไม่ยิง (ถ้าแก้แค่รหัสผ่าน form จะค้าง dirty)
          // รหัสผ่านที่บันทึกแล้ว backend ตอบกลับเป็น mask เสมอ
          onSuccess: () => {
            toast.success(t("saved"));
            form.reset({
              ...values,
              sftp_password: values.sftp_password ? ENCRYPTED_MASK : "",
            });
          },
        },
      ),
    () => scrollToFirstInvalidField(),
  );

  return (
    <InterfacePageLayout
      title={tp("title")}
      description={tp("desc")}
      onSave={submit}
      onCancel={() =>
        form.reset(value ? toSimphonyFormValues(value) : EMPTY_SIMPHONY)
      }
      isSaving={isSaving}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
      afterForm={<PosOperations brand="simphony" />}
    >
      <SettingSection first title={tp("sftp")} description={tp("sftpDesc")}>
        <ToggleField
          label={t("enabled")}
          checked={form.watch("enabled")}
          onChange={(v) => form.setValue("enabled", v, { shouldDirty: true })}
        />
        <TextField
          label={tp("host")}
          field={form.register("sftp_host")}
          error={errors.sftp_host?.message}
          placeholder="sftp.example.com"
        />
        <TextField
          label={tp("port")}
          field={form.register("sftp_port")}
          error={errors.sftp_port ? tp("portInvalid") : undefined}
          placeholder="22"
        />
        <TextField
          label={tp("username")}
          field={form.register("sftp_username")}
          error={errors.sftp_username?.message}
        />
        <TextField
          label={tp("password")}
          field={form.register("sftp_password")}
          error={errors.sftp_password?.message}
          type="password"
          revealLabels={{ show: t("showSecret"), hide: t("hideSecret") }}
          hint={tp("passwordHint")}
          className="sm:col-span-2"
        />
      </SettingSection>

      <SettingSection title={tp("pull")} description={tp("pullDesc")}>
        <TextField
          label={tp("remoteFolder")}
          field={form.register("remote_folder_path")}
          error={errors.remote_folder_path?.message}
          placeholder="/export/"
        />
        <TextField
          label={tp("filePattern")}
          field={form.register("file_pattern")}
          error={errors.file_pattern?.message}
          placeholder="GLExport_*.txt"
        />
        <TextField
          label={tp("scheduleTime")}
          field={form.register("schedule_time")}
          error={errors.schedule_time ? tp("scheduleInvalid") : undefined}
          placeholder="03:00"
        />
      </SettingSection>
    </InterfacePageLayout>
  );
}
