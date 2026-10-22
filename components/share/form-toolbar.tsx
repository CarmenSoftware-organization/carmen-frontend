import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { History, MessageSquare, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openActivity } from "@/components/share/activity-sheet-host";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { useFormPrimaryClaimed } from "@/components/share/form-primary-action";
import { useCan } from "@/hooks/use-can";
import { usePermissionPrefix } from "@/hooks/use-permission-prefix";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import {
  buildPermissionKey,
  isKnownPermission,
  type Permission,
  type PermissionAction,
} from "@/constant/permissions";
import { cn } from "@/lib/utils";
import type { FormMode } from "@/types/form";

interface FormToolbarProps {
  /** ชื่อ entity สำหรับ title ที่ derive ตามโหมด ("Add X" / "Edit X" / X) — ไม่ต้องส่งถ้าส่ง `title` */
  readonly entity?: string;
  readonly mode: FormMode;
  readonly formId: string;
  readonly isPending: boolean;
  /** ไม่ส่ง = ไม่มีปุ่มย้อนกลับ (หน้า settings) */
  readonly onBack?: () => void;
  readonly onCancel: () => void;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
  readonly deleteIsPending?: boolean;
  /** ทับ title ที่ derive จาก entity ทุกโหมด (เลขที่เอกสาร / ชื่อสดจาก useWatch / placeholder) */
  readonly title?: string;
  readonly titleMuted?: boolean;
  readonly subtitle?: ReactNode;
  readonly badges?: ReactNode;
  readonly leading?: ReactNode;
  /** label ของปุ่ม Save ตอน idle */
  readonly submitLabel?: string;
  /**
   * label ตอน pending — ไม่ส่ง = form.creating/saving ตามโหมด
   * ส่งคู่กับ submitLabel เมื่อป้าย idle ไม่ตรงกับโหมด (เอกสารที่ add แต่ปุ่มเขียน "Save")
   */
  readonly pendingLabel?: string;
  /** แทนปุ่ม Save ทั้งปุ่ม (product: disabled จน dirty · IA: ตั้ง doc_status ตอนคลิก) */
  readonly submitSlot?: ReactNode;
  /** ปิด Edit/Save/Delete พร้อม title อธิบาย — ทางเดียวกับ license (interface หมดอายุ) */
  readonly writeDisabledReason?: string;
  /** ปุ่มเพิ่มของหน้า (Print, Send email) ต่อท้าย Activity */
  readonly children?: ReactNode;
  readonly editTitle?: string;
  readonly permissionPrefix?: string;
  /**
   * ส่งต่อ `DocFormHeader.flush` — default true: ใน FormPageShell ไม่มี px-4 ของตัวเอง
   * shell ให้ gutter แล้ว header ต้อง flush เพื่อให้ title ตรงกับ body
   */
  readonly flush?: boolean;
  /** เปิดปุ่ม Activity — ไม่ส่ง = ไม่มีปุ่ม (เช่นโหมด add ที่ยังไม่มี id) */
  readonly activity?: { id: string; label?: string };
  /** เปิดปุ่ม Comment — ไม่ส่ง = ไม่มีปุ่ม (เช่นโหมด add ที่ยังไม่มี id) */
  readonly onComment?: () => void;
  /** แถวช่องข้อมูลใต้หัว ส่งต่อ `DocFormHeader.ribbon` (PR — ช่อง workflow/description) */
  readonly ribbon?: ReactNode;
}

/**
 * ชุดปุ่มมาตรฐานของหัวฟอร์มทุกหน้า (spec 2026-10-01-form-page-shell-design.md §2.3):
 * Edit (primary) | Cancel · Save (primary) ; Delete (outline, view+edit) ; Activity ; children
 *
 * ที่เดียวที่เช็ค license `canWrite` และ permission — permission gate เฉพาะ key ที่อยู่ใน
 * `PERMISSIONS` จริง (leaf ที่ใช้ permission ระดับโมดูลประกอบได้ key ผี เช่น
 * `operation_plan.update` ซึ่งต้องไม่ gate)
 */
