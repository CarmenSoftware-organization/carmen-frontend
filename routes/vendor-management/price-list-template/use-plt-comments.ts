import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของ price list template หนึ่งใบ (จดประวัติ) — สัญญาเดียวกับ comment ของ price list */
export const priceListTemplateCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.PRICE_LIST_TEMPLATE_COMMENTS,
  commentEndpoint: API_ENDPOINTS.PRICE_LIST_TEMPLATE_COMMENT,
  idFieldName: "pricelist_template_id",
  label: "price list template",
});
