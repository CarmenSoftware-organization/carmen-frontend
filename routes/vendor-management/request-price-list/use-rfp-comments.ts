import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของ request price list หนึ่งใบ (จดประวัติ) — สัญญาเดียวกับ comment ของ price list */
export const requestPriceListCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.REQUEST_PRICE_LIST_COMMENTS,
  commentEndpoint: API_ENDPOINTS.REQUEST_PRICE_LIST_COMMENT,
  idFieldName: "request_for_pricing_id",
  label: "request price list",
});
