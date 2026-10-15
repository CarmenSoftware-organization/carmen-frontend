import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/** comment + ไฟล์แนบของ vendor หนึ่งราย — สัญญาเดียวกับ comment ของ PO/PR */
export const vendorCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.VENDOR_COMMENTS,
  commentEndpoint: API_ENDPOINTS.VENDOR_COMMENT,
  idFieldName: "vendor_id",
  label: "vendor",
});
