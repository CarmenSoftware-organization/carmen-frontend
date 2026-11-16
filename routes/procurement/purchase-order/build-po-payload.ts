import { buildItemChanges } from "@/lib/form-helpers";
import { withFreshDetailVersions } from "@/lib/doc-version";
import { type CreatePoDto, PO_TYPE } from "@/types/purchase-order";
import { mapItemToPayload, type PoFormValues } from "./po-form-schema";

/**
 * @param options.docVersion - เลขเวอร์ชันที่ resolve มาแล้ว (GET สดจาก DB) ไม่ส่ง =
 *   ใช้ค่าในฟอร์ม ซึ่งถูกเฉพาะใบใหม่ที่ยังไม่มี id ให้ไป GET · ใบที่มีอยู่แล้วต้อง
 *   ส่งมาเสมอ ไม่งั้น /save รอบถัดไปชน 409 (ดู lib/doc-version.ts)
 */
export function buildPoPayload(
  values: PoFormValues,
  defaultItems: PoFormValues["items"],
  options?: {
    po_type?: PO_TYPE;
    /** เปิดช่อง dimension ต่อบรรทัด — false/ไม่ส่ง = ไม่ส่ง `dimensions` เลย */
    dimensionsEnabled?: boolean;
    docVersion?: number;
    freshDetails?: readonly { id: string; doc_version?: number }[];
  },
): CreatePoDto {
  const docVersion = options?.docVersion ?? values.doc_version;
  const purchaseOrderDetail = buildItemChanges(
    values.items,
    defaultItems,
    (item, index) =>
      mapItemToPayload(item, index, {
        dimensionsEnabled: options?.dimensionsEnabled,
      }),
  );
  // ทับหลัง buildItemChanges เสมอ — ดันเข้า input จะทำให้ทุกแถวกลายเป็น update
  purchaseOrderDetail.update = withFreshDetailVersions(
    purchaseOrderDetail.update,
    options?.freshDetails,
  );

  return {
    stage_role: "create",
    details: {
      ...(docVersion != null ? { doc_version: docVersion } : {}),
      ...(options?.po_type ? { po_type: options.po_type } : {}),
      workflow_id: values.workflow_id,
      vendor_id: values.vendor_id,
      vendor_name: values.vendor_name,
      delivery_date: values.delivery_date,
      currency_id: values.currency_id,
      currency_code: values.currency_code ?? "",
      exchange_rate: values.exchange_rate,
      description: values.description,
      order_date: values.order_date,
      ...(values.credit_term_id
        ? {
            credit_term_id: values.credit_term_id,
            credit_term_name: values.credit_term_name,
            credit_term_value: values.credit_term_value,
          }
        : {}),
      buyer_id: values.buyer_id,
      buyer_name: values.buyer_name,
      email: values.email,
      remarks: values.remarks,
      note: values.note,
      purchase_order_detail: purchaseOrderDetail,
    },
  };
}
