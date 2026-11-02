import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของประเภทอาหาร (cuisine) หนึ่งรายการ — สัญญาเดียวกับ comment ของ recipe */
export const recipeCuisineCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.RECIPE_CUISINE_COMMENTS,
  commentEndpoint: API_ENDPOINTS.RECIPE_CUISINE_COMMENT,
  idFieldName: "recipe_cuisine_id",
  label: "cuisine",
});