export function FormToolbar({
  entity,
  mode,
  formId,
  isPending,
  onBack,
  onCancel,
  onEdit,
  onDelete,
  deleteIsPending = false,
  title,
  titleMuted,
  subtitle,
  badges,
  leading,
  submitLabel,
  pendingLabel,
  submitSlot,
  writeDisabledReason,
  children,
  editTitle,
  permissionPrefix,
  flush = true,
  activity,
  onComment,
  ribbon,
}: FormToolbarProps) {
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tActivity = useTranslations("activity");
  const tl = useTranslations("license");
  const { can, isAdmin, canWrite } = useCan();
  const autoPrefix = usePermissionPrefix();
  const prefix = permissionPrefix ?? autoPrefix;
  const isView = mode === "view";
  const isAdd = mode === "add";

  // สัญญาหมดอายุ/ถูกระงับ → ปิดปุ่มเขียนจริง (native disabled + title อธิบาย) ต่างจาก
  // permission ที่ยังคลิกได้แล้วเด้ง dialog — license มาก่อนเสมอเพราะแก้คนละวิธี
  // (ต่ออายุ ไม่ใช่ขอสิทธิ์) · writeDisabledReason ของหน้าใช้ทางเดียวกัน
  const disabledReason = !canWrite
    ? tl("writeDisabledTitle")
    : writeDisabledReason;
  const writeDisabled = disabledReason !== undefined;

  const resolvedTitle =
    title ??
    (mode === "add"
      ? tf("addTitle", { entity: entity ?? "" })
      : mode === "edit"
        ? (editTitle ?? tf("editTitle", { entity: entity ?? "" }))
        : (entity ?? ""));
  const submit = submitLabel ?? (isAdd ? tc("create") : tc("save"));
  const pending = pendingLabel ?? (isAdd ? tf("creating") : tf("saving"));

  // key ต่อ action — undefined เมื่อไม่มี prefix หรือ key ไม่อยู่ใน catalog (= ไม่ gate)
  const keyFor = (action: PermissionAction): Permission | undefined => {
    if (!prefix) return undefined;
    const key = buildPermissionKey(prefix, action);
    return isKnownPermission(key) ? key : undefined;
  };
  const savePermission = keyFor(isAdd ? "create" : "update");
  const updatePermission = keyFor("update");
  const deletePermission = keyFor("delete");
  const denied = (key: Permission | undefined) =>
    !!key && !isAdmin && !can(key);
  const saveDenied = denied(savePermission);
  const editDenied = denied(updatePermission);
  const deleteDenied = denied(deletePermission);
  // footer มีปุ่ม workflow (Submit/Approve/Commit) = ปุ่มนั้นคือปุ่มหลักของหน้า
  // Edit/Save ลดเป็น outline — ดู form-primary-action.tsx
  const primaryVariant = useFormPrimaryClaimed() ? "outline" : "default";

  const actions = (
    <>
      {/* key + type="button" กัน React reuse DOM node ข้ามโหมด — ถ้าปุ่ม Edit
          กลายร่างเป็นปุ่ม type=submit ระหว่างคลิก ฟอร์มจะถูก submit ทันที
          (เจอจริงใน role-form-hero ตอนเติมปุ่ม Print หน้า Edit) */}
      {isView && onEdit ? (
        <Button
          key="edit"
          type="button"
          variant={primaryVariant}
          size="sm"
          onClick={
            writeDisabled
              ? undefined
              : editDenied
                ? () => dispatchPermissionDenied(updatePermission)
                : onEdit
          }
          disabled={writeDisabled}
          title={disabledReason}
          aria-disabled={!writeDisabled && editDenied ? true : undefined}
          className={cn(!writeDisabled && editDenied && "opacity-50")}
        >
          <Pencil />
          {tc("edit")}
        </Button>
      ) : !isView ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            <X />
            {tc("cancel")}
          </Button>
          {submitSlot ??
            (writeDisabled ? (
              <Button
                type="button"
                variant={primaryVariant}
                size="sm"
                disabled
                title={disabledReason}
              >
                <Save />
                {submit}
              </Button>
            ) : saveDenied ? (
              <Button
                type="button"
                variant={primaryVariant}
                size="sm"
                onClick={() => dispatchPermissionDenied(savePermission)}
                aria-disabled
                className="opacity-50"
              >
                <Save />
                {submit}
              </Button>
            ) : (
              <Button
                type="submit"
                variant={primaryVariant}
                size="sm"
                form={formId}
                disabled={isPending}
              >
                <Save />
                {isPending ? pending : submit}
              </Button>
            ))}
        </>
      ) : null}
      {!isAdd && onDelete && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={
            writeDisabled
              ? undefined
              : deleteDenied
                ? () => dispatchPermissionDenied(deletePermission)
                : onDelete
          }
          disabled={
            writeDisabled || (!deleteDenied && (isPending || deleteIsPending))
          }
          title={disabledReason}
          aria-disabled={!writeDisabled && deleteDenied ? true : undefined}
          // outline สีแดง ไม่ใช่ variant destructive (พื้นแดงทึบ) — ยังเป็นปุ่มรองข้าง
          // ปุ่มหลัก แต่ต้องอ่านออกว่าเป็นการลบ ไม่ใช่ปุ่มเทาเหมือน Cancel ข้าง ๆ
          className={cn(
            "text-destructive hover:bg-destructive/10 hover:text-destructive",
            !writeDisabled && deleteDenied && "opacity-50",
          )}
        >
          <Trash2 />
          {tc("delete")}
        </Button>
      )}
      {/* ประวัติเป็นการ "ดู" อยู่ท้ายกลุ่มถัดจากปุ่มที่เปลี่ยนข้อมูล — ลำดับเดียว
          กับทุกหน้าเอกสารในแอป: Edit · Delete · Comment · Activity · Print */}
      {onComment && (
        <Button type="button" variant="outline" size="sm" onClick={onComment}>
          <MessageSquare />
          {tc("comment")}
        </Button>
      )}
      {activity && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openActivity(activity.id, activity.label)}
        >
          <History />
          {tActivity("title")}
        </Button>
      )}
      {children}
    </>
  );

  return (
    <DocFormHeader
      title={resolvedTitle}
      titleMuted={titleMuted}
      subtitle={subtitle}
      backLabel={tc("goBack")}
      onBack={onBack}
      badges={badges}
      leading={leading}
      actions={actions}
      ribbon={ribbon}
      flush={flush}
    />
  );
}
