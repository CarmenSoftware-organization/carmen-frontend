import { lazy, Suspense, useEffect, useState } from "react";
import { useFieldArray, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { PrintDocumentButton } from "@/components/print-document-button";
import { VENDOR_DETAIL_TEMPLATE_ID } from "@/lib/print-document";
import {
  useCreateVendor,
  useDeleteVendor,
  useUpdateVendor,
} from "@/hooks/use-vendor";
import type { CreateVendorDto, VendorDetail } from "@/types/vendor";
import {
  buildNestedPayload,
  createVendorSchema,
  getDefaultValues,
  mapAddressPayload,
  mapContactPayload,
  type VendorFormValues,
} from "./vendor-form-schema";
import { VendorCertificateSection } from "./vendor-certificate-section";
import { VendorGeneral } from "./vendor-general";
import { VendorInfo } from "./vendor-info";
import { VendorAddress } from "./vendor-address";
import { VendorContact } from "./vendor-contact";
import { vendorCommentCrud } from "./use-vendor-comments";

const EntityCommentSheet = lazy(() =>
  import("@/components/share/entity-comment-sheet").then((mod) => ({
    default: mod.EntityCommentSheet,
  })),
);

const FORM_ID = "vendor-form";

interface VendorFormProps {
  readonly vendor?: VendorDetail;
}

const LIST_PATH = "/vendor-management/vendor";

export function VendorForm({ vendor }: VendorFormProps) {
  "use no memo";
  const navigate = useNavigate();
  const t = useTranslations("vendorManagement.vendor");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");

  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const [showDelete, setShowDelete] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const isPending = createVendor.isPending || updateVendor.isPending;

  const defaultValues = getDefaultValues(vendor);
  const f = useEntityForm<VendorFormValues>({
    entity: vendor,
    serverFieldErrors: {
      VENDOR_CODE_ALREADY_EXISTS: "code",
      GL_ACCOUNT_NOT_POSTABLE: "ap_chart_of_accounts_id",
    },
    resolver: zodResolver(
      createVendorSchema(tv, tfl),
    ) as Resolver<VendorFormValues>,
    defaultValues,
    listPath: LIST_PATH,
    isPending,
    // แถวที่อยู่/ผู้ติดต่อที่กดลบไว้ถือเป็น state นอก RHF — กด Cancel ต้องคืนด้วย
    onResetExtra: () => {
      setRemovedAddressIds([]);
      setRemovedContactIds([]);
    },
  });
  const { form, isAdd, isEdit, isDisabled } = f;

  const {
    fields: infoFields,
    prepend: prependInfo,
    remove: removeInfo,
  } = useFieldArray({ control: form.control, name: "info" });

  const {
    fields: addressFields,
    prepend: prependAddress,
    remove: removeAddress,
  } = useFieldArray({ control: form.control, name: "vendor_address" });

  const {
    fields: contactFields,
    prepend: prependContact,
    remove: removeContact,
  } = useFieldArray({ control: form.control, name: "vendor_contact" });

  const [removedAddressIds, setRemovedAddressIds] = useState<string[]>([]);
  const [removedContactIds, setRemovedContactIds] = useState<string[]>([]);

  // After a successful edit-save the byId query is invalidated and refetches,
  // so the `vendor` prop returns with server-assigned ids for any newly added
  // address/contact rows. Re-sync the form to it in view mode so a second
  // consecutive edit does not re-send those rows as new (buildNestedPayload
  // keys add-vs-update on id presence → would create duplicates server-side).
  //
  // Keyed on a signature of the address/contact ids (the GET response carries
  // no top-level updated_at — the timestamp lives under `audit`, which is not
  // on the typed shape), NOT on `mode`: the signature changes exactly when rows
  // are added/removed (the cases the stale-id bug bites), and keying off mode
  // would fire on the edit→view transition before the refetch lands, resetting
  // to the stale prop and momentarily dropping the just-added rows.
  const vendorSyncKey = [
    ...(vendor?.vendor_address ?? []).map((a) => a.id ?? ""),
    ...(vendor?.vendor_contact ?? []).map((c) => c.id ?? ""),
  ].join("|");
  useEffect(() => {
    if (f.mode === "view" && vendor) {
      form.reset(getDefaultValues(vendor));
      setRemovedAddressIds([]);
      setRemovedContactIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form/getDefaultValues stable; mode read intentionally without retriggering
  }, [vendorSyncKey, vendor?.id]);

  const handleRemoveAddress = (index: number) => {
    const id = form.getValues(`vendor_address.${index}.id`);
    if (id) setRemovedAddressIds((prev) => [...prev, id]);
    removeAddress(index);
  };

  const handleRemoveContact = (index: number) => {
    const id = form.getValues(`vendor_contact.${index}.id`);
    if (id) setRemovedContactIds((prev) => [...prev, id]);
    removeContact(index);
  };

  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedCode = useWatch({ control: form.control, name: "code" });
  const watchedActive = useWatch({ control: form.control, name: "is_active" });

  const onSubmit = (values: VendorFormValues) => {
    const { dirtyFields } = form.formState;
    const payload: CreateVendorDto = {
      code: values.code,
      name: values.name,
      description: values.description,
      is_active: values.is_active,
      // ช่องว่าง = ไม่มีค่า — ส่ง null ไม่ใช่ "" ให้ DB เก็บเป็น NULL
      tax_no: values.tax_no.trim() || null,
      branch_no: values.branch_no.trim() || null,
      rating: values.rating,
      business_type: values.business_types,
      info: (values.info ?? []).map(({ label, value, data_type }) => ({
        label,
        value,
        data_type,
      })),
      vendor_address: buildNestedPayload(
        values.vendor_address,
        // RHF 7.78 type drift
        dirtyFields.vendor_address as Record<string, unknown>[] | undefined,
        removedAddressIds,
        mapAddressPayload,
        "vendor_address_id",
      ) as CreateVendorDto["vendor_address"],
      vendor_contact: buildNestedPayload(
        values.vendor_contact,
        // RHF 7.78 type drift
        dirtyFields.vendor_contact as Record<string, unknown>[] | undefined,
        removedContactIds,
        mapContactPayload,
        "vendor_contact_id",
      ) as CreateVendorDto["vendor_contact"],
    };

    // null = ล้างบัญชี (backend: null = clear, omit = ไม่เปลี่ยน) — ส่งเฉพาะตอนแก้
    // (หรือสร้างใหม่ที่เลือกแล้ว) กันโดน GL_ACCOUNT_NOT_POSTABLE เมื่อบัญชีเดิมถูกปิด
    if (
      isEdit
        ? dirtyFields.ap_chart_of_accounts_id
        : values.ap_chart_of_accounts_id != null
    ) {
      payload.ap_chart_of_accounts_id = values.ap_chart_of_accounts_id;
    }

    if (isEdit && vendor) {
      updateVendor.mutate(
        // doc_version round-trips the loaded record's version — backend requires
        // it for optimistic concurrency on PATCH (same as the config modules).
        { id: vendor.id, doc_version: vendor.doc_version, ...payload },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            form.reset(values);
            setRemovedAddressIds([]);
            setRemovedContactIds([]);
            f.setMode("view");
          },
        },
      );
    } else if (isAdd) {
      createVendor.mutate(payload, {
        onSuccess: (res) => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          const data = res as unknown as { data?: { id?: string } };
          const id = data?.data?.id;
          if (id) {
            navigate(`/vendor-management/vendor/${id}`, {
              replace: true,
              ...f.returnState,
            });
          } else {
            f.backToList();
          }
        },
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!vendor) return;
    deleteVendor.mutate(vendor.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode={f.mode}
          formId={FORM_ID}
          isPending={isPending}
          title={watchedName || t("namePlaceholder")}
          titleMuted={!watchedName}
          onBack={f.handleBack}
          onCancel={f.handleCancel}
          onEdit={f.handleEdit}
          onDelete={vendor ? () => setShowDelete(true) : undefined}
          deleteIsPending={deleteVendor.isPending}
          activity={vendor && { id: vendor.id, label: vendor.code }}
          onComment={vendor ? () => setShowComment(true) : undefined}
          badges={
            <>
              {watchedCode && (
                <span className="text-muted-foreground shrink-0 text-sm">
                  · {watchedCode}
                </span>
              )}
              {!isAdd && <StatusBadge active={watchedActive} />}
            </>
          }
        >
          {/* Vendor Detail Report ของผู้ขายรายนี้ — ไม่อยู่ในหน้ารายการรายงาน */}
          {f.mode === "view" && vendor?.code && (
            <PrintDocumentButton
              documentType="VENDOR"
              templateId={VENDOR_DETAIL_TEMPLATE_ID}
              filters={{ VendorFrom: vendor.code, VendorTo: vendor.code, Status: "ALL" }}
            />
          )}
        </FormToolbar>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <VendorGeneral form={form} isDisabled={isDisabled} />
        <VendorAddress
          form={form}
          isDisabled={isDisabled}
          addressFields={addressFields}
          prependAddress={prependAddress}
          removeAddress={handleRemoveAddress}
        />
        <VendorContact
          form={form}
          isDisabled={isDisabled}
          contactFields={contactFields}
          prependContact={prependContact}
          removeContact={handleRemoveContact}
        />
        <VendorInfo
          form={form}
          isDisabled={isDisabled}
          infoFields={infoFields}
          prependInfo={prependInfo}
          removeInfo={removeInfo}
        />
      </form>

      {/* Certificates — CRUD อิสระ (นอก form, ยิง API เอง) แสดงเมื่อมี vendor */}
      {/* section นี้ยิง API เอง ไม่ผ่านฟอร์ม แต่ต้องเคารพโหมดเดียวกับหมวดอื่น —
          ไม่ส่ง readOnly มาก่อนหน้านี้ ปุ่มเพิ่ม/แก้/ลบใบรับรองเลยโผล่ตั้งแต่โหมดดู
          ทั้งที่ข้อมูล/ที่อยู่/ผู้ติดต่อ ต้องกด Edit ก่อนถึงจะเห็น */}
      {vendor?.id && (
        <VendorCertificateSection vendorId={vendor.id} readOnly={isDisabled} />
      )}

      <DiscardDialog {...f.discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={f.navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) f.navGuard.cancel();
        }}
        onConfirm={f.navGuard.confirm}
        onCancel={f.navGuard.cancel}
        variant="warning"
      />

      {vendor && (
        <Suspense fallback={null}>
          <EntityCommentSheet
            crud={vendorCommentCrud}
            entityId={vendor.id}
            open={showComment}
            onOpenChange={setShowComment}
          />
        </Suspense>
      )}

      {vendor && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteVendor.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: vendor.name })}
          isPending={deleteVendor.isPending}
          onConfirm={handleConfirmDelete}
        />
      )}
    </FormPageShell>
  );
}
