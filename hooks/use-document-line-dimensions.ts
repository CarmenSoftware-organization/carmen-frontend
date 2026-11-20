import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useWatch,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useLineDimensionRules } from "@/hooks/use-line-dimension-rules";
import { useLineDimensionsEnabled } from "@/hooks/use-line-dimensions-enabled";
import { ApiError } from "@/lib/api-error";
import { getUserErrorMessage } from "@/lib/error-message";
import {
  fillRuleDefaults,
  findLineDimensionViolations,
  type LineDimensionRuleInput,
  type LineDimensionRuleResult,
} from "@/lib/line-dimension-rules";
import { registerFieldErrorClaim } from "@/lib/server-field-errors";
import type { LineDimensionDocType } from "@/lib/line-dimension-scope";
import type { DimensionRef } from "@/types/gl-dimension";

/** รหัส error ของ backend ที่ hook นี้รับไปแสดงที่ชิปเอง (toast กลางจะไม่ขึ้นซ้ำ) */
const LINE_DIMENSION_ERROR_CODES: ReadonlySet<string> = new Set([
  "LINE_DIMENSION_REQUIRED",
  "LINE_DIMENSION_PROHIBITED",
  "LINE_DIMENSION_RULE_CONFLICT",
]);

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_INVALID: ReadonlyMap<string, ReadonlySet<string>> = new Map();

/** รูปบรรทัดที่ hook อ่านจากฟอร์ม — ทุกเอกสารใช้ชื่อฟิลด์ตรงกันหมด */
interface LineItem {
  id?: string | null;
  /** key ฝั่ง client ของบรรทัดใหม่ (ยังไม่มี id) — hook ใส่ให้เอง */
  row_key?: string;
  product_id?: string | null;
  location_id?: string | null;
  dimensions?: DimensionRef[];
  dimensions_dirty?: boolean;
}
interface LineForm {
  items: LineItem[];
}

/** คำขอให้ตารางกางแถวที่ชิปผิด — `id` เพิ่มทุกครั้งที่กดส่งไม่ผ่าน */
export interface DimensionRevealRequest {
  readonly id: number;
  readonly indexes: readonly number[];
}

export interface DocumentLineDimensions {
  /** เอกสารชนิดนี้เปิด dimension ต่อบรรทัดหรือไม่ */
  readonly enabled: boolean;
  /** โหมดดู (หรือใบที่ล็อกบรรทัด) — ชิปเป็นปุ่ม outline ไม่ใช่ช่องกรอก */
  readonly readOnly: boolean;
  /** key ของบรรทัด: id ของบรรทัดที่บันทึกแล้ว · `row_key` ของบรรทัดใหม่ · null = ยังไม่มี */
  keyOf: (item: LineItem | undefined) => string | null;
  resultFor: (key: string) => LineDimensionRuleResult | undefined;
  /** dimension id ที่ต้องเป็นสีแดง (ว่างจนกว่าจะกดส่งไม่ผ่าน) */
  invalidFor: (key: string) => ReadonlySet<string>;
  /** ข้อความ conflict ของบรรทัด (undefined = ไม่ขัดกัน) */
  messageFor: (key: string) => string | undefined;
  /** ผู้ใช้แก้บรรทัดนี้แล้ว — ล้างสีแดงของบรรทัดนั้น */
  clearInvalid: (key: string) => void;
  readonly isRulesPending: boolean;
  readonly isRulesError: boolean;
  refetchRules: () => void;
  readonly revealRequest: DimensionRevealRequest | null;
  /**
   * false = บล็อกแล้ว (toast + ชิปแดง + กางแถว + เข้าโหมดแก้ถ้ามี `enterEdit`) ห้ามเรียกตอน Save ใบ draft
   */
  validateBeforeSubmit: () => boolean;
  /** true = เป็น 422 ของ dimension และจัดการแล้ว (toast ของเราเอง) */
  applyServerError: (err: ApiError) => boolean;
}

export const DocumentLineDimensionsContext =
  createContext<DocumentLineDimensions | null>(null);

