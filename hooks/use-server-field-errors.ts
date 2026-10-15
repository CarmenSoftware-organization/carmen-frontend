import { useEffect, useRef } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { getUserErrorMessage } from "@/lib/error-message";
import { registerFieldErrorClaim } from "@/lib/server-field-errors";

/** รหัส catalog ของ backend → ช่องในฟอร์มที่เป็นต้นเหตุ */
export type ServerFieldErrorMap<TValues extends FieldValues> = Readonly<
  Partial<Record<string, Path<TValues>>>
>;

/**
 * แสดง error ที่ backend ตีกลับไว้ใต้ช่องที่เป็นต้นเหตุ แทน toast
 *
 * toast บอกว่าผิด แต่ไม่บอกว่าช่องไหน — "รหัสนี้มีผู้ขายรายอื่นใช้อยู่แล้ว" ขึ้นแดงใต้ช่อง
 * Code แล้ว focus ให้ คนกรอกแก้ได้ทันทีไม่ต้องไล่หา ข้อความเป็นตัวเดียวกับที่ toast
 * จะแสดง (`getUserErrorMessage`) และหายเองเมื่อแก้ช่องนั้นจนผ่าน schema
 *
 * ช่องที่ไม่อยู่บนจอ (แท็บอื่น / โหมด view) ปล่อยให้ toast กลางขึ้นตามเดิม —
 * error ใต้ช่องที่มองไม่เห็นแย่กว่าไม่บอกเลย
 *
 * @example
 * useServerFieldErrors(form, { VENDOR_CODE_ALREADY_EXISTS: "code" });
 */
export function useServerFieldErrors<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  map: ServerFieldErrorMap<TValues> | undefined,
) {
  const tErr = useTranslations("errors");
  const tField = useTranslations("field");
  // ค่าล่าสุดผ่าน ref — map มักเป็น object literal ที่สร้างใหม่ทุก render
  // ใส่ใน deps ตรง ๆ จะลงทะเบียนใหม่ทุก render
  const latest = useRef({ form, map, tErr, tField });
  useEffect(() => {
    latest.current = { form, map, tErr, tField };
  });

  const enabled = !!map && Object.keys(map).length > 0;

  useEffect(() => {
    if (!enabled) return;
    return registerFieldErrorClaim((error) => {
      const { form, map, tErr, tField } = latest.current;
      const field = error.appCode ? map?.[error.appCode] : undefined;
      if (!field || document.getElementsByName(field).length === 0) {
        return false;
      }
      form.setError(field, {
        type: "server",
        message: getUserErrorMessage(error, tErr, tField),
      });
      form.setFocus(field);
      return true;
    });
  }, [enabled]);
}
