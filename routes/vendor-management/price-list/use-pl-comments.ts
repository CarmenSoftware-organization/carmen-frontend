import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของ price list หนึ่งใบ (จดประวัติ) — สัญญาเดียวกับ comment ของ vendor/product */
export const priceListCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.PRICE_LIST_COMMENTS,
  commentEndpoint: API_ENDPOINTS.PRICE_LIST_COMMENT,
  idFieldName: "pricelist_id",
  label: "price list",
});
