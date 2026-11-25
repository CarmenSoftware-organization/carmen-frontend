import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Award } from "lucide-react";
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
import { LookupCertification } from "./lookup-certification";
import {
  useCreateVendorCertificate,
  useUpdateVendorCertificate,
} from "./use-vendor-certificate";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { VendorCertificate } from "@/types/vendor-certificate";

function createVendorCertificateSchema(tv: TranslationFn, tf: TranslationFn) {
  return z
    .object({
      master_certificate_id: z
        .string()
        .min(1, tv("required", { field: tf("certificate") })),
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

type VendorCertificateFormValues = z.infer<
  ReturnType<typeof createVendorCertificateSchema>
>;

const EMPTY_FORM: VendorCertificateFormValues = {
  master_certificate_id: "",
  certificate_no: "",
  issued_date: "",
  expiry_date: "",
  is_active: true,
};

interface VendorCertificateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly vendorId: string;
  readonly certificate?: VendorCertificate | null;
}

export function VendorCertificateDialog({
  open,
  onOpenChange,
  vendorId,
  certificate,
}: VendorCertificateDialogProps) {
  const isEdit = !!certificate;
  const createCert = useCreateVendorCertificate();
  const updateCert = useUpdateVendorCertificate();
  const isPending = createCert.isPending || updateCert.isPending;
  const t = useTranslations("vendorManagement.vendor");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const form = useForm<VendorCertificateFormValues>({
    resolver: zodResolver(
      createVendorCertificateSchema(tv, tfl),
    ) as Resolver<VendorCertificateFormValues>,
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        certificate
          ? {
              master_certificate_id: certificate.master_certificate_id,
              certificate_no: certificate.certificate_no,
              issued_date: certificate.issued_date,
              expiry_date: certificate.expiry_date,
              is_active: certificate.is_active,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, certificate, form]);

  const onSubmit = (values: VendorCertificateFormValues) => {
    const payload = {
      master_certificate_id: values.master_certificate_id,
      certificate_no: values.certificate_no,
      issued_date: new Date(values.issued_date).toISOString(),
      expiry_date: new Date(values.expiry_date).toISOString(),
      is_active: values.is_active,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(
          tt(isEdit ? "updateSuccess" : "createSuccess", {
            entity: tfl("certificate"),
          }),
        );
        onOpenChange(false);
      },
    };

    if (isEdit) {
      updateCert.mutate(
        {
          id: certificate.id,
          doc_version: certificate.doc_version,
          ...payload,
        },
        handlers,
      );
    } else {
      createCert.mutate({ vendor_id: vendorId, ...payload }, handlers);
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
            <div className="flex items-center gap-3">
              <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Award className="size-4.5" />
              </div>
              <DialogTitle className="text-sm">
                {isEdit
                  ? tf("editTitle", { entity: tfl("certificate") })
                  : tf("addTitle", { entity: tfl("certificate") })}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3 border-t px-5 py-4">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel required>{tfl("certificate")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="master_certificate_id"
                  render={({ field }) => (
                    <LookupCertification
                      value={field.value}
                      onValueChange={field.onChange}
                      // เติม certificate_no เป็น code ของ master cert ที่เลือก
                      onItemChange={(master) =>
                        form.setValue("certificate_no", master.code, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      disabled={isPending}
                      placeholder={t("selectCertificate")}
                      className="h-8 w-full text-sm"
                      error={
                        form.formState.errors.master_certificate_id?.message
                      }
                      modal
                    />
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="vendor-cert-no" required>
                  {tfl("certificateNo")}
                </FieldLabel>
                <FieldInput
                  id="vendor-cert-no"
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
                    id="vendor-cert-active"
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
