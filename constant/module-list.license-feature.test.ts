import { describe, it, expect } from "vitest";
import { findRouteLeaf, moduleList, type ModuleDto } from "./module-list";
import { licenseFeatureOf } from "@/hooks/use-license";
import {
  LICENSE_FEATURE_KEYS,
  LICENSE_MODULE_KEYS,
} from "./__fixtures__/license-catalog";

/**
 * เทสต์กันการกลับมาของบั๊ก "FE คิด feature key เองแล้วไม่ตรง catalog ของ backend"
 *
 * ก่อนหน้านี้ FE คำนวณ key จาก `permission` อย่างเดียวโดยเชื่อว่า namespace ของ
 * permission กับของ license feature เป็นตัวเดียวกัน — ซึ่งผิด ผลคือ key อย่าง
 * `report_analytics`, `system_configuration`, `product_management.unit`,
 * `configuration.extra_cost` ไม่มีอยู่ใน catalog เลย พอเปิด `LICENSE_ENFORCEMENT`
 * หน้าเหล่านั้นจะถูกล็อก **ถาวร** และเพราะ license ไม่มี admin bypass จึงไม่มีใคร
 * ในระบบเข้าไปแก้ได้ (รวมถึงคนที่ต้องเข้า System Admin ไปแก้ปัญหา)
 *
 * เทสต์นี้ไล่ทุก leaf ใน `moduleList` แล้วยืนยันว่า key ที่ระบบผลิตได้มีอยู่จริงใน
 * สำเนา catalog (`__fixtures__/license-catalog.ts`) — leaf ใหม่ที่ map ผิดจะแดงทันที
 */

function leaves(mods: ModuleDto[] = moduleList): ModuleDto[] {
  return mods.flatMap((m) =>
    m.subModules && m.subModules.length > 0 ? leaves(m.subModules) : [m],
  );
}

/**
 * leaf ที่ตั้งใจไม่ map เข้า license — ต้องมีเหตุผลเป็นข้อ ๆ ไม่ใช่ "ยังไม่ได้ทำ"
 *
 * ทุกตัวในนี้ backend เองก็ไม่ตัดสิน license ให้ (endpoint ของมันไม่แมตช์
 * `LICENSE_ROUTE_FEATURES` → `resolveRouteFeature` คืน `null` = นอกขอบเขต ผ่านเสมอ)
 * การ map มั่วจึงล็อกหน้าที่ backend ไม่เคยบล็อก ซึ่งแย่กว่าไม่ map
 *
 * **ตอนนี้ว่าง** — เดิมมี 11 รายการ (`/procurement/approval`, `/config/chart-of-accounts`,
 * `/config/chart-of-account-mapping` และ `/accounting/*` ทั้งกลุ่ม) ซึ่งกลายเป็นรูโหว่จริงบนหน้าจอ:
 * leaf ที่ผลิต key ไม่ได้จะ `locked: false` เสมอ และเพราะ parent locked ก็ต่อเมื่อลูก locked
 * หมด ลูกที่หลุดตัวเดียวจึงปลดล็อกหัวข้อทั้งโมดูล — BU ที่ไม่มี license เลยยังเห็น
 * Procurement / Config / Accounting เป็นเมนูใช้งานได้ ทั้งสามจึงถูกผูกคีย์แล้ว โดยใช้
 * **ชื่อคีย์จาก catalog ตรง ๆ เท่านั้น** ไม่มีการเดา: ตัวที่ catalog ไม่มีคีย์ระดับ resource
 * (`/procurement/approval`) ผูกคีย์ระดับ module ตามกติกาเดิมของ `/config/shelf` →
 * `"configuration"` ส่วน `/config/chart-of-account-mapping` ได้คีย์ระดับ resource ของ
 * ตัวเองแล้ว (`configuration.chart_of_account_mapping` — คีย์ปกติของ catalog ที่มาจาก
 * permission seed และผูก route `app:account-mapping` ใน permission.route-map ของ backend
 * ไม่ได้มาจาก `LICENSE_ONLY_RESOURCES` แล้ว)
 *
 * เพิ่มรายการใหม่ได้ แต่ต้องเขียนเหตุผลว่าทำไม catalog ถึงไม่มีคีย์ให้ผูก และต้องรู้ว่า
 * มันปลดล็อกหัวข้อโมดูลทั้งก้อนไปด้วย
 */
