/**
 * Permission keys catalog — mirror ของ BE `/permissions` endpoint
 *
 * Pattern: `{namespace}.{resource}.{action}` หรือ `{namespace}.{action}` (top-level)
 *
 * ใช้งาน:
 * - แทน string literal เพื่อให้ IDE autocomplete + จับ typo
 * - `useCan().can(PERMISSIONS.configuration.department.view)`
 * - `<ModuleDto>.permission` ใน module-list ใช้ reference จาก PERMISSIONS
 * - Dynamic build ใช้ `buildPermissionKey(prefix, action)` (cast เป็น Permission ภายใน)
 *
 * พบ permission ใหม่ใน BE catalog → เพิ่มที่ไฟล์นี้
 */

function crud<P extends string>(prefix: P) {
  return {
    view: `${prefix}.view`,
    create: `${prefix}.create`,
    update: `${prefix}.update`,
    delete: `${prefix}.delete`,
  } as const;
}

function viewOnly<P extends string>(prefix: P) {
  return { view: `${prefix}.view` } as const;
}

export const PERMISSIONS = {
  configuration: {
    view: "configuration.view",
    adjustment_type: crud("configuration.adjustment_type"),
    business_type: crud("configuration.business_type"),
    cost_center: crud("configuration.cost_center"),
    cost_center_group: crud("configuration.cost_center_group"),
    credit_note_reason: crud("configuration.credit_note_reason"),
    credit_term: crud("configuration.credit_term"),
    currency: crud("configuration.currency"),
    delivery_point: crud("configuration.delivery_point"),
    department: crud("configuration.department"),
    exchange_rate: crud("configuration.exchange_rate"),
    // backend สะกดว่า `extra_cost_type` (คีย์ `configuration.extra_cost` เป็นของ
    // โมดูล Procurement คนละตัวกัน) — ตรงกับ licenseFeature ของ leaf อยู่แล้ว
    extra_cost_type: crud("configuration.extra_cost_type"),
    location: crud("configuration.location"),
    // backend สะกดว่า `location_shelf` ทั้งฝั่ง permission และ license — คอมเมนต์เดิม
    // ที่ว่า "backend ยังไม่ seed" ไม่จริง คีย์มีอยู่ใน tb_permission ครบทั้ง 4 action
    location_shelf: crud("configuration.location_shelf"),
    /** license เรียกคีย์นี้เหมือนกัน — leaf `/config/unit` ระบุ licenseFeature ไว้แล้ว */
    unit: crud("configuration.unit"),
    notification_template: crud("configuration.notification_template"),
    tax_profile: crud("configuration.tax_profile"),
  },
  // คีย์ระดับ module (`<namespace>.view`) มีอยู่จริงใน tb_permission แต่ API ของแต่ละหน้า
  // ตรวจคีย์ระดับ resource — ห้ามเอาคีย์ระดับ module ไปคุม leaf ใน module-list
  // (ดู module-list.permission.test.ts)
  product_management: {
    view: "product_management.view",
    product: crud("product_management.product"),
    category: crud("product_management.category"),
    /** หน้า /product-management/eco ใช้ endpoint product-master-eco-labels */
    master_eco_label: crud("product_management.master_eco_label"),
  },
  vendor_management: {
    view: "vendor_management.view",
    vendor: crud("vendor_management.vendor"),
    price_list: crud("vendor_management.price_list"),
    price_list_template: crud("vendor_management.price_list_template"),
    request_price_list: crud("vendor_management.request_price_list"),
    vendor_master_certificate: crud(
      "vendor_management.vendor_master_certificate",
    ),
  },
  procurement: {
    view: "procurement.view",
    purchase_request: {
      view: "procurement.purchase_request.view",
      view_department: "procurement.purchase_request.view_department",
      view_all: "procurement.purchase_request.view_all",
    },
    purchase_request_template: crud("procurement.purchase_request_template"),
    purchase_order: viewOnly("procurement.purchase_order"),
    goods_received_note: {
      view: "procurement.goods_received_note.view",
      create: "procurement.goods_received_note.create",
      update: "procurement.goods_received_note.update",
      delete: "procurement.goods_received_note.delete",
      commit: "procurement.goods_received_note.commit",
    },
    credit_note: crud("procurement.credit_note"),
  },
  inventory_management: {
    view: "inventory_management.view",
    inventory_adjustment: crud("inventory_management.inventory_adjustment"),
    transaction: {
      view: "inventory_management.transaction.view",
      create: "inventory_management.transaction.create",
    },
    stock_in: crud("inventory_management.stock_in"),
    stock_out: crud("inventory_management.stock_out"),
    // SR ของจริงอยู่ใน namespace `store_operations` ด้านล่าง — สำเนาที่เคยอยู่ตรงนี้
    // ไม่มีแถวใน tb_permission เลย และไม่มี call site ไหนเรียก
    physical_count: crud("inventory_management.physical_count"),
    spot_check: crud("inventory_management.spot_check"),
    period_end: {
      view: "inventory_management.period_end.view",
      execute: "inventory_management.period_end.execute",
    },
  },
  store_operations: {
    view: "store_operations.view",
    store_requisition: {
      view: "store_operations.store_requisition.view",
      view_department: "store_operations.store_requisition.view_department",
      view_all: "store_operations.store_requisition.view_all",
    },
  },
  /**
   * System Admin — คีย์ทุกตัวในบล็อกนี้ยืนยันแล้วว่ามีแถวจริงใน
   * `CARMEN_SYSTEM.tb_permission` ของ backend (ตรวจ 2026-09-21)
   *
   * ก่อนหน้านี้ทุกหน้าใต้ `/system-admin` ใช้ `system_configuration.view` ร่วมกัน
   * ตัวเดียว ซึ่ง **ไม่มีอยู่ใน permission catalog ของ backend เลย** (0 แถวจาก 301)
   * ผลคือ non-admin ถูก `denied` ทุกหน้าโดยไม่มีทางแก้ที่หน้า Role และ admin ไม่เห็น
   * ปัญหาเพราะ `useCan()` bypass ให้อยู่แล้ว — อย่าเพิ่มคีย์ที่ไม่ได้มาจาก
   * `seed.permission.data.ts` กลับเข้ามาอีก
   *
   * `business_unit` / `config_email` / `user_activity` ถูกทำเครื่องหมาย
   * `PLANNED_RESOURCES` ฝั่ง backend (ยังไม่มี endpoint รองรับ) แต่ seed เข้า DB แล้วจริง
   * จึงติ๊กที่หน้า Role ได้ตามปกติ — เครื่องหมายนั้นไม่ได้กันการ seed
   */
  system_admin: {
    view: "system_admin.view",
    /** Company Profile + Default Setting — ทั้งคู่ยิง `/api/business-units` */
    business_unit: {
      view: "system_admin.business_unit.view",
      update: "system_admin.business_unit.update",
    },
    inventory_period: crud("system_admin.inventory_period"),
    workflow: {
      ...crud("system_admin.workflow"),
      purchase_request: viewOnly("system_admin.workflow.purchase_request"),
      purchase_order: viewOnly("system_admin.workflow.purchase_order"),
      store_requisition: viewOnly("system_admin.workflow.store_requisition"),
    },
    /** Email Profile + Email Template — ตั้งค่าอีเมลย้ายไปอยู่ใต้ `config/app-config` */
    config_email: {
      view: "system_admin.config_email.view",
      update: "system_admin.config_email.update",
    },
    /** API key ขาเข้าของ BU (หน้า Interface → Accounting → External) — GET = view, ที่เหลือรวม reveal = update */
    bu_api_key: {
      view: "system_admin.bu_api_key.view",
      update: "system_admin.bu_api_key.update",
    },
    role: crud("system_admin.role"),
    user: crud("system_admin.user"),
    running_code: crud("system_admin.running_code"),
    document: crud("system_admin.document"),
    user_activity: viewOnly("system_admin.user_activity"),
    activity_log: {
      view: "system_admin.activity_log.view",
      delete: "system_admin.activity_log.delete",
    },
  },
  /**
   * Dashboard — เดิมไฟล์นี้สะกด namespace นี้ว่า `widget.*` ซึ่งไม่มีอยู่ใน catalog
   * ของ backend เลย (0 แถวใน `tb_permission`) backend เรียกว่า `dashboard.widget`
   * ส่วน `widget.dashboard.manage_bu` ไม่มีที่มาทั้งใน tenant และ platform seed
   * จึงถูกลบทิ้ง ไม่ใช่ย้าย
   *
   * ไม่มี call site ไหนเคยเรียกคีย์ชุดเก่า จึงไม่มีพฤติกรรมไหนเปลี่ยน — leaf
   * `/dashboard` คุมด้วย license `dashboard.widget` อย่างเดียวเหมือนเดิม
   */
  dashboard: {
    view: "dashboard.view",
    widget: crud("dashboard.widget"),
    bu_widget: crud("dashboard.bu_widget"),
    /** resource ของ `app:datasets` / `app:dashboard-lab` ใน route map */
    dataset: {
      view: "dashboard.dataset.view",
      create: "dashboard.dataset.create",
    },
  },
  /**
   * backend ไม่มี namespace `report_analytics` — คีย์จริงคือ `report.*` และแยกราย
   * หน้าตาม `SUB_PATH_RESOURCE_MAP['app:reports']` (history / schedules / ที่เหลือ)
   */
  report: {
    view: "report.view",
    list: {
      view: "report.list.view",
      create: "report.list.create",
    },
    schedule: crud("report.schedule"),
    history: viewOnly("report.history"),
  },
  operation_plan: {
    view: "operation_plan.view",
    recipe: crud("operation_plan.recipe"),
    category: crud("operation_plan.category"),
    cuisine: crud("operation_plan.cuisine"),
    equipment: crud("operation_plan.equipment"),
    equipment_category: crud("operation_plan.equipment_category"),
  },
} as const;

