import { useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { useListReturn } from "@/hooks/use-list-return";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import {
  useServerFieldErrors,
  type ServerFieldErrorMap,
} from "@/hooks/use-server-field-errors";
import type { FormMode } from "@/types/form";

interface UseEntityFormOptions<TValues extends FieldValues> {
  entity: unknown;
  resolver: Resolver<TValues>;
  defaultValues: DefaultValues<TValues>;
  listPath: string;
  isPending: boolean;
  extraDirty?: boolean;
  onResetExtra?: () => void;
  /** รหัส catalog → ช่องที่ต้องขึ้น error แทน toast (ดู `useServerFieldErrors`) */
  serverFieldErrors?: ServerFieldErrorMap<TValues>;
}

/**
 * โครงกลางของฟอร์ม entity — mode, dirty guard สองชั้น, และปุ่ม Back/Edit/Cancel
 *
 * **hook นี้จงใจไม่ตัดสินใจแทนเรื่อง payload กับปลายทางหลัง save** เพราะ 13 ฟอร์ม
 * ที่มีอยู่ตัดสินใจไม่เหมือนกันจริง ๆ (6 ใบเซฟแล้วอยู่หน้าเดิม · 5 ใบเด้งกลับ list ·
 * 2 ใบ create แล้ว replace ไปหน้าใบใหม่) และ payload ก็คนละรูป — role คำนวณ diff
 * ของ permission จากค่าเดิม ยัดเข้า config ไม่ได้เลย
 * ดู characterization test ของแต่ละใบ (`*-form.characterization.test.tsx`)
 * ที่พินพฤติกรรมพวกนั้นไว้ก่อนยุบ
 *
 * สิ่งที่ hook นี้รับผิดชอบคือ **ส่วนที่ทุกใบเหมือนกันจริง** และเป็นส่วนที่เคยลืม
 * ทีละใบมาแล้ว (13 ฟอร์มลืม `useNavigationGuard` — ดู dfbbfc9)
 *
 * @example
 * const f = useEntityForm({ entity: cuisine, resolver, defaultValues, listPath, isPending });
 * const onSubmit = (values) => {
 *   if (f.isEdit && cuisine) {
 *     f.submit(updateCuisine, { id: cuisine.id, ...payload }, () => f.backToList());
 *   } else {
 *     f.submit(createCuisine, payload, () => f.backToList());
 *   }
 * };
 */
export function useEntityForm<TValues extends FieldValues>({
  entity,
  resolver,
  defaultValues,
  listPath,
  isPending,
  extraDirty = false,
  onResetExtra,
  serverFieldErrors,
}: UseEntityFormOptions<TValues>) {
  const { toList, returnState } = useListReturn(listPath);
  const [mode, setMode] = useState<FormMode>(entity ? "view" : "add");
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  const form = useForm<TValues>({ resolver, defaultValues });
  useServerFieldErrors(form, serverFieldErrors);

  // guard สองตัวต้องอ่าน dirty ค่าเดียวกัน ไม่งั้นปุ่ม Back ถามแต่เมนู sidebar เงียบ
  const isFormDirty = form.formState.isDirty || extraDirty;

  const discard = useDiscardConfirm({ isDirty: isFormDirty, isPending });

  // ระหว่าง submit ตอน create ปิด guard — ไม่งั้น sentinel ที่ guard ดันไว้ที่ /new
  // ค้างอยู่ใน history stack หลัง navigate ออกไป กด back แล้วเจอ /new ซ้ำ
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useDiscardConfirm ดักได้แค่ปุ่มในฟอร์มเอง (Cancel/Back) — ลิงก์ข้างนอกอย่าง
  // เมนู sidebar ต้องใช้ตัวนี้ดัก ไม่งั้นกดแล้วหลุดออกไปพร้อมข้อมูลที่ยังไม่ได้เซฟ
  const navGuard = useNavigationGuard(
    (isAdd || isEdit) && isFormDirty && !isSubmitting,
  );

  // ทางออกไป list ทุกทางผ่าน toList — พก query ของ list (filter/sort/page) กลับไปด้วย
  const backToList = () => toList();

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const handleBack = () => {
    if (isEdit || isAdd) {
      discard.confirm(backToList);
    } else {
      backToList();
    }
  };

  const handleEdit = () => setMode("edit");

  const handleCancel = () => {
    discard.confirm(() => {
      if (isEdit && entity) {
        // `keepFieldsRef` ไม่ใช่ของเสริม — ถ้าไม่ใส่ ค่าที่ยกเลิกไปแล้วจะค้างบนหน้าจอ
        //
        // `reset(values)` ที่ส่ง object เข้าไป จะเข้า branch `_fields = {}` ของ RHF
        // คือทิ้ง ref ของทุก field แล้ว **ไม่เขียนค่ากลับลง DOM** เพราะมันคาดว่า input
        // จะ unmount/remount ให้ `register` re-attach พร้อมค่าใหม่ ส่วน native
        // `form.reset()` ที่จะคืนค่า DOM ให้ ถูก gate ด้วย `isUndefined(formValues)`
        // การส่งค่าเข้าไปจึงปิดทางนั้นไปด้วย (react-hook-form 7.85.0 `_reset`)
        //
        // ฟอร์มที่นี่กด Cancel แล้ว input ไม่ remount — มีแค่ `disabled` ที่พลิก
        // state ของ RHF จึงคืนค่าถูกต้องแต่ช่องบนจอยังโชว์ข้อความที่เพิ่งยกเลิกไป
        // `keepFieldsRef: true` ทำให้เข้า loop `setValue()` ที่เขียนลง DOM จริงแทน
        form.reset(defaultValues, { keepFieldsRef: true });
        onResetExtra?.();
        setMode("view");
      } else {
        backToList();
      }
    });
  };

  /**
   * ยิง mutation แล้วจัดการ guard ให้เอง — ปิดก่อนยิง เปิดกลับเมื่อ error
   *
   * ต้องเปิดกลับทุกทางที่ยิงไม่ผ่าน ไม่งั้น guard ตายค้าง = ฟอร์มที่ยัง dirty
   * ออกได้โดยไม่ถาม ซึ่งแย่กว่าไม่มี guard เลย
   */
  const submit = <TPayload>(
    mutation: {
      mutate: (
        payload: TPayload,
        opts?: {
          onSuccess?: (res: unknown) => void;
          onError?: () => void;
        },
      ) => void;
    },
    payload: TPayload,
    onSuccess: (res: unknown) => void,
  ) => {
    setIsSubmitting(true);
    mutation.mutate(payload, {
      onError: () => setIsSubmitting(false),
      onSuccess,
    });
  };

  return {
    form: form as UseFormReturn<TValues>,
    mode,
    setMode,
    isView,
    isEdit,
    isAdd,
    isDisabled: isView || isPending,
    isFormDirty,
    isSubmitting,
    setIsSubmitting,
    discard,
    navGuard,
    backToList,
    /** spread ลง options ของ navigate() ตอน create สำเร็จแล้ว replace ไป /:id */
    returnState,
    handleBack,
    handleEdit,
    handleCancel,
    submit,
  };
}
