import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { RecipePreparationStep } from "@/types/recipe";
import {
  diffSteps,
  draftToItem,
  isEmptyDiff,
  StepsChangedElsewhereError,
  type StepDraft,
} from "./recipe-steps-sync";

interface SyncVars {
  recipeId: string;
  original: RecipePreparationStep[];
  drafts: StepDraft[];
  /** id ของขั้นที่ POST สำเร็จ ตามลำดับ draft ใหม่ — ให้ฟอร์มผูกไว้กัน POST ซ้ำ */
  onAdded?: (ids: string[]) => void;
}

/**
 * เขียนขั้นตอนทำให้ตรงกับฟอร์ม: ลบ → แก้ → เพิ่ม → เรียงลำดับ
 *
 * ยิงทีละคำขอตามลำดับ (ไม่ Promise.all) เพราะ reorder ต้องรู้ id ของขั้นที่เพิ่งเพิ่ม
 * และต้องส่ง id ครบทุกขั้นที่ยังอยู่ · ไม่ atomic — ล้มกลางทาง ของที่เขียนไปแล้วคงอยู่
 * ล้มกลางทาง: ผู้เรียกผูก id ของขั้นที่ POST แล้วผ่าน `onAdded` ส่วน original/doc_version
 * มาจาก recipe ที่ refetch ใน onSettled — กด Save ซ้ำแล้ว diff เหลือแค่ส่วนที่ยังไม่ได้เขียน
 */
export function useSyncRecipeSteps() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, SyncVars>({
    mutationFn: async ({ recipeId, original, drafts, onAdded }) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const diff = diffSteps(original, drafts);
      if (isEmptyDiff(diff)) return;

      const base = API_ENDPOINTS.RECIPE_PREPARATION_STEPS(buCode, recipeId);
      const ensureOk = async (res: Response, fallback: string) => {
        if (!res.ok) throw await ApiError.from(res, fallback);
        return res;
      };

      for (const id of diff.toDelete) {
        await ensureOk(
          await httpClient.delete(`${base}/${id}`),
          "Failed to delete preparation step",
        );
      }
      for (const { step_id, body } of diff.toPatch) {
        await ensureOk(
          await httpClient.patch(`${base}/${step_id}`, body),
          "Failed to update preparation step",
        );
      }

      let addedIds: string[] = [];
      if (diff.toAdd.length > 0) {
        const res = await ensureOk(
          await httpClient.post(base, {
            details: { add: diff.toAdd.map(draftToItem) },
          }),
          "Failed to add preparation steps",
        );
        const json = (await res.json()) as { data?: { id: string }[] };
        addedIds = (json.data ?? []).map((r) => r.id);
        if (addedIds.length !== diff.toAdd.length) {
          throw new ApiError(
            "INTERNAL_ERROR",
            "Add preparation steps returned an unexpected number of rows",
          );
        }
        onAdded?.(addedIds);
      }

      if (diff.needsReorder) {
        let next = 0;
        const step_ids = drafts.map((d) => d.step_id ?? addedIds[next++]);
        try {
          await ensureOk(
            await httpClient.put(`${base}/order`, { step_ids }),
            "Failed to reorder preparation steps",
          );
        } catch (err) {
          if (err instanceof ApiError && err.statusCode === 400) {
            throw new StepsChangedElsewhereError(err);
          }
          throw err;
        }
      }
    },
    // ทั้งสำเร็จและล้มต้องดึงใหม่ — id/doc_version ของขั้นที่เขียนไปแล้วเปลี่ยน
    // return promise ไว้ให้ mutation ยัง pending จน refetch จบ (ปุ่ม Save ปิดอยู่)
    // ไม่งั้นกด Save ซ้ำทันทีจะ diff กับ original เก่าแล้ว PATCH ด้วย doc_version เก่า
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RECIPES] }),
  });
}
