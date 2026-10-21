import { useEffect } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Save, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import {
  useAppConfigByKey,
  useUpsertAppConfig,
  useTestEmail,
} from "@/hooks/use-app-config";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

const schema = z.object({
  smtp_host: z.string().min(1, "SMTP host is required"),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  smtp_username: z.string().min(1, "Username is required"),
  smtp_password: z.string().min(1, "Password is required"),
  smtp_from: z.string().min(1, "From address is required"),
  smtp_enabled: z.boolean(),
  recipients: z.string(),
  cc: z.string(),
  subject_prefix: z.string(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_FORM: FormValues = {
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_from: "",
  smtp_enabled: true,
  recipients: "",
  cc: "",
  subject_prefix: "[Carmen Blue]",
};

function toFormValues(value: Record<string, unknown> | undefined): FormValues {
  if (!value) return EMPTY_FORM;
  const smtp = (value.smtp || {}) as Record<string, unknown>;
  return {
    smtp_host: (smtp.host as string) || "",
    smtp_port: (smtp.port as number) || 587,
    smtp_username: (smtp.username as string) || "",
    smtp_password: (smtp.password as string) || "",
    smtp_from: (smtp.from as string) || "",
    smtp_enabled: smtp.enabled !== false,
    recipients: ((value.recipients as string[]) || []).join(", "),
    cc: ((value.cc as string[]) || []).join(", "),
    subject_prefix: (value.subject_prefix as string) || "",
  };
}

function toApiValue(values: FormValues): Record<string, unknown> {
  const parseEmails = (s: string) =>
    s
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
  return {
    smtp: {
      host: values.smtp_host,
      port: values.smtp_port,
      username: values.smtp_username,
      password: values.smtp_password,
      from: values.smtp_from,
      enabled: values.smtp_enabled,
    },
    recipients: parseEmails(values.recipients),
    cc: parseEmails(values.cc),
    subject_prefix: values.subject_prefix,
  };
}

// React Compiler memo คอมโพเนนต์นี้แล้ว effect ที่ reset ฟอร์มจาก config ที่โหลดมา
// ไม่ทำงาน (ช่องทั้งหมดขึ้นว่างทุกครั้งที่เปิดหน้า ทั้งที่เคยตั้งค่าไว้แล้ว) และ
// subscription ของ formState.isDirty ก็ไม่อัปเดตตาม ทำให้ guard ไม่รู้ว่ามีการแก้
export default function ConfigEmailComponent() {
  "use no memo";
  const t = useTranslations("systemAdmin.configEmail");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const { data, isLoading } = useAppConfigByKey("report_email");
  const upsert = useUpsertAppConfig();
  const testEmail = useTestEmail();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (data?.value) {
      form.reset(toFormValues(data.value));
    }
  }, [data, form]);

  const onSubmit = (values: FormValues) => {
    upsert.mutate(
      { key: "report_email", value: toApiValue(values) },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          // ล้าง dirty หลังบันทึก ไม่งั้น guard เตือนค้างทั้งที่เซฟไปแล้ว
          form.reset(values);
        },
      },
    );
  };

  const handleTestEmail = () => {
    testEmail.mutate(undefined as never, {
      onSuccess: () => toast.success(t("testSent")),
    });
  };

  const smtpEnabled = useWatch({ control: form.control, name: "smtp_enabled" });
  const submit = form.handleSubmit(onSubmit, () => scrollToFirstInvalidField());

  // หน้านี้ไม่มีปุ่มย้อนกลับ ทางออกคือเมนู sidebar กับปิดแท็บ — ดักทั้งสองทาง
  // (hook ต้องอยู่เหนือ early return ของ isLoading ไม่งั้นลำดับ hook เพี้ยน)
  const isDirty = form.formState.isDirty;
  const navGuard = useNavigationGuard(isDirty);
  useUnsavedChanges(isDirty);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        {/* mirror the real field layout so the skeleton is exactly as tall */}
        <SettingSectionSkeleton
          first
          fields={["half", "half", "half", "half", "full", "full"]}
        />
        <SettingSectionSkeleton fields={["full", "full", "half"]} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-[max(1rem,env(safe-area-inset-bottom))]">
      {/* ── Header: title + actions (company-profile layout) ── */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("desc")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestEmail}
            disabled={testEmail.isPending}
          >
            <Send className="size-3.5" aria-hidden="true" />
            {t("testEmail")}
          </Button>
          <Button size="sm" onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-3.5" aria-hidden="true" />
            )}
            {upsert.isPending ? tf("saving") : tc("save")}
          </Button>
        </div>
      </header>

      <form onSubmit={submit}>
        <SettingSection
          first
          title={t("smtpServer")}
          description={t("smtpServerDesc")}
        >
          <Field>
            <FieldLabel>{t("host")}</FieldLabel>
            <Input
              {...form.register("smtp_host")}
              placeholder="smtp.gmail.com"
            />
            <FieldError>{form.formState.errors.smtp_host?.message}</FieldError>
          </Field>
          <Field>
            <FieldLabel>{t("port")}</FieldLabel>
            <Input
              {...form.register("smtp_port")}
              type="number"
              placeholder="587"
            />
            <FieldError>{form.formState.errors.smtp_port?.message}</FieldError>
          </Field>
          <Field>
            <FieldLabel>{t("username")}</FieldLabel>
            <Input
              {...form.register("smtp_username")}
              placeholder="noreply@example.com"
            />
            <FieldError>
              {form.formState.errors.smtp_username?.message}
            </FieldError>
          </Field>
          <Field>
            <FieldLabel>{t("password")}</FieldLabel>
            <Input
              {...form.register("smtp_password")}
              type="password"
              placeholder="App password"
            />
            <FieldError>
              {form.formState.errors.smtp_password?.message}
            </FieldError>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel>{t("fromAddress")}</FieldLabel>
            <Input
              {...form.register("smtp_from")}
              placeholder="noreply@example.com"
            />
            <FieldError>{form.formState.errors.smtp_from?.message}</FieldError>
          </Field>
          <label className="flex items-center gap-2 pt-1 sm:col-span-2">
            <Switch
              checked={smtpEnabled}
              onCheckedChange={(v) =>
                form.setValue("smtp_enabled", v, { shouldDirty: true })
              }
            />
            <span className="text-sm">{t("enabled")}</span>
          </label>
        </SettingSection>

        <SettingSection
          title={t("recipients")}
          description={t("recipientsDesc")}
        >
          <Field className="sm:col-span-2">
            <FieldLabel>{t("to")}</FieldLabel>
            <Input
              {...form.register("recipients")}
              placeholder="admin@example.com, manager@example.com"
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel>{t("cc")}</FieldLabel>
            <Input {...form.register("cc")} placeholder="finance@example.com" />
          </Field>
          <Field>
            <FieldLabel>{t("subjectPrefix")}</FieldLabel>
            <Input
              {...form.register("subject_prefix")}
              placeholder="[Carmen Blue]"
            />
          </Field>
        </SettingSection>
      </form>

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(open) => {
          if (!open) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </div>
  );
}