const UNMAPPED_ON_PURPOSE: ReadonlyArray<{ path: string; why: string }> = [
  // /accounting/* ทั้งกลุ่ม: ยังเป็นหน้า mock ไม่เรียก API สักตัว และ catalog ของ
  // backend ไม่มี module `accounting` เลย → อยู่นอกขอบเขต license ทั้งหมด
  { path: "/accounting", why: "accounting ยังไม่มีใน catalog" },
  { path: "/accounting/journal-voucher", why: "accounting ยังไม่มีใน catalog" },
  {
    path: "/accounting/template-voucher",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/recurring-voucher",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/allocation-voucher",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/accounts-payable",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/accounts-payable/invoice",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/accounts-payable/payment",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/accounts-receivable/invoice",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/accounts-receivable/receipt",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/accounts-receivable",
    why: "accounting ยังไม่มีใน catalog",
  },
  { path: "/accounting/asset", why: "accounting ยังไม่มีใน catalog" },
  {
    path: "/accounting/asset/register",
    why: "accounting ยังไม่มีใน catalog",
  },
  {
    path: "/accounting/asset/disposal",
    why: "accounting ยังไม่มีใน catalog",
  },
];

const unmappedPaths = new Set(UNMAPPED_ON_PURPOSE.map((e) => e.path));

describe("moduleList → license feature key", () => {
  it("ทุก leaf ที่ระบบผลิต key ได้ ต้องเป็น key ที่มีอยู่จริงใน catalog ของ backend", () => {
    const unknown = leaves()
      .map((leaf) => ({ path: leaf.path, feature: licenseFeatureOf(leaf) }))
      .filter(
        (x) =>
          x.feature !== undefined && !LICENSE_FEATURE_KEYS.includes(x.feature),
      );

    expect(unknown).toEqual([]);
  });

  it("module ของทุก key ต้องมีใน catalog ด้วย (backend ต้องเจอทั้ง feature และ module)", () => {
    const badModule = leaves()
      .map((leaf) => licenseFeatureOf(leaf))
      .filter((f): f is string => f !== undefined)
      .map((f) => {
        const dot = f.indexOf(".");
        return { feature: f, module: dot === -1 ? f : f.slice(0, dot) };
      })
      .filter((x) => !LICENSE_MODULE_KEYS.includes(x.module));

    expect(badModule).toEqual([]);
  });

  it("leaf ที่ผลิต key ไม่ได้เลย ต้องอยู่ใน allowlist ที่มีเหตุผลกำกับ", () => {
    const unmapped = leaves()
      .filter((leaf) => licenseFeatureOf(leaf) === undefined)
      .map((leaf) => leaf.path)
      .filter((path) => !unmappedPaths.has(path));

    expect(unmapped).toEqual([]);
  });

  it("allowlist ต้องไม่มีของค้าง — ทุก path ในนั้นต้องยังเป็น leaf ที่ยังไม่ map จริง", () => {
    const stale = UNMAPPED_ON_PURPOSE.map((e) => e.path).filter((path) => {
      const leaf = leaves().find((l) => l.path === path);
      return !leaf || licenseFeatureOf(leaf) !== undefined;
    });

    expect(stale).toEqual([]);
  });

  it("จับ regression ของ key ที่เคยพังจริงทั้ง 4 กลุ่ม", () => {
    // ใช้ findRouteLeaf ตัวเดียวกับที่ RouteGuard ใช้จริง ไม่ใช่ตัวเก็บ leaf ของ
    // เทสต์เอง — โหนดที่เป็นทั้งหน้าและมีเมนูย่อย (เช่น workflow) ไม่ใช่ leaf
    // ในสายตาตัวเก็บ แต่ RouteGuard ยังต้องหา feature ของมันเจอ
    const featureOf = (path: string) => {
      const leaf = findRouteLeaf(path);
      if (!leaf) throw new Error(`leaf not found: ${path}`);
      return licenseFeatureOf(leaf);
    };

    // เคยได้ "report_analytics" ซึ่งไม่มีใน catalog → ล็อกโมดูล Report ทั้งโมดูล
    expect(featureOf("/report/list")).toBe("report.list");
    // เคยได้ "system_configuration" → ล็อก System Admin ทั้ง 13 leaf
    expect(featureOf("/system-admin/user")).toBe("system_admin.user");
    expect(featureOf("/system-admin/workflow")).toBe("system_admin.workflow");
    // เคยได้ "product_management.unit" ซึ่ง license เรียก "configuration.unit"
    expect(featureOf("/config/unit")).toBe("configuration.unit");
    // เคยได้ "configuration.extra_cost" แต่ catalog สะกดว่า extra_cost_type
    expect(featureOf("/config/extra-cost")).toBe(
      "configuration.extra_cost_type",
    );
  });

  it("leaf ที่ไม่มี permission แต่ backend ตรวจ license ให้ ต้องถูก map แล้ว (กันโมดัลเด้งซ้ำจาก 403)", () => {
    const byPath = (path: string) => leaves().find((l) => l.path === path);

    for (const [path, feature] of [
      ["/procurement/purchase-request", "procurement.purchase_request"],
      ["/procurement/purchase-order", "procurement.purchase_order"],
      [
        "/store-operation/store-requisition",
        "store_operations.store_requisition",
      ],
    ] as const) {
      const leaf = byPath(path);
      expect(leaf?.permission).toBeUndefined();
      expect(licenseFeatureOf(leaf!)).toBe(feature);
    }
  });
});
