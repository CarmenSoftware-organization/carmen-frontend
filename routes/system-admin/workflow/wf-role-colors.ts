import { PencilLine, ShoppingCart, Stamp, PackageCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WORKFLOW_TYPE, type Role } from "@/types/workflows";

/**
 * ไอคอนประจำ role — ตัวแยกหมวดตัวเดียวที่เหลือ
 *
 * เดิมไฟล์นี้มี map สีต่อ role อีก 4 ชุด (ROLE_TEXT / ROLE_SOLID /
 * ROLE_NODE_BORDER / ROLE_LABEL_COLOR) ที่ผูก create→primary, approve→warning,
 * purchase→info, issue→success — docs/DESIGN.md บอกว่า "no second brand color
 * exists" และการยืม token เชิงความหมายมาใช้บอกหมวดยังทำให้สื่อผิดด้วย
 * (approve ไม่ใช่คำเตือน issue ไม่ใช่ความสำเร็จ) — รูปร่างไอคอน + label
 * ทำหน้าที่นี้ได้อยู่แล้ว
 */
export const ROLE_ICON: Record<Role, LucideIcon> = {
  create: PencilLine,
  approve: Stamp,
  purchase: ShoppingCart,
  issue: PackageCheck,
};

/**
 * role ที่ stage ของ workflow แต่ละชนิดเลือกได้ — PR ไปจบที่จัดซื้อ (purchase) PO ไม่มีขั้นต่อจาก
 * อนุมัติ ส่วน SR ไปจบที่ตัดจ่าย (issue) ชนิดที่ไม่รู้จักได้ครบทุก role (ไม่ล็อกของเก่าที่อ่านไม่ออก)
 */
export const ROLES_BY_WORKFLOW_TYPE: Record<WORKFLOW_TYPE, readonly Role[]> = {
  [WORKFLOW_TYPE.PR]: ["create", "approve", "purchase"],
  [WORKFLOW_TYPE.PO]: ["create", "approve"],
  [WORKFLOW_TYPE.SR]: ["create", "approve", "issue"],
};

const ALL_ROLES: readonly Role[] = ["create", "approve", "purchase", "issue"];

export const getAllowedRoles = (workflowType?: string): readonly Role[] =>
  ROLES_BY_WORKFLOW_TYPE[workflowType as WORKFLOW_TYPE] ?? ALL_ROLES;

/** คีย์ i18n (namespace `systemAdmin.workflow`) ของชื่อ role */
export const ROLE_LABEL: Record<Role, string> = {
  create: "roleCreate",
  approve: "roleApprove",
  purchase: "rolePurchase",
  issue: "roleIssue",
};
