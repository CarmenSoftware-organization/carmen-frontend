import { Controller } from "react-hook-form";
import { z } from "zod";
import { MapPin } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateDeliveryPoint,
  useUpdateDeliveryPoint,
} from "@/hooks/use-delivery-point";
import type { DeliveryPoint } from "@/types/delivery-point";
import type { TranslationFn } from "@/lib/i18n-schema";

function createDeliveryPointSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("name") })),
    is_active: z.boolean(),
  });
}

type DeliveryPointFormValues = z.infer<
  ReturnType<typeof createDeliveryPointSchema>
>;
type DeliveryPointPayload = { name: string; is_active: boolean };

interface DeliveryPointDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly deliveryPoint?: DeliveryPoint | null;
  readonly readOnly?: boolean;
}

export function DeliveryPointDialog({
  open,
  onOpenChange,
  deliveryPoint,
  readOnly,
}: DeliveryPointDialogProps) {
  const t = useTranslations("config.deliveryPoint");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      DeliveryPoint,
      DeliveryPointFormValues,
      DeliveryPointPayload
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={deliveryPoint}
      readOnly={readOnly}
      icon={MapPin}
      translationNamespace="config.deliveryPoint"
      useCreate={useCreateDeliveryPoint}
      useUpdate={useUpdateDeliveryPoint}
      serverFieldErrors={{ DELIVERY_POINT_ALREADY_EXISTS: "name" }}
      buildSchema={createDeliveryPointSchema}
      toFormValues={(e) =>
        e
          ? { name: e.name, is_active: e.is_active }
          : { name: "", is_active: true }
      }
      toPayload={(v) => ({ name: v.name, is_active: v.is_active })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel required htmlFor="delivery-point-name">
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="delivery-point-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              error={form.formState.errors.name?.message}
              disabled={disabled}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="delivery-point-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </>
      )}
    </ConfigEntityDialog>
  );
}
