import { createCommentCrud } from "@/hooks/use-comment-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";

/**
 * comment + ไฟล์แนบของใบปรับปรุงสต็อก (จดประวัติ) — stock-in กับ stock-out
 * เป็นคนละตาราง/คนละ endpoint ฝั่ง backend จึงมีสองชุด เลือกตาม `?type` ของหน้า
 */
export const stockInCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.STOCK_IN_COMMENTS,
  commentEndpoint: API_ENDPOINTS.STOCK_IN_COMMENT,
  idFieldName: "stock_in_id",
  label: "stock in",
});

export const stockOutCommentCrud = createCommentCrud({
  queryKey: QUERY_KEYS.STOCK_OUT_COMMENTS,
  commentEndpoint: API_ENDPOINTS.STOCK_OUT_COMMENT,
  idFieldName: "stock_out_id",
  label: "stock out",
});
