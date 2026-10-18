import { useState } from "react";
import { type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { toast } from "sonner";
import {
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
} from "./use-eq";
import type { Equipment } from "@/types/equipment";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import {
  createEquipmentSchema,
  getDefaultValues,
  type EquipmentFormValues,
} from "./eq-form-schema";
import { FormPageShell } from "@/components/share/form-page-shell";
import { EqToolbar } from "./eq-toolbar";
import { EqGeneralSection } from "./eq-general-section";
import type { EqImageChange } from "./eq-image-field";
import { EqQuantitySection } from "./eq-quantity-section";
import { EqInstructionsSection } from "./eq-instructions-section";
import { EqMaintenanceSection } from "./eq-maintenance-section";
import { EqAdditionalSection } from "./eq-additional-section";
import { EqSummary } from "./eq-summary";

interface EquipmentFormProps {
  readonly equipment?: Equipment;
}

const LIST_PATH = "/operation-plan/equipment";

export function EquipmentForm({ equipment }: EquipmentFormProps) {
  const t = useTranslations("operationPlan.equipment");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();
  const [showDelete, setShowDelete] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const isPending = createEquipment.isPending || updateEquipment.isPending;

  const resetImage = () => {
    setImageFile(null);
    setImageRemoved(false);
  };

  const handleImageChange = ({ file, removed }: EqImageChange) => {
    setImageFile(file);
    setImageRemoved(removed);
  };

  const equipmentSchema = createEquipmentSchema(tv, tfl);
  const f = useEntityForm<EquipmentFormValues>({
    entity: equipment,
    serverFieldErrors: { RECIPE_EQUIPMENT_ALREADY_EXISTS: "code" },
    resolver: zodResolver(equipmentSchema) as Resolver<EquipmentFormValues>,
    defaultValues: getDefaultValues(equipment),
    listPath: LIST_PATH,
    isPending,
    // รูปที่เลือกไว้แต่ยังไม่อัปโหลดก็นับเป็นของที่จะหาย
    extraDirty: imageFile !== null || imageRemoved,
    onResetExtra: resetImage,
  });
  const { form, isEdit, isDisabled } = f;

  const onSubmit = (values: EquipmentFormValues) => {
    const payload = {
      code: values.code,
      name: values.name,
      description: values.description || null,
      category_id: values.category_id,
      brand: values.brand || null,
      model: values.model || null,
      serial_no: values.serial_no || null,
      capacity: values.capacity || null,
      power_rating: values.power_rating || null,
      station: values.station || null,
      operation_instructions: values.operation_instructions || null,
      safety_notes: values.safety_notes || null,
      cleaning_instructions: values.cleaning_instructions || null,
      maintenance_schedule: values.maintenance_schedule || null,
      last_maintenance_date: values.last_maintenance_date || null,
      next_maintenance_date: values.next_maintenance_date || null,
      note: values.note || null,
      is_active: values.is_active,
      is_portable: values.is_portable,
      available_qty: values.available_qty,
      total_qty: values.total_qty,
      usage_count: values.usage_count,
      average_usage_time: values.average_usage_time,
    };

    if (isEdit && equipment) {
      updateEquipment.mutate(
        // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
        {
          id: equipment.id,
          doc_version: equipment.doc_version,
          ...payload,
          image: imageFile,
          remove_image: imageRemoved,
        },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            resetImage();
            // reset baseline ให้ isDirty กลับเป็น false — ไม่งั้น discard dialog
            // จะเด้งตอน Cancel ทั้งที่ผู้ใช้ save ไปแล้ว
            form.reset(values);
            f.setMode("view");
          },
        },
      );
    } else {
      createEquipment.mutate(
        { ...payload, image: imageFile },
        {
          onSuccess: () => {
            toast.success(tt("createSuccess", { entity: t("entity") }));
            resetImage();
            // navigate กลับ list เหมือน form อื่นใน operation-plan — ถ้าค้างที่หน้า
            // /new toolbar จะโชว์ Edit แล้วกด Save อีกครั้งจะ create ซ้ำ (equipment
            // prop ยัง undefined)
            f.backToList();
          },
        },
      );
    }
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const handleDelete = () => {
    if (!equipment) return;
    deleteEquipment.mutate(equipment.id, {
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
        <EqToolbar
          form={form}
          mode={f.mode}
          isPending={isPending}
          isDeleting={deleteEquipment.isPending}
          onBack={f.handleBack}
          onEdit={f.handleEdit}
          onCancel={f.handleCancel}
          onDelete={equipment ? () => setShowDelete(true) : undefined}
        />
      }
    >
      {equipment && f.mode === "view" && (
        <EqSummary form={form} imageUrl={equipment.image_url} />
      )}

      <form
        id="equipment-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <EqGeneralSection
          form={form}
          isDisabled={isDisabled}
          imageUrl={equipment?.image_url}
          imageFile={imageFile}
          imageRemoved={imageRemoved}
          onImageChange={handleImageChange}
          savedCategory={
            equipment
              ? { id: equipment.category_id, name: equipment.category_name }
              : undefined
          }
        />
        <EqQuantitySection form={form} isDisabled={isDisabled} />
        <EqInstructionsSection form={form} isDisabled={isDisabled} />
        <EqMaintenanceSection form={form} isDisabled={isDisabled} />
        <EqAdditionalSection form={form} isDisabled={isDisabled} />
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

      {equipment && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteEquipment.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: equipment.name })}
          isPending={deleteEquipment.isPending}
          onConfirm={handleDelete}
        />
      )}
    </FormPageShell>
  );
}
