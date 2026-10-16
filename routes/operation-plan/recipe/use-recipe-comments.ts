import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของสูตรอาหารหนึ่งสูตร — สัญญาเดียวกับ comment ของ vendor */
export const recipeCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.RECIPE_COMMENTS,
  commentEndpoint: API_ENDPOINTS.RECIPE_COMMENT,
  idFieldName: "recipe_id",
  label: "recipe",
});
