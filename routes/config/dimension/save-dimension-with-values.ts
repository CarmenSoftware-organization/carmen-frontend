import type { Dispatch, SetStateAction } from "react";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type {
  DimensionMaster,
  DimensionValueMaster,
} from "@/types/accounting-master";
import { saveDimensionRecord } from "./save-dimension-record";

/** แถวค่าย่อยที่แก้ค้างใน dialog — บันทึกพร้อมกันตอนกด Save */
export interface DimensionValueDraft extends DimensionValueMaster {
  key: string;
  dirty: boolean;
  deleted?: boolean;
  /** ข้อความเมื่อบันทึก/ลบแถวนี้ไม่ผ่านในรอบล่าสุด */
  error?: string;
}

/**
 * บันทึก header ก่อน (พัง = throw) แล้วส่งเฉพาะแถวที่ `dirty`/`deleted`
 * แถวที่พังไม่ throw — เก็บ `error` ไว้ที่แถว แล้วคืนจำนวนที่พัง
 * กด Save ซ้ำจึงส่งเฉพาะแถวที่ยังค้าง (แถวที่ผ่านแล้ว `dirty: false`)
 */
export async function saveDimensionWithValues({
  buCode,
  values,
  savedItem,
  subValues,
  onSave,
  setSavedItem,
  setSubValues,
}: {
  buCode: string | undefined;
  values: Omit<DimensionMaster, "id" | "doc_version" | "values">;
  savedItem: DimensionMaster | null;
  subValues: DimensionValueDraft[];
  onSave: (
    value: Omit<DimensionMaster, "id" | "doc_version" | "values">,
    current: DimensionMaster | null,
  ) => Promise<DimensionMaster>;
  setSavedItem: (value: DimensionMaster) => void;
  setSubValues: Dispatch<SetStateAction<DimensionValueDraft[]>>;
}): Promise<{ failed: number }> {
  const visibleValues = subValues.filter((value) => !value.deleted);
  const codes = subValues.map((value) => value.code.trim().toUpperCase());
  if (visibleValues.some((value) => !value.code.trim() || !value.name.trim())) {
    throw new Error("Value and Label are required for every list item.");
  }
  if (new Set(codes).size !== codes.length) {
    throw new Error("List item values must be unique.");
  }
  if (!buCode) {
    throw new Error("Select a business unit first");
  }
  const master = await onSave(values, savedItem);
  setSavedItem(master);
  const pending = subValues.filter((row) => row.dirty || row.deleted);
  const results = await Promise.allSettled(
    pending.map(async (value) => {
      if (value.deleted) {
        const response = await httpClient.delete(
          `${API_ENDPOINTS.DIMENSION_VALUES(buCode)}/${value.id}`,
        );
        if (!response.ok)
          throw await ApiError.from(
            response,
            "Unable to delete dimension value",
          );
        const body = await response.json().catch(() => null);
        if (body?.success === false)
          throw new Error(body.message || "Unable to delete dimension value");
        setSubValues((current) =>
          current.filter((row) => row.key !== value.key),
        );
        return;
      }
      const changes = {
        name: value.name.trim(),
        name_local: value.name_local?.trim() || null,
        is_active: value.is_active,
      };
      const saved = await saveDimensionRecord(
        API_ENDPOINTS.DIMENSION_VALUES(buCode),
        value.id
          ? changes
          : {
              ...changes,
              code: value.code.trim().toUpperCase(),
              dimension_id: master.id,
            },
        value.id ? value : null,
      );
      setSubValues((current) =>
        current.map((row) =>
          row.key === value.key
            ? {
                ...row,
                ...saved,
                dimension_id: master.id,
                dirty: false,
                error: undefined,
              }
            : row,
        ),
      );
    }),
  );
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    failed += 1;
    const key = pending[index].key;
    const error =
      result.reason instanceof Error
        ? result.reason.message
        : "Unable to save this item";
    setSubValues((current) =>
      current.map((row) => (row.key === key ? { ...row, error } : row)),
    );
  });
  return { failed };
}
