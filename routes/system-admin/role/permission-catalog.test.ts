import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import {
  CATEGORY_META,
  MODULE_RESOURCE_KEY,
  groupPermissions,
  resourceLabelKeys,
  sortedActions,
  titleCase,
  type PermissionRecord,
} from "./permission-catalog";

const labelOf = (r: { resourceKey: string }) => r.resourceKey;

const perm = (
  resource: string,
  action: string,
  deleted?: boolean,
): PermissionRecord => ({
  id: `${resource}:${action}`,
  resource,
  action,
  audit: deleted ? { deleted: { at: "2026-06-01T00:00:00.000Z" } } : undefined,
});

describe("groupPermissions", () => {
  it("เก็บสิทธิ์ระดับโมดูล (resource ไม่มีจุด) ไว้เป็นแถวแรกของหมวด", () => {
    const groups = groupPermissions(
      [
        perm("procurement.credit_note", "view"),
        perm("procurement", "view"),
        perm("procurement.purchase_order", "view"),
      ],
      labelOf,
    );
    expect(groups).toHaveLength(1);
    const rows = groups[0].resources;
    expect(rows[0].resourceKey).toBe(MODULE_RESOURCE_KEY);
    expect(rows[0].resource).toBe("procurement");
    expect(rows.map((r) => r.resourceKey)).toEqual([
      MODULE_RESOURCE_KEY,
      "credit_note",
      "purchase_order",
    ]);
  });

  it("ทิ้งสิทธิ์ที่ backend ลบไปแล้ว — ปล่อยไว้ = ติ๊กแล้วไม่มีผลอะไร", () => {
    const groups = groupPermissions(
      [
        perm("widget", "view", true),
        perm("widget", "create", true),
        perm("procurement", "view"),
      ],
      labelOf,
    );
    expect(groups.map((g) => g.category)).toEqual(["procurement"]);
  });

  it("ของซ้ำที่ตัวเก่าถูกลบ ต้องได้ id ของตัวที่ยังใช้อยู่", () => {
    const groups = groupPermissions(
      [
        {
          id: "old",
          resource: "system_admin.period",
          action: "update",
          audit: { deleted: { at: "2026-07-07T00:00:00.000Z" } },
        },
        { id: "live", resource: "system_admin.period", action: "update" },
      ],
      labelOf,
    );
    expect(groups[0].resources[0].actions.get("update")).toBe("live");
  });

  it("เรียงหมวดตาม CATEGORY_META ไม่ใช่ตามลำดับที่ API ส่งมา", () => {
    const groups = groupPermissions(
      [
        perm("system_admin.role", "view"),
        perm("configuration.unit", "view"),
        perm("procurement.credit_note", "view"),
      ],
      labelOf,
    );
    expect(groups.map((g) => g.category)).toEqual([
      "procurement",
      "configuration",
      "system_admin",
    ]);
  });

  it("action ที่ไม่รู้จักยังอยู่ครบ แค่ไปต่อท้าย", () => {
    const groups = groupPermissions(
      [
        perm("procurement.goods_received_note", "commit"),
        perm("procurement.goods_received_note", "teleport"),
        perm("procurement.goods_received_note", "view"),
      ],
      labelOf,
    );
    expect(sortedActions(groups[0].resources[0])).toEqual([
      "view",
      "commit",
      "teleport",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* ป้ายชื่อ — ทุก resource ใน catalog ของ backend ต้องมีคำแปล ไม่ใช่ Title Case */
/* ------------------------------------------------------------------ */

/**
 * catalog ปัจจุบันของ backend (`GET /permissions`, 2026-08-31) — resource ทุกตัว
 * ที่มีสิทธิ์ใช้งานอยู่จริง เอาไว้กันหน้าจอตกหล่นเวลา backend เพิ่มของใหม่:
 * เพิ่ม resource แล้วไม่ใส่คำแปล เทสต์นี้แดง
 */
const LIVE_RESOURCES: Record<string, string[]> = {
  configuration: [
    "adjustment_type",
    "app_config",
    "business_type",
    "chart_of_accounts",
    "cost_center",
    "cost_center_group",
    "credit_note_reason",
    "credit_term",
    "currency",
    "delivery_point",
    "department",
    "dimension",
    "exchange_rate",
    "extra_cost_type",
    "location",
    "location_shelf",
    "notification_template",
    "tax_profile",
    "unit",
  ],
  dashboard: ["dataset", "widget"],
  inventory_management: [
    "cost",
    "inventory_adjustment",
    "period_end",
    "physical_count",
    "physical_count_period",
    "spot_check",
    "stock_in",
    "stock_out",
    "transaction",
  ],
  operation_plan: [
    "category",
    "cuisine",
    "equipment",
    "equipment_category",
    "recipe",
  ],
  procurement: [
    "credit_note",
    "extra_cost",
    "goods_received_note",
    "purchase_order",
    "purchase_request",
    "purchase_request_template",
  ],
  product_management: [
    "category",
    "eco_label",
    "item_group",
    "master_eco_label",
    "product",
    "sub_category",
  ],
  report: ["history", "list", "schedule"],
  store_operations: [
    "stock_replenishment",
    "store_requisition",
    "wastage_reporting",
  ],
  system_admin: [
    "activity_log",
    "business_unit",
    "config_email",
    "document",
    "period",
    "role",
    "running_code",
    "user",
    "user_activity",
    "workflow",
  ],
  vendor_management: [
    "price_list",
    "price_list_template",
    "request_price_list",
    "vendor",
    "vendor_certificate",
    "vendor_master_certificate",
    "vendor_product",
  ],
};

const labels = {
  en: en.systemAdmin.role.resources as Record<string, string>,
  th: th.systemAdmin.role.resources as Record<string, string>,
};

describe("ป้ายชื่อ resource", () => {
  for (const [locale, table] of Object.entries(labels)) {
    it(`${locale}: มีคำแปลครบทุก resource ที่ backend มีอยู่`, () => {
      const missing: string[] = [];
      for (const [category, resources] of Object.entries(LIVE_RESOURCES)) {
        for (const resourceKey of resources) {
          const found = resourceLabelKeys(category, resourceKey).some(
            (k) => k in table,
          );
          if (!found) missing.push(`${category}.${resourceKey}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }

  it("category ของสูตรอาหารกับของสินค้าใช้คนละคำ", () => {
    // resourceKey ซ้ำกันทั้งสองหมวด ถ้าไม่มีคีย์เจาะจงหมวดจะได้ป้ายเดียวกัน
    // แล้วคนตั้งสิทธิ์อ่านไม่ออกว่าอันไหนของอะไร
    expect(labels.th.operation_plan_category).not.toBe(
      labels.th.product_management_category,
    );
    expect(resourceLabelKeys("operation_plan", "category")[0]).toBe(
      "operation_plan_category",
    );
  });

  it("ทุกหมวดใน catalog มีไอคอน/ชื่อของตัวเอง", () => {
    for (const category of Object.keys(LIVE_RESOURCES)) {
      expect(CATEGORY_META[category], category).toBeDefined();
    }
  });

  it("ไม่มีคำแปลที่ตายแล้ว (resource ที่ backend ไม่มี)", () => {
    const live = new Set<string>();
    for (const [category, resources] of Object.entries(LIVE_RESOURCES)) {
      for (const r of resources) {
        for (const k of resourceLabelKeys(category, r)) live.add(k);
      }
    }
    // account_code เก็บไว้ตัวเดียว: backend เพิ่งเปลี่ยนไปใช้ chart_of_accounts
    // ระบบที่ยังไม่ได้อัปเดตจะยังส่งคีย์เก่ามา
    live.add("account_code");
    const dead = Object.keys(labels.th).filter((k) => !live.has(k));
    expect(dead).toEqual([]);
  });
});

describe("titleCase", () => {
  it("ใช้เป็นตาข่ายรับ resource ใหม่ที่ยังไม่มีคำแปล", () => {
    expect(titleCase("vendor_master_certificate")).toBe(
      "Vendor Master Certificate",
    );
  });
});
