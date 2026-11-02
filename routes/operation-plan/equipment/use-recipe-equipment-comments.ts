import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของอุปกรณ์ครัว (equipment) หนึ่งรายการ — สัญญาเดียวกับ comment ของ recipe */
export const recipeEquipmentCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.RECIPE_EQUIPMENT_COMMENTS,
  commentEndpoint: API_ENDPOINTS.RECIPE_EQUIPMENT_COMMENT,
  idFieldName: "recipe_equipment_id",
  label: "equipment",
});
