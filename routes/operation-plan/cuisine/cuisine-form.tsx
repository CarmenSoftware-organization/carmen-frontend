import { lazy, Suspense, useState } from "react";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { toast } from "sonner";
import {
  useCreateCuisine,
  useUpdateCuisine,
  useDeleteCuisine,
} from "@/hooks/use-cuisine";
import type { Cuisine } from "@/types/cuisine";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import {
  cuisineSchema,
  getDefaultValues,
  mapToPayload,
  type CuisineFormValues,
} from "./cuisine-form-schema";
import { FormPageShell } from "@/components/share/form-page-shell";
import { CuisineToolbar } from "./cuisine-toolbar";
import { CuisineGeneralFields } from "./cuisine-general-fields";
import { CuisineDetailFields } from "./cuisine-detail-fields";
import { SECTION_PAIR } from "@/components/share/compact-section";
import { CuisineRecipes } from "./cuisine-recipes";
import { recipeCuisineCommentCrud } from "./use-recipe-cuisine-comments";

// sheet comment โหลดเมื่อกดเปิดครั้งแรก ไม่ต้องติดมากับหน้าฟอร์ม
const EntityCommentSheet = lazy(() =>
  import("@/components/share/entity-comment-sheet").then((m) => ({
    default: m.EntityCommentSheet,
  })),
);

interface CuisineFormProps {
  readonly cuisine?: Cuisine;
}

const LIST_PATH = "/operation-plan/cuisine";

export function CuisineForm({ cuisine }: CuisineFormProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tt = useTranslations("toast");
  const createCuisine = useCreateCuisine();
  const updateCuisine = useUpdateCuisine();
  const deleteCuisine = useDeleteCuisine();
  const [showDelete, setShowDelete] = useState(false);
  const [showComment, setShowComment] = useState(false);

  const f = useEntityForm<CuisineFormValues>({
    entity: cuisine,
    serverFieldErrors: { RECIPE_CUISINE_ALREADY_EXISTS: "name" },
    resolver: zodResolver(cuisineSchema) as Resolver<CuisineFormValues>,
    defaultValues: getDefaultValues(cuisine),
    listPath: LIST_PATH,
    isPending: createCuisine.isPending || updateCuisine.isPending,
  });
  const { form, isEdit, isView, isDisabled } = f;
  const isPending = createCuisine.isPending || updateCuisine.isPending;

  const onSubmit = (values: CuisineFormValues) => {
    const payload = mapToPayload(values);

    if (isEdit && cuisine) {
      f.submit(
        updateCuisine,
        // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
        { id: cuisine.id, doc_version: cuisine.doc_version, ...payload },
        () => {
          toast.success(tt("updateSuccess", { entity: t("entity") }));
          f.backToList();
        },
      );
    } else {
      f.submit(createCuisine, payload, () => {
        toast.success(tt("createSuccess", { entity: t("entity") }));
        f.backToList();
      });
    }
  };

  const handleDelete = () => {
    if (!cuisine) return;
    deleteCuisine.mutate(cuisine.id, {
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
        <CuisineToolbar
          form={form}
          mode={f.mode}
          isPending={isPending}
          isDeleting={deleteCuisine.isPending}
          onBack={f.handleBack}
          onEdit={f.handleEdit}
          onCancel={f.handleCancel}
          onDelete={cuisine ? () => setShowDelete(true) : undefined}
          activityId={cuisine?.id}
          onComment={cuisine ? () => setShowComment(true) : undefined}
          audit={cuisine?.audit}
          docVersion={cuisine?.doc_version}
          generalFields={
            <CuisineGeneralFields
              form={form}
              isDisabled={isDisabled}
              isView={isView}
            />
          }
        />
      }
    >
      <form
        id="cuisine-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* General (+ Note/Status) ย้ายเข้าการ์ดหัวแล้ว — Details เป็นหมวดแรกของตัวฟอร์ม
            จอ ≥1700px วางคู่กับ Recipes (ก้อนขวาตัด mt-5 ตอนวางคู่ ไม่งั้นต่ำกว่าซ้าย 20px)
            ใบใหม่ยังไม่มี Recipes → Details เต็มแถว ไม่ใช่ครึ่งแถวที่ว่างข้างหนึ่ง
            Recipes อยู่ในฟอร์มเพื่อวางคู่ได้ — มีแค่ลิงก์ ไม่มีช่องกรอก */}
        <div className={cuisine ? SECTION_PAIR : undefined}>
          <CuisineDetailFields
            form={form}
            isDisabled={isDisabled}
            isView={isView}
          />
          {cuisine && (
            <div className="min-[1700px]:[&>section]:mt-0">
              <CuisineRecipes cuisineId={cuisine.id} />
            </div>
          )}
        </div>
      </form>

      {cuisine && (
        <Suspense fallback={null}>
          <EntityCommentSheet
            crud={recipeCuisineCommentCrud}
            entityId={cuisine.id}
            open={showComment}
            onOpenChange={setShowComment}
          />
        </Suspense>
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

      {cuisine && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteCuisine.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: cuisine.name })}
          isPending={deleteCuisine.isPending}
          onConfirm={handleDelete}
        />
      )}
    </FormPageShell>
  );
}