type Leaves<T> = T extends string
  ? T
  : T extends object
    ? { [K in keyof T]: Leaves<T[K]> }[keyof T]
    : never;

export type Permission = Leaves<typeof PERMISSIONS>;

export type PermissionAction = "view" | "create" | "update" | "delete";

/**
 * สร้าง permission key จาก prefix แบบ dynamic (เช่นใน ConfigListTemplate
 * ที่รับ permissionPrefix prop)
 *
 * Cast เป็น `Permission` ภายในเพื่อให้ caller ไม่ต้อง cast เอง
 * (ความถูกต้องของ key ขึ้นกับ caller ส่ง prefix ที่ตรงกับ BE)
 *
 * @example
 * buildPermissionKey("configuration.department", "create")
 * // → "configuration.department.create" (typed as Permission)
 */
export function buildPermissionKey(
  prefix: string,
  action: PermissionAction,
): Permission {
  return `${prefix}.${action}` as Permission;
}

function collectPermissionKeys(node: unknown, out: Set<string>): void {
  if (typeof node === "string") {
    out.add(node);
    return;
  }
  if (node && typeof node === "object")
    for (const value of Object.values(node)) collectPermissionKeys(value, out);
}

const permissionKeys = new Set<string>();
collectPermissionKeys(PERMISSIONS, permissionKeys);

/** ทุก key ที่ประกาศใน `PERMISSIONS` — ใช้กันการ gate ด้วย key ผีที่ประกอบจาก prefix */
export const PERMISSION_KEYS: ReadonlySet<string> = permissionKeys;

/**
 * key ที่ประกอบแบบ dynamic (`buildPermissionKey`) อยู่ใน catalog จริงไหม — prefix ของ
 * leaf ที่ใช้ permission ระดับโมดูล (`operation_plan.view` → `operation_plan.update`)
 * ประกอบได้ key ที่ไม่มีทั้งในไฟล์นี้และใน tb_permission; gate ด้วย key แบบนั้น =
 * non-admin โดน denied ทุกคนโดย admin ไม่เห็น (bypass)
 */
export function isKnownPermission(key: string): key is Permission {
  return PERMISSION_KEYS.has(key);
}
