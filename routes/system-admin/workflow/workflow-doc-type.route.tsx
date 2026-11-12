import { Navigate, useLocation } from "react-router";
import WorkflowComponent from "./wf-component";
import { WORKFLOW_DOC_TYPES, type WorkflowDocType } from "@/hooks/use-workflow";

/**
 * หน้ารายการ workflow ของชนิดเอกสารเดียว — ใช้ไฟล์เดียวกับทั้งสาม path
 * (`/system-admin/workflow/purchase-request` · `.../purchase-order` ·
 * `.../store-requisition`) แล้วอ่านชนิดจาก segment สุดท้ายของ URL
 *
 * ทำเป็น route จริงแทน query เพราะแต่ละชนิดยิงคนละ endpoint
 * (`GET /config/{bu}/workflows/{slug}`) ไม่ใช่กรองจากชุดเดียวกัน
 */
export function Component() {
  const { pathname } = useLocation();
  const slug = pathname.split("/").filter(Boolean).pop();
  const docType = WORKFLOW_DOC_TYPES.find((t) => t === slug) as
    WorkflowDocType | undefined;
  if (!docType)
    return <Navigate to="/system-admin/workflow" replace />;
  return <WorkflowComponent docType={docType} />;
}
