import { useState } from "react";
import { useParams } from "react-router";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { ErrorState } from "@/components/ui/error-state";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { SettingSectionSkeleton } from "@/components/ui/setting-section";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";

/**
 * โครงหน้าที่ทุก interface form ใช้ร่วมกัน — header, ปุ่ม Save, skeleton, ErrorState
 * และ guard กันออกจากหน้าตอนแก้ค้าง
 *
 * ไม่ถือ form state เอง: form component เป็นคนถือ `useForm` แล้วส่ง `handleSubmit`
 * เข้ามาเป็น `onSave` กับส่ง `formState.isDirty` เข้ามาเป็น `isDirty` เหตุที่ไม่ให้
 * layout ถือ form state เพราะจะต้องมี generic schema ซึ่งทำให้ interface ที่หน้าตา
 * ต่างกัน (เช่นมี mapping table) ใส่เพิ่มไม่ได้
 *
 * guard อยู่ที่นี่ไม่ใช่ในแต่ละ form เพื่อไม่ให้ก๊อปโค้ดเดียวกันสามรอบ
 *
 * **โหมด view/edit อยู่ที่นี่ที่เดียวเช่นกัน** — เปิดหน้ามาเป็นโหมดอ่าน กด Edit ถึงแก้ได้
 * การปิดช่องกรอกใช้ `<fieldset disabled>` ครอบ children แทนที่จะเจาะ prop `readOnly`
 * ทะลุลงไปทุก field (มีราว 25 ช่องกระจายใน 4 ฟอร์ม) — fieldset ปิด input/select/switch
 * ที่อยู่ข้างในให้หมดในทีเดียว รวมถึง Radix Select/Switch ที่ render เป็น <button>
 *
 * resolve entitlement เองที่นี่แทนที่จะรับ prop เข้ามา — ทุก brand form (4 ไฟล์) mount
 * ผ่านตัวนี้ตัวเดียว จึงล็อกจุดเดียวครอบทุก brand ได้โดยไม่ต้องเจาะ prop `readOnly` ทะลุ
 * ทั้งสี่ฟอร์ม เมื่อ entitlement เป็น `"expired"` ปุ่ม Save และการ submit ฟอร์ม (เช่น กด
 * Enter ใน field) ถูกปิดทั้งคู่
 *
 * **การ์ดนี้เป็น client-side เท่านั้น** — backend ยังไม่มี per-brand gate สำหรับการเขียน
 * interface config: `PUT /api/config/:buCode/app-config/:key` เช็คแค่ feature รวม
 * `configuration.app_config` ไม่มี entry แยกต่อ interface ใน license catalog ที่ generate
 * ไว้ ผู้ใช้ที่แก้ payload เองข้าม UI (เช่นยิง API ตรง) ยังเขียนทับได้อยู่ — ต้องปิดที่ backend
 * ด้วยถึงจะนับเป็นการบังคับใช้จริงตาม design spec (เห็นได้แต่แก้ไม่ได้)
 *
 * @param props.onSave - handleSubmit ของ form ที่ครอบอยู่
 * @param props.isDirty - `form.formState.isDirty` ของ form ที่ครอบอยู่
 * @param props.children - field ของ form (ปกติเป็น SettingSection หลายอัน)
 * @returns React element ของโครงหน้า interface
 */
export function InterfacePageLayout({
  title,
  description,
  onSave,
  isSaving,
  isLoading,
  isError,
  isDirty,
  onRetry,
  errorMessage,
  saveLabel,
  onCancel,
  notice,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly onSave: () => void;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly isDirty: boolean;
  readonly onRetry: () => void;
  readonly errorMessage: string;
  readonly onCancel: () => void;
  readonly saveLabel: string;
  /** แถบแจ้งเตือนเหนือฟอร์ม อยู่นอก fieldset จึงกดปุ่มข้างในได้แม้เป็นโหมดอ่าน */
  readonly notice?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  const t = useTranslations("systemAdmin.interface");
  // เปิดหน้ามาเป็นโหมดอ่านเสมอ — การตั้งค่า interface เป็นของที่คนเข้ามาดูบ่อยกว่าแก้
  // และแก้พลาดแล้วทำให้การเชื่อมต่อล่มทั้ง BU
  const [isEditing, setIsEditing] = useState(false);

  // แก้ค้างแล้วกดลิงก์/กด back → ถามก่อนทิ้ง
  // ไม่ต้องกัน `!isSaving`: ช่วงที่ save กำลังวิ่งคือช่วงที่เสี่ยงเสียงานที่สุด ต้องกันด้วย
  // และพอ save สำเร็จ form.reset ทำให้ isDirty เป็น false เองอยู่แล้ว (ตาม default-setting)
  const navGuard = useNavigationGuard(isDirty);

  const { category, brand } = useParams<{ category: string; brand: string }>();
  const { entitlementOf } = useInterfaceEntitlement();
  const isExpired = entitlementOf(category ?? "", brand ?? "") === "expired";

  // ปิดทั้งปุ่มและ native submit ของ <form> (เช่นกด Enter ใน field ก็ยังยิง onSubmit ได้
  // แม้ปุ่ม disabled อยู่) — `e?.preventDefault()` ยังต้องเรียกเพื่อกัน browser submit จริง
  // ตอนไม่ expired forward event เดิมต่อให้ `onSave` (ผลลัพธ์ของ `form.handleSubmit`) เพราะ
  // ตัวมันเองก็ต้องใช้ event เรียก preventDefault ของมันเองเช่นกัน
  const guardedSave = (e?: React.SyntheticEvent) => {
    if (isExpired) {
      e?.preventDefault();
      return;
    }
    (onSave as unknown as (e?: React.SyntheticEvent) => void)(e);
  };

  return (
    <FormPageShell
      header={
        <FormToolbar
          mode={isEditing ? "edit" : "view"}
          formId="interface-config-form"
          isPending={isSaving}
          title={title}
          subtitle={description}
          submitLabel={saveLabel}
          writeDisabledReason={isExpired ? t("expiredNotice") : undefined}
          onCancel={() => {
            onCancel();
            setIsEditing(false);
          }}
          onEdit={!isError && !isLoading ? () => setIsEditing(true) : undefined}
        />
      }
    >
      {isError && <ErrorState message={errorMessage} onRetry={onRetry} />}

      {!isError && isLoading && (
        <div>
          <SettingSectionSkeleton
            first
            fields={["half", "half", "half", "half"]}
          />
          <SettingSectionSkeleton fields={["half", "half", "full"]} />
        </div>
      )}

      {!isError && !isLoading && notice}

      {!isError && !isLoading && (
        <form id="interface-config-form" onSubmit={guardedSave}>
          {/* `min-w-0` เพราะ fieldset ตั้ง min-width เป็น min-content เอง ซึ่งทำให้
              grid ข้างในล้นออกนอกกรอบเมื่อจอแคบ */}
          <fieldset disabled={!isEditing} className="min-w-0 border-0 p-0">
            {children}
          </fieldset>
        </form>
      )}

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