/** อ่าน dimension ของบรรทัดที่ฟอร์มเอกสารแจกไว้ (null = ไม่ได้อยู่ใต้ฟอร์มที่เปิดใช้) */
export function useDocumentLineDimensionsContext() {
  return useContext(DocumentLineDimensionsContext);
}

/** ค่าจากหัวใบที่ใช้กับทุกบรรทัด (SR: from/to location · IA: location + adjustment type) */
export type LineDimensionHeaderInput = Partial<
  Pick<
    LineDimensionRuleInput,
    "location_id" | "to_location_id" | "adjustment_type_id"
  >
>;

interface Args<T extends FieldValues> {
  docType: LineDimensionDocType;
  form: UseFormReturn<T>;
  /**
   * โหมดดู — ไม่เติมค่า default ลงฟอร์ม (setValue ทำให้ฟอร์มโหมดดู dirty แล้วเด้ง discard dialog)
   * และชิปเป็นอ่านอย่างเดียว
   */
  readOnly: boolean;
  /** ตรวจไม่ผ่าน / BE ตอบ 422 ของ dimension → พาหน้าเข้าโหมดแก้ไขให้แก้ต่อได้ */
  enterEdit?: () => void;
  /**
   * ค่าจากหัวใบที่ทับค่าระดับบรรทัด — เปลี่ยนแล้วดึงกฎใหม่ทุกบรรทัด
   * (ส่งเป็น object ใหม่ทุก render ได้ hook เทียบด้วยค่า)
   */
  headerInput?: LineDimensionHeaderInput;
  /** ถ้าชื่อฟิลด์สินค้า/คลังของฟอร์มไม่ใช่ `product_id` / `location_id` */
  toInput?: (
    item: LineItem,
  ) => Pick<LineDimensionRuleInput, "product_id" | "location_id">;
}

const defaultToInput = (item: LineItem) => ({
  product_id: item.product_id || null,
  location_id: item.location_id || null,
});

const keyOf = (item: LineItem | undefined): string | null =>
  item?.id || item?.row_key || null;

/**
 * dimension ต่อบรรทัดของ PR / PO / GRN / SR / IA: ดึงกฎตามบัญชี · เติม default · ตรวจก่อนส่ง · รับ 422
 *
 * จุดที่ต้องรู้:
 * - บรรทัดใหม่ไม่มี id จึงได้ `row_key` (uuid) เป็น key คงที่ — ใช้ index ไม่ได้เพราะแถวถูกเพิ่ม/ลบ/ดันลงได้
 * - 422 ต้องจองรหัสผ่าน `registerFieldErrorClaim`: toast กลางของ MutationCache รันก่อน `onError`
 *   ของ mutation เสมอ เรียก applyServerError ใน onError จึงไม่ทัน (มันจึงถูกลงทะเบียนให้เองที่นี่)
 * - `validateBeforeSubmit` บล็อกขณะกฎยังโหลดอยู่ (map ว่างจะทำให้ผ่านเงียบ ๆ) — ถ้าโหลดกฎล้มเหลวปล่อยผ่าน
 *   ให้ backend ตัดสิน (ด่านจริงอยู่ที่ backend)
 * - ไม่ใส่ใน zod: Save ใบ draft ต้องผ่านเสมอ
 *
 * @param args - ดู `Args`
 */
