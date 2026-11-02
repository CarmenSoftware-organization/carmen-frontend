import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของสินค้าหนึ่งตัว (จดประวัติ) — สัญญาเดียวกับ comment ของ vendor */
export const productCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.PRODUCT_COMMENTS,
  commentEndpoint: API_ENDPOINTS.PRODUCT_COMMENT,
  idFieldName: "product_id",
  label: "product",
});
