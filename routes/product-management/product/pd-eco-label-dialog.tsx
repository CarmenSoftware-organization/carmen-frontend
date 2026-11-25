import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  Field,
  FieldDatePicker,
  FieldGroup,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { LookupEcoLabel } from "./lookup-eco-label";
import {
  useCreateProductEcoLabel,
  useUpdateProductEcoLabel,
} from "./use-product-eco-label";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { ProductEcoLabel } from "@/types/product-eco-label";

function createProductEcoLabelSchema(tv: TranslationFn, tf: TranslationFn) {
  return z
    .object({
      master_eco_label_id: z
        .string()
        .min(1, tv("required", { field: tf("ecoLabel") })),
      certificate_no: z
        .string()
        .min(1, tv("required", { field: tf("certificateNo") })),
      issued_date: z
        .string()
        .min(1, tv("required", { field: tf("issuedDate") })),
      expiry_date: z
        .string()
        .min(1, tv("required", { field: tf("expiryDate") })),
      is_active: z.boolean(),
    })
    .refine(
      (d) =>
        !d.issued_date ||
        !d.expiry_date ||
        new Date(d.expiry_date) >= new Date(d.issued_date),
      { message: tv("endDateAfterStart"), path: ["expiry_date"] },
    );
}

type ProductEcoLabelFormValues = z.infer<
  ReturnType<typeof createProductEcoLabelSchema>
>;

const EMPTY_FORM: ProductEcoLabelFormValues = {
  master_eco_label_id: "",
  certificate_no: "",
  issued_date: "",
  expiry_date: "",
  is_active: true,
};

interface ProductEcoLabelDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
  readonly ecoLabel?: ProductEcoLabel | null;
}

export function ProductEcoLabelDialog({
  open,
  onOpenChange,
  productId,
  ecoLabel,
}: ProductEcoLabelDialogProps) {
  const isEdit = !!ecoLabel;
  const createEcoLabel = useCreateProductEcoLabel();
  const updateEcoLabel = useUpdateProductEcoLabel();
  const isPending = createEcoLabel.isPending || updateEcoLabel.isPending;
  const t = useTranslations("productManagement.product");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const form = useForm<ProductEcoLabelFormValues>({
    resolver: zodResolver(
      createProductEcoLabelSchema(tv, tfl),
    ) as Resolver<ProductEcoLabelFormValues>,
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        ecoLabel
          ? {
              master_eco_label_id: ecoLabel.master_eco_label_id,
              certificate_no: ecoLabel.certificate_no,
              issued_date: ecoLabel.issued_date,
              expiry_date: ecoLabel.expiry_date,
              is_active: ecoLabel.is_active,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, ecoLabel, form]);

  const onSubmit = (values: ProductEcoLabelFormValues) => {
    const payload = {
      master_eco_label_id: values.master_eco_label_id,
      certificate_no: values.certificate_no,
      issued_date: new Date(values.issued_date).toISOString(),
      expiry_date: new Date(values.expiry_date).toISOString(),
      is_active: values.is_active,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(
          tt(isEdit ? "updateSuccess" : "createSuccess", {
            entity: tfl("ecoLabel"),
          }),
        );
        onOpenChange(false);
      },
    };

    if (isEdit) {
      updateEcoLabel.mutate(
        { id: ecoLabel.id, doc_version: ecoLabel.doc_version, ...payload },
        handlers,
      );
    } else {
      createEcoLabel.mutate({ product_id: productId, ...payload }, handlers);
    }
  };

  const submitLabel = isPending
    ? isEdit
      ? tf("saving")
      : tf("creating")
    : isEdit
      ? tc("save")
      : tc("create");

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader className="gap-0 px-5 py-4">
            {/* หัวกล่องเหลือแค่ชื่อเรื่อง — ไอคอนในกล่องสีเป็น chrome ตกแต่งที่ยิง
                accent ซ้ำบนพื้นกลาง (ข้อสรุปเดียวกับ audit ของ GRN/PO dialog) */}
            <div className="flex items-center gap-3">
              <DialogTitle className="text-sm">
                {isEdit
                  ? tf("editTitle", { entity: tfl("ecoLabel") })
                  : tf("addTitle", { entity: tfl("ecoLabel") })}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3 border-t px-5 py-4">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel required>{tfl("ecoLabel")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="master_eco_label_id"
                  render={({ field }) => (
                    <LookupEcoLabel
                      value={field.value}
                      onValueChange={field.onChange}
                      // เติม certificate_no เป็น code ของ master eco label ที่เลือก
                      onItemChange={(master) =>
                        form.setValue("certificate_no", master.code, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      disabled={isPending}
                      placeholder={t("selectEcoLabel")}
                      className="h-8 w-full text-xs"
                      error={form.formState.errors.master_eco_label_id?.message}
                      modal
                    />
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="product-eco-cert-no" required>
                  {tfl("certificateNo")}
                </FieldLabel>
                <FieldInput
                  id="product-eco-cert-no"
                  placeholder={t("certificateNoPlaceholder")}
                  className="h-8"
                  disabled
                  error={form.formState.errors.certificate_no?.message}
                  maxLength={50}
                  {...form.register("certificate_no")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel required>{tfl("issuedDate")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="issued_date"
                    render={({ field }) => (
                      <FieldDatePicker
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isPending}
                        placeholder={tc("selectDate")}
                        className="h-8 w-full text-xs"
                        error={form.formState.errors.issued_date?.message}
                      />
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel required>{tfl("expiryDate")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="expiry_date"
                    render={({ field }) => (
                      <FieldDatePicker
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isPending}
                        placeholder={tc("selectDate")}
                        className="h-8 w-full text-xs"
                        error={form.formState.errors.expiry_date?.message}
                      />
                    )}
                  />
                </Field>
              </div>

              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <StatusSwitch
                    id="product-eco-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                )}
              />
            </FieldGroup>
          </div>

          <DialogFooter className="bg-muted/20 border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
