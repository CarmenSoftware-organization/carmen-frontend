import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของหมวดสูตรอาหารหนึ่งหมวด — สัญญาเดียวกับ comment ของ recipe */
export const recipeCategoryCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.RECIPE_CATEGORY_COMMENTS,
  commentEndpoint: API_ENDPOINTS.RECIPE_CATEGORY_COMMENT,
  idFieldName: "recipe_category_id",
  label: "recipe category",
});
