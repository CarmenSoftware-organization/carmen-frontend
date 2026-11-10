import { useState } from "react";
import { useListReturn } from "@/hooks/use-list-return";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { AnimationStyles, Reveal } from "@/components/share/reveal";
import { toast } from "sonner";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useUpdateUser } from "@/hooks/use-user";
import type { UserDetail } from "@/types/user";
import type { FormMode } from "@/types/form";
import {
  userAssignedSchema,
  getDefaultValues,
  buildUserPatch,
  type UserAssignedFormValues,
} from "./user-assigned-form-schema";
import { UserAvatar } from "./user-assigned-ui";
import { RolesSection } from "./user-assigned-roles";
import { DepartmentsSection } from "./user-assigned-departments";
import { LocationsSection } from "./user-assigned-locations";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { StatusBadge } from "@/components/ui/status-badge";

interface UserAssignedFormProps {
  readonly user: UserDetail;
}

export function UserAssignedForm({ user }: UserAssignedFormProps) {
  const { toList } = useListReturn("/system-admin/user");
  const tt = useTranslations("toast");
  const tfl = useTranslations("field");
  const [mode, setMode] = useState<FormMode>("view");
  const isView = mode === "view";

  // รายการ role โหลดทีละหน้าใน RolesSection เอง (PagedChecklist)
  const updateUser = useUpdateUser();

  // ค่าตั้งต้นของทั้งสามส่วนมาพร้อมตัวผู้ใช้ในนัดเดียว — เก็บไว้เทียบตอน submit
  // ว่าอะไรเปลี่ยนบ้าง (PATCH รับ diff ไม่ใช่ทั้งชุด)
  const initialValues = getDefaultValues(user);

  // middlename เพิ่งมากับสัญญาใหม่ — ชื่อเต็มจึงตรงกับที่การ์ดในหน้ารายการแสดง
  const fullName = [
    user.user.firstname,
    user.user.middlename,
    user.user.lastname,
  ]
    .filter(Boolean)
    .join(" ");

  const form = useForm<UserAssignedFormValues>({
    resolver: zodResolver(
      userAssignedSchema,
    ) as Resolver<UserAssignedFormValues>,
    defaultValues: initialValues,
  });

  const isPending = updateUser.isPending;
  const isDisabled = isView || isPending;

  const onSubmit = async (values: UserAssignedFormValues) => {
    const payload = buildUserPatch(initialValues, values);

    // กด Save ทั้งที่ไม่ได้แตะอะไร = กลับไปโหมดดูเฉย ๆ ไม่ต้องกวน backend
    if (!payload) {
      setMode("view");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUser.mutateAsync({ user_id: user.user_id, ...payload });
      toast.success(tt("updateSuccess", { entity: tfl("user") }));
      toList();
    } catch {
      // toast ขึ้นจาก MutationCache กลางแล้ว — แค่ไม่ navigate ออกจากฟอร์ม
      // ต้องเปิด guard กลับ ไม่งั้นฟอร์มที่ยัง dirty อยู่จะออกได้โดยไม่ถาม
      setIsSubmitting(false);
    }
  };

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending,
  });

  // ปิด guard ตั้งแต่กดบันทึก — submit สำเร็จแล้วเด้งกลับหน้ารายการ ถ้ายังเปิดอยู่
  // sentinel จะค้างใน history stack กด back แล้วเจอหน้าเดิมซ้ำ
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useDiscardConfirm ดักได้แค่ปุ่มในฟอร์มเอง (Cancel/Back) — ลิงก์ข้างนอกอย่าง
  // เมนู sidebar ต้องใช้ตัวนี้ดัก ไม่งั้นกดแล้วหลุดออกไปพร้อมข้อมูลที่ยังไม่ได้เซฟ
  const navGuard = useNavigationGuard(
    !isView && form.formState.isDirty && !isSubmitting,
  );

  const handleCancel = () => {
    discard.confirm(() => {
      form.reset(initialValues);
      setMode("view");
    });
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const goBack = () => {
    toList();
  };

  const handleBack = () => {
    if (mode === "edit") {
      discard.confirm(goBack);
    } else {
      goBack();
    }
  };

  /* useWatch subscribes only to `role_ids` for live count */
  const watchedRoleIds = useWatch({
    control: form.control,
    name: "role_ids",
  });
  const roleCount = watchedRoleIds?.length ?? 0;

  return (
    <FormPageShell
      header={
        <FormToolbar
          mode={mode}
          formId="user-assigned-form"
          isPending={isPending}
          title={fullName}
          leading={
            <UserAvatar
              first={user.user.firstname}
              last={user.user.lastname}
              avatarUrl={user.user.avatar_url}
            />
          }
          badges={
            <StatusBadge active={user.user.is_active} className="shrink-0" />
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="break-all">{user.user.email}</span>
              <span aria-hidden="true">·</span>
              <span>@{user.user.username}</span>
            </span>
          }
          onBack={handleBack}
          onCancel={handleCancel}
          onEdit={() => setMode("edit")}
        />
      }
    >
      <AnimationStyles />

      {/* ── Settings-style sections (title+desc left · body right) ── */}
      {/* ฟอร์มเดียวครอบทั้งสาม section — ปุ่ม Save อยู่นอกฟอร์มแล้วอ้างด้วย
          `form=` เดิม `<form>` ซ่อนอยู่ใน RolesSection ซึ่ง render เฉพาะตอนมี
          role ให้เลือก กดบันทึกตอนไม่มี role เลยเงียบสนิทเพราะปุ่มชี้ไปที่ไม่มีอยู่ */}
      <form
        id="user-assigned-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <Reveal delay={80}>
          <RolesSection
            first
            form={form}
            isDisabled={isDisabled}
            count={roleCount}
          />
        </Reveal>

        <Reveal delay={140}>
          <DepartmentsSection
            form={form}
            isDisabled={isDisabled}
            departmentName={user.department?.name}
          />
        </Reveal>

        <Reveal delay={200}>
          <LocationsSection
            form={form}
            isDisabled={isDisabled}
            userLocations={user.locations}
          />
        </Reveal>
      </form>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </FormPageShell>
  );
}