export function useDocumentLineDimensions<T extends FieldValues>({
  docType,
  form,
  readOnly,
  enterEdit,
  headerInput,
  toInput = defaultToInput,
}: Args<T>): DocumentLineDimensions {
  const t = useTranslations("lineDimension");
  const tErr = useTranslations("errors");
  const tField = useTranslations("field");
  const enabled = useLineDimensionsEnabled(docType);
  const lineForm = form as unknown as UseFormReturn<LineForm>;
  // เทียบด้วยค่า — หัวใบเปลี่ยนแล้ว `lines` ต้องสร้างใหม่ (ดึงกฎใหม่ทุกบรรทัด)
  const headerKey = JSON.stringify([
    headerInput?.location_id ?? null,
    headerInput?.to_location_id ?? null,
    headerInput?.adjustment_type_id ?? null,
  ]);

  // useWatch ด้วย compute: re-render เฉพาะเมื่อ key/สินค้า/คลังของบรรทัดเปลี่ยน ไม่ใช่ทุกครั้งที่พิมพ์
  // ในช่องอื่นของตาราง (watch ทั้ง items จะลาก form ทั้งใบ re-render ทุกตัวอักษร)
  const signature = useWatch({
    control: lineForm.control,
    name: "items",
    compute: (items: LineItem[] | undefined) =>
      (items ?? [])
        .map((item) => {
          const input = toInput(item ?? {});
          return [
            keyOf(item) ?? "?",
            input.product_id ?? "",
            input.location_id ?? "",
          ].join("\u0001");
        })
        .join("\u0002"),
  });

  // บรรทัดใหม่ที่ยังไม่มี key → ให้ uuid (ไม่ตั้ง dirty) แล้ว signature จะเปลี่ยนเองรอบถัดไป
  useEffect(() => {
    if (!enabled) return;
    const items = lineForm.getValues("items") ?? [];
    items.forEach((item, index) => {
      if (item && !keyOf(item)) {
        lineForm.setValue(`items.${index}.row_key`, crypto.randomUUID(), {
          shouldDirty: false,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ยิงเมื่อรายการบรรทัดเปลี่ยน
  }, [enabled, signature]);

  const lines = useMemo<LineDimensionRuleInput[]>(() => {
    if (!enabled) return [];
    const items = lineForm.getValues("items") ?? [];
    return items.flatMap((item) => {
      const key = keyOf(item);
      if (!item || !key) return [];
      return [
        {
          key,
          doc_type: docType,
          ...toInput(item),
          // หัวใบทับเฉพาะค่าที่ระบุมา (undefined = ใช้ค่าของบรรทัด)
          ...(headerInput?.location_id !== undefined && {
            location_id: headerInput.location_id,
          }),
          ...(headerInput?.to_location_id !== undefined && {
            to_location_id: headerInput.to_location_id,
          }),
          ...(headerInput?.adjustment_type_id !== undefined && {
            adjustment_type_id: headerInput.adjustment_type_id,
          }),
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature + headerKey คือเนื้อหาที่ใช้จริง
  }, [enabled, docType, signature, headerKey]);

  const rules = useLineDimensionRules(docType, lines);
  const { byKey } = rules;

  // เติม default ของช่อง mandatory ที่ยังว่างเมื่อกฎมาถึง (โหมดแก้เท่านั้น)
  useEffect(() => {
    if (!enabled || readOnly || byKey.size === 0) return;
    const items = lineForm.getValues("items") ?? [];
    items.forEach((item, index) => {
      const key = keyOf(item);
      if (!item || !key) return;
      const filled = fillRuleDefaults(item.dimensions ?? [], byKey.get(key));
      if (!filled) return;
      lineForm.setValue(`items.${index}.dimensions`, filled, {
        shouldDirty: true,
      });
      lineForm.setValue(`items.${index}.dimensions_dirty`, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เริ่มใหม่เมื่อกฎถึงหรือเข้าโหมดแก้
  }, [enabled, readOnly, byKey]);

  const [invalid, setInvalid] =
    useState<ReadonlyMap<string, ReadonlySet<string>>>(EMPTY_INVALID);
  const [revealRequest, setRevealRequest] =
    useState<DimensionRevealRequest | null>(null);

  // ค่าล่าสุดสำหรับ callback ที่ถูกเรียกนอก render (ปุ่มกดแบบ async, claim ของ 422)
  const latest = useRef({
    byKey,
    rules,
    enabled,
    enterEdit,
    t,
    tErr,
    tField,
    readOnly,
  });
  useEffect(() => {
    latest.current = {
      byKey,
      rules,
      enabled,
      enterEdit,
      t,
      tErr,
      tField,
      readOnly,
    };
  });

  const markInvalid = (
    entries: Map<string, Set<string>>,
    indexes: number[],
  ) => {
    setInvalid((prev) => {
      const next = new Map(prev);
      for (const [key, ids] of entries) {
        next.set(key, new Set([...(prev.get(key) ?? []), ...ids]));
      }
      return next;
    });
    setRevealRequest((prev) => ({ id: (prev?.id ?? 0) + 1, indexes }));
  };

  const validateBeforeSubmit = (): boolean => {
    const { byKey, rules, enabled, enterEdit, t } = latest.current;
    if (!enabled) return true;
    if (rules.isPending) {
      toast.warning(t("rulesPending"));
      return false;
    }
    const items = lineForm.getValues("items") ?? [];
    const checked = items.flatMap((item) => {
      const key = keyOf(item);
      return item && key ? [{ key, dimensions: item.dimensions ?? [] }] : [];
    });
    const violations = findLineDimensionViolations(checked, byKey);
    if (violations.length === 0) {
      setInvalid(EMPTY_INVALID);
      return true;
    }

    const entries = new Map<string, Set<string>>();
    for (const v of violations) {
      entries.set(v.key, (entries.get(v.key) ?? new Set()).add(v.dimension_id));
    }
    const indexes = items.flatMap((item, index) => {
      const key = keyOf(item);
      return key && entries.has(key) ? [index] : [];
    });
    markInvalid(entries, indexes);
    toast.warning(t("blockedSubmit", { count: entries.size }));
    enterEdit?.();
    return false;
  };

  const applyServerError = (err: ApiError): boolean => {
    const { enabled, enterEdit, tErr, tField, readOnly } = latest.current;
    if (!enabled) return false;
    const details = (err.details ?? {}) as {
      sequence_no?: number;
      detail_id?: string;
      dimension_id?: string;
    };
    const isLineError =
      !!err.appCode && LINE_DIMENSION_ERROR_CODES.has(err.appCode);
    // รหัสอื่นของ dimension (เช่น GL_DIMENSION_VALUE_INVALID) ที่ระบุบรรทัด + dimension มา
    // → ทำชิปแดงให้ แต่ไม่รับ toast ไปจากระบบกลาง
    if (!isLineError && !(details.detail_id && details.dimension_id))
      return false;

    const items = lineForm.getValues("items") ?? [];
    // จับคู่ด้วย detail_id เท่านั้น — sequence_no ของ BE ไม่ตรงกับลำดับในฟอร์มเสมอไป
    const index = details.detail_id
      ? items.findIndex((item) => item?.id === details.detail_id)
      : -1;
    const key = keyOf(items[index]);
    if (!key) return false;
    markInvalid(
      new Map([
        [key, new Set(details.dimension_id ? [details.dimension_id] : [])],
      ]),
      [index],
    );
    enterEdit?.();
    if (!isLineError) return false;
    const message = getUserErrorMessage(err, tErr, tField);
    // อ่านอย่างเดียวและไม่มี enterEdit = ขั้นที่ผู้ใช้แก้ dimension ไม่ได้ (เช่น อนุมัติ/จ่าย SR) → บอกให้ส่งกลับผู้ขอ
    toast.error(
      readOnly && !enterEdit
        ? `${message} ${latest.current.t("lockedStepHint")}`
        : message,
    );
    return true;
  };

  // 422 จาก mutation ใดก็ได้ที่ฟอร์มนี้ยิง — ต้องจองไว้ก่อน (ดูหัว hook)
  const applyServerErrorRef = useRef(applyServerError);
  useEffect(() => {
    applyServerErrorRef.current = applyServerError;
  });
  useEffect(() => {
    if (!enabled) return;
    return registerFieldErrorClaim((error) =>
      applyServerErrorRef.current(error),
    );
  }, [enabled]);

  return {
    enabled,
    readOnly,
    keyOf,
    resultFor: (key) => byKey.get(key),
    invalidFor: (key) => invalid.get(key) ?? EMPTY_SET,
    messageFor: (key) =>
      byKey.get(key)?.status === "conflict" ? t("conflict") : undefined,
    clearInvalid: (key) =>
      setInvalid((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }),
    isRulesPending: rules.isPending,
    isRulesError: rules.isError,
    refetchRules: rules.refetch,
    revealRequest,
    validateBeforeSubmit,
    applyServerError,
  };
}
