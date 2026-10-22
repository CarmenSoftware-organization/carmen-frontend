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
import { ToggleField } from "../interface-fields";
import { PosOperations } from "./pos-operations";

const micros3700Schema = z.object({ enabled: z.boolean() });
type Micros3700FormValues = z.infer<typeof micros3700Schema>;

const EMPTY_MICROS3700: Micros3700FormValues = { enabled: false };

function toMicros3700FormValues(
  value: Record<string, unknown> | undefined,
): Micros3700FormValues {
  if (!value) return EMPTY_MICROS3700;
  const parsed = micros3700Schema.safeParse({ ...EMPTY_MICROS3700, ...value });
  return parsed.success ? parsed.data : EMPTY_MICROS3700;
}

/**
 * หน้าตั้งค่า Micros 3700 — สวิตช์เปิด/ปิดอย่างเดียว และแท็บงานนำเข้า/ผูกรหัส
 *
 * @returns React element ของหน้า Micros 3700
 */
export default function PosMicros3700Form() {
  const t = useTranslations("systemAdmin.interface");
  const tp = useTranslations("systemAdmin.interface.posSale.micros3700");
  const { value, isLoading, isError, refetch, save, isSaving } =
    useInterfaceConfig("interface_pos_micros3700");

  const form = useForm<Micros3700FormValues>({
    resolver: zodResolver(micros3700Schema) as Resolver<Micros3700FormValues>,
    defaultValues: EMPTY_MICROS3700,
  });

  useEffect(() => {
    if (value) form.reset(toMicros3700FormValues(value));
  }, [value, form]);

  const submit = form.handleSubmit(
    (values) =>
      save(
        { ...values },
        // อยู่หน้าเดิม — แท็บงานอยู่หน้านี้
        {
          onSuccess: () => {
            toast.success(t("saved"));
            form.reset(values);
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
        form.reset(value ? toMicros3700FormValues(value) : EMPTY_MICROS3700)
      }
      isSaving={isSaving}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
      afterForm={<PosOperations brand="micros3700" />}
    >
      <SettingSection
        first
        title={tp("general")}
        description={tp("generalDesc")}
      >
        <ToggleField
          label={t("enabled")}
          checked={form.watch("enabled")}
          onChange={(v) => form.setValue("enabled", v, { shouldDirty: true })}
        />
      </SettingSection>
    </InterfacePageLayout>
  );
}
