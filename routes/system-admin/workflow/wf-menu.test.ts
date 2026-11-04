import { describe, it, expect } from "vitest";
import { moduleList } from "@/constant/module-list";
import { WORKFLOW_DOC_TYPES, WORKFLOW_LIST_HOOKS } from "@/hooks/use-workflow";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import th from "@/messages/th.json";
import en from "@/messages/en.json";

const findLeaf = (path: string) => {
  for (const mod of moduleList)
    for (const sub of mod.subModules ?? []) if (sub.path === path) return sub;
  return undefined;
};

describe("เมนูย่อยของ workflow", () => {
  const workflow = findLeaf("/system-admin/workflow");
  const children = workflow?.subModules ?? [];

  // ลูกของ workflow มีสองพันธุ์ ผูกสัญญาคนละชุด — แยกด้วย path เพราะนั่นคือสิ่งที่
  // ต่างกันจริง: ชนิดเอกสารซ้อนอยู่ใต้ path ของตัวแม่เพราะเป็น route ของ workflow
  // เอง ส่วนตัวที่ไม่ใช่เป็นหน้าคนละที่ที่เอามาวางไว้ใต้กลุ่มนี้เพราะความหมาย
  const docTypeChildren = children.filter((s) =>
    s.path.startsWith("/system-admin/workflow/"),
  );
  const guestChildren = children.filter(
    (s) => !s.path.startsWith("/system-admin/workflow/"),
  );

  it("มีเมนูชนิดเอกสารครบสี่ใบ", () => {
    expect(docTypeChildren.map((s) => s.name)).toEqual([
      "workflowPurchaseRequest",
      "workflowPurchaseOrder",
      "workflowStoreRequisition",
      "workflowJournalVoucher",
    ]);
  });

  it("path ของเมนูชนิดเอกสารลงท้ายด้วย slug ที่ endpoint รู้จัก", () => {
    // slug เพี้ยนเมื่อไร = ยิง GET /config/{bu}/workflows/<ผิด> แล้วได้ 404
    const slugs = docTypeChildren.map((s) =>
      s.path.replace("/system-admin/workflow/", ""),
    );
    expect(slugs).toEqual([...WORKFLOW_DOC_TYPES]);
  });

  // permission กับ licenseFeature ของสามใบนี้ **ไม่เท่ากัน** โดยตั้งใจ:
  //
  // - permission เป็นคีย์ของประเภทตัวเอง เพราะ `SUB_PATH_RESOURCE_MAP['config:workflows']`
  //   ฝั่ง backend แตก `GET /workflows/<type>` เป็น `system_admin.workflow.<type>` จริง
  //   (swagger ของ config_workflows.controller เขียนไว้เองว่าแต่ละประเภทให้สิทธิ์แยกกันได้)
  //   ส่วนการ **เขียน** ตกมาที่คีย์แม่ทั้งหมด — จึงคุมที่แม่ ไม่ใช่ที่นี่
  // - licenseFeature ยังเป็นของแม่ เพราะ BU ที่ซื้อ `system_admin.workflow` วันนี้ยังไม่ถูก
  //   assign คีย์ลูก การเปลี่ยนไปผูกคีย์ลูกจะล็อกหน้าทันทีที่ deploy (LICENSE_ENFORCEMENT
  //   เปิดอยู่ทุก environment)
  it("เมนูชนิดเอกสารถือ permission ของประเภทตัวเอง แต่ยังใช้ license feature ของตัวแม่", () => {
    expect(docTypeChildren.map((s) => s.permission)).toEqual([
      "system_admin.workflow.purchase_request.view",
      "system_admin.workflow.purchase_order.view",
      "system_admin.workflow.store_requisition.view",
      // JV ยังไม่มีคีย์ลูกของตัวเอง — ใช้คีย์แม่ (ที่มีอยู่จริงใน DB) จนกว่า backend จะเพิ่มคีย์ลูก
      "system_admin.workflow.view",
    ]);
    for (const s of docTypeChildren) {
      expect(s.licenseFeature).toBe(workflow?.licenseFeature);
    }
  });

  // ตัวที่ไม่ใช่ชนิดเอกสารต้องระบุชื่อไว้ตรง ๆ — ไม่งั้นช่องนี้กลายเป็นที่ทิ้งของ
  // ที่ใครเพิ่มอะไรก็ได้แล้วเทสต์ไม่รู้เรื่อง ส่วน licenseFeature ต้อง **ไม่**
  // เท่าของแม่ เพราะมันเป็นฟีเจอร์คนละตัวที่ backend ขายแยก
  it("ตัวที่ไม่ใช่ชนิดเอกสารมีแค่คลังข้อความแจ้งเตือน และถือ license feature ของตัวเอง", () => {
    expect(guestChildren.map((s) => s.name)).toEqual(["notificationTemplate"]);
    for (const s of guestChildren) {
      expect(s.licenseFeature).not.toBe(workflow?.licenseFeature);
    }
  });

  it("ทุกชื่อเมนูมีคำแปลทั้ง th และ en", () => {
    for (const s of workflow?.subModules ?? []) {
      expect(
        (th.modules as Record<string, string>)[s.name],
        s.name,
      ).toBeTruthy();
      expect(
        (en.modules as Record<string, string>)[s.name],
        s.name,
      ).toBeTruthy();
    }
  });
});

describe("endpoint ของแต่ละชนิด", () => {
  it("path ที่ยิงจริงตรงกับที่ backend เปิดไว้", () => {
    // ผูกกับสตริงเต็ม ๆ ไม่ใช่แค่ slug — ย้ายโฟลเดอร์ config/ ไปที่อื่นแล้ว
    // เทสต์ต้องแดง ไม่ใช่ปล่อยให้ไปเจอ 404 ตอนกดเมนู
    expect(API_ENDPOINTS.WORKFLOWS_BY_DOC_TYPE("BU1", "purchase-request")).toBe(
      "/api/proxy/api/config/BU1/workflows/purchase-request",
    );
    for (const slug of WORKFLOW_DOC_TYPES) {
      expect(API_ENDPOINTS.WORKFLOWS_BY_DOC_TYPE("BU1", slug)).toBe(
        `/api/proxy/api/config/BU1/workflows/${slug}`,
      );
    }
  });

  it("ทุกชนิดมี list hook ของตัวเอง", () => {
    for (const slug of WORKFLOW_DOC_TYPES) {
      expect(WORKFLOW_LIST_HOOKS[slug], slug).toBeTypeOf("function");
    }
  });
});
