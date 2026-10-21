import { useEffect, useState } from "react";
import { useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";

import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import {
  buildItemChanges,
  scrollToFirstInvalidField,
} from "@/lib/form-helpers";
import {
  useCreatePriceList,
  useDeletePriceList,
  useUpdatePriceList,
} from "@/hooks/use-price-list";
import { useProfile } from "@/hooks/use-profile";
import type {
  CreatePriceListDto,
  PriceList,
  PriceListStatus,
} from "@/types/price-list";
import {
  createPriceListSchema,
  getDefaultValues,
  mapDetailToPayload,
  type PriceListFormValues,
} from "./pl-form-schema";
import { PLGeneralCard } from "./pl-general-card";
import { PlItemFields } from "./pl-item-fields";

const FORM_ID = "pl-form";

interface PriceListFormProps {
  readonly priceList?: PriceList;
}

const LIST_PATH = "/vendor-management/price-list";

export function PriceListForm({ priceList }: PriceListFormProps) {
  const navigate = useNavigate();
  const t = useTranslations("vendorManagement.priceList");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  const createPriceList = useCreatePriceList();
  const updatePriceList = useUpdatePriceList();
  const deletePriceList = useDeletePriceList();
  const [showDelete, setShowDelete] = useState(false);
  const isPending = createPriceList.isPending || updatePriceList.isPending;

  const { defaultCurrencyId } = useProfile();
  const defaultValues = getDefaultValues(priceList, { defaultCurrencyId });

  const f = useEntityForm<PriceListFormValues>({
    entity: priceList,
    resolver: zodResolver(
      createPriceListSchema(tv, tfl),
    ) as Resolver<PriceListFormValues>,
    defaultValues,
    listPath: LIST_PATH,
    isPending,
  });
  const { form, isView, isAdd, isEdit, isDisabled } = f;

  useEffect(() => {
    if (isAdd && defaultCurrencyId && !form.getValues("currency_id")) {
      // reset baseline (ไม่ใช่ setValue) ให้ currency_id เป็น default — กัน isDirty
      // ค้างทำให้ back/navigate ติด discard ทั้งที่ยังไม่ได้กรอก (ดู pr-form.tsx)
      form.reset(
        { ...defaultValues, currency_id: defaultCurrencyId },
        { keepDirtyValues: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultValues stable; run on isAdd/defaultCurrencyId
  }, [isAdd, defaultCurrencyId, form]);

  // After a successful edit-save the byId query is invalidated and refetches,
  // so the `priceList` prop returns with server-assigned ids for any newly
  // added pricelist_detail rows. Re-sync the form to it in view mode so a
  // second consecutive edit does not re-send those rows as new (which would
  // duplicate them server-side). PriceList has no version field, so key on a
  // signature of the detail ids — it changes exactly when rows are added or
  // removed (the cases where the stale-id bug bites). NOT keyed on `mode`, so
  // it cannot fire on the edit→view transition before the refetch lands.
  const detailIdsKey = (priceList?.pricelist_detail ?? [])
    .map((d) => d.id)
    .join(",");
  useEffect(() => {
    if (f.mode === "view" && priceList) {
      form.reset(getDefaultValues(priceList, { defaultCurrencyId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form/getDefaultValues stable; mode/defaultCurrencyId read intentionally without retriggering
  }, [detailIdsKey, priceList?.id]);

  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedFrom = useWatch({
    control: form.control,
    name: "effective_from_date",
  });
  const watchedTo = useWatch({
    control: form.control,
    name: "effective_to_date",
  });
  const watchedStatus = useWatch({ control: form.control, name: "status" });

  const handleSubmit = (values: PriceListFormValues) => {
    if (isEdit && priceList) {
      submitUpdate({
        values,
        priceList,
        defaultValues,
        mutate: updatePriceList.mutate,
        onSuccess: () => {
          toast.success(tt("updateSuccess", { entity: t("entity") }));
          form.reset(values);
          f.setMode("view");
        },
      });
    } else if (isAdd) {
      // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network
      f.setIsSubmitting(true);
      submitCreate({
        values,
        mutate: createPriceList.mutate,
        onError: () => f.setIsSubmitting(false),
        onSuccess: (id) => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          // navigate ไป detail ของ record ที่เพิ่งสร้าง (edit route จะ mount ใหม่
          // แล้วตั้ง mode=view จาก priceList เอง) — อย่า setMode/reset ที่นี่ เพราะ
          // มันทำให้ navGuard enabled true→false ระหว่าง navigate ยังไม่ commit แล้ว
          // teardown ของมันยิง history.back() เด้งกลับ /new (ดู use-navigation-guard)
          navigate(`/vendor-management/price-list/${id}`, {
            replace: true,
            ...f.returnState,
          });
        },
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!priceList) return;
    deletePriceList.mutate(priceList.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  const plNo = priceList?.no ?? null;
  const tsStatus = ts as (
    key: PriceListStatus,
  ) => string;

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
          onDelete={priceList ? () => setShowDelete(true) : undefined}
          deleteIsPending={deletePriceList.isPending}
          activity={priceList && { id: priceList.id, label: priceList.no }}
          badges={
            <>
              {plNo && (
                <span className="text-muted-foreground shrink-0 text-sm">
                  · {plNo}
                </span>
              )}
              <StatusIconLabel
                status={watchedStatus}
                label={tsStatus(watchedStatus)}
                // เบากว่าในตาราง: ตัวเอกของแถบนี้คือชื่อ/เลขที่ใบ สถานะเป็นข้อมูล
                // ประกอบ เหลือสีไว้ที่ไอคอนจุดเดียว (ท่าเดียวกับหัวฟอร์ม PR/PO)
                className="text-muted-foreground text-micro uppercase [&>svg]:size-3"
              />
            </>
          }
        />
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(handleSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <PLGeneralCard
          form={form}
          priceList={priceList}
          isView={isView}
          isDisabled={isDisabled}
          watchedFrom={watchedFrom}
          watchedTo={watchedTo}
          tfl={tfl}
          t={t}
          ts={tsStatus}
        />
        <PlItemFields
          form={form}
          priceList={priceList}
          isView={isView}
          isDisabled={isDisabled}
        />
      </form>

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

      {priceList && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deletePriceList.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: priceList.name })}
          isPending={deletePriceList.isPending}
          onConfirm={handleConfirmDelete}
        />
      )}
    </FormPageShell>
  );
}

/* ── label hooks ─────────────────────────────────────────────── */

/* ── submit helpers ──────────────────────────────────────────── */

function submitUpdate({
  values,
  priceList,
  defaultValues,
  mutate,
  onSuccess,
}: {
  values: PriceListFormValues;
  priceList: PriceList;
  defaultValues: PriceListFormValues;
  mutate: ReturnType<typeof useUpdatePriceList>["mutate"];
  onSuccess: () => void;
}) {
  const changes = buildItemChanges(
    values.pricelist_detail,
    defaultValues.pricelist_detail,
    mapDetailToPayload,
  );
  // หลังบ้านรับบรรทัดที่ลบเป็น `delete: string[]` (ดู CreatePriceListDto)
  const pricelist_detail = {
    add: changes.add,
    update: changes.update,
    delete: changes.remove?.map((row) => row.id),
  };

  mutate(
    {
      id: priceList.id,
      doc_version: priceList.doc_version,
      ...buildBasePayload(values),
      pricelist_detail,
    },
    { onSuccess },
  );
}

function submitCreate({
  values,
  mutate,
  onSuccess,
  onError,
}: {
  values: PriceListFormValues;
  mutate: ReturnType<typeof useCreatePriceList>["mutate"];
  onSuccess: (id: string) => void;
  onError: () => void;
}) {
  const pricelist_detail: CreatePriceListDto["pricelist_detail"] = {};
  if (values.pricelist_detail.length > 0) {
    pricelist_detail.add = values.pricelist_detail.map((item, i) =>
      mapDetailToPayload(item, i),
    );
  }

  mutate(
    { ...buildBasePayload(values), pricelist_detail },
    {
      onSuccess: (data) => {
        const created = data as { data: { id: string } };
        onSuccess(created.data.id);
      },
      onError,
    },
  );
}

function buildBasePayload(values: PriceListFormValues) {
  return {
    vendor_id: values.vendor_id,
    name: values.name,
    description: values.description,
    status: values.status,
    currency_id: values.currency_id,
    effective_from_date: new Date(values.effective_from_date).toISOString(),
    effective_to_date: new Date(values.effective_to_date).toISOString(),
    note: values.note,
  };
}
