/**
 * สำเนา feature key ทั้งหมดของ license catalog ฝั่ง backend — **ใช้ในเทสต์เท่านั้น**
 *
 * ไฟล์นี้ถูก **สร้างด้วยสคริปต์ ห้ามแก้ด้วยมือ** — `bun run gen:license-fixture`
 * (อ่านจาก `apps/backend-gateway/src/license/license-catalog.generated.ts` ของ carmen-turborepo-backend-v2 ซึ่งเป็นไฟล์ generated จาก
 * `prisma/permission.route-map.ts` + `prisma/seed.permission.data.ts` อีกที)
 *
 * ## ทำไมต้องมีสำเนาในรีโปนี้
 * FE คำนวณ feature key ของแต่ละหน้าเองจาก `constant/module-list.ts`
 * (`licenseFeature` หรือ `featureKeyOf(permission)`) แต่ **namespace ของ permission
 * กับของ license feature ไม่ใช่ตัวเดียวกัน** — key ที่คำนวณผิดจะทำให้หน้านั้นถูกล็อกถาวร
 * ตอนเปิด `LICENSE_ENFORCEMENT` และ license **ไม่มี admin bypass** จึงไม่มีใครในระบบ
 * เข้าไปแก้ได้เลย `constant/module-list.license-feature.test.ts` ใช้ไฟล์นี้ยืนยันว่า
 * ทุก leaf ผลิต key ที่มีอยู่จริงใน catalog
 *
 * ## เมื่อ backend เพิ่ม/แก้ feature
 * รัน `bun run gen:license-fixture` แล้วดู `git diff` — **คีย์ที่หายไป (`-`) สำคัญกว่า
 * คีย์ที่เพิ่ม** เพราะแปลว่า backend ลบหรือเปลี่ยนชื่อ และถ้า `module-list.ts` ยังชี้ไปคีย์นั้น
 * หน้านั้นจะถูกล็อกถาวรตอนเปิด enforcement
 *
 * ห้ามแก้ไฟล์นี้เพื่อ "ทำให้เทสต์ผ่าน" — ถ้าเทสต์แดง แปลว่า `module-list.ts` ชี้ไป feature
 * ที่ backend ไม่รู้จัก ต้องแก้ที่ `module-list.ts`
 *
 * ขนาด catalog: 112 feature (13 module + 99 resource)
 *
 * **ไม่มีวันที่ในไฟล์นี้โดยตั้งใจ** — เพื่อให้ `bun run gen:license-fixture && git diff --exit-code`
 * เป็นด่านตรวจความสดได้: diff ว่าง = fixture ตรงกับ backend ณ ตอนนั้นจริง
 */

/** feature key ทั้งหมดใน catalog (module + resource) */
export const LICENSE_FEATURE_KEYS: readonly string[] = [
  "accounting",
  "accounting.ap",
  "accounting.ar",
  "accounting.asset",
  "accounting.config",
  "accounting.config.ap",
  "accounting.config.ar",
  "accounting.config.asset",
  "accounting.config.gl",
  "accounting.gl",
  "accounting.gl.budget",
  "accounting.gl.jv_template",
  "ai",
  "ai.mcp",
  "configuration",
  "configuration.adjustment_type",
  "configuration.app_config",
  "configuration.business_type",
  "configuration.chart_of_account_mapping",
  "configuration.chart_of_accounts",
  "configuration.cost_center",
  "configuration.cost_center_group",
  "configuration.credit_note_reason",
  "configuration.credit_term",
  "configuration.currency",
  "configuration.customer",
  "configuration.delivery_point",
  "configuration.department",
  "configuration.dimension",
  "configuration.email_profile",
  "configuration.email_template",
  "configuration.exchange_rate",
  "configuration.extra_cost_type",
  "configuration.location",
  "configuration.location_shelf",
  "configuration.notification_template",
  "configuration.tax_profile",
  "configuration.unit",
  "dashboard",
  "dashboard.dataset",
  "dashboard.widget",
  "interface",
  "interface.accounting",
  "interface.accounting.blueledgers",
  "interface.accounting.carmen_gl",
  "interface.export",
  "interface.export.external",
  "interface.pms",
  "interface.pms.opera",
  "interface.pms.protel",
  "interface.pos",
  "interface.pos.infrasys",
  "interface.pos.micros3700",
  "interface.pos.simphony",
  "interface.pos.square",
  "inventory_management",
  "inventory_management.cost",
  "inventory_management.inventory_adjustment",
  "inventory_management.period_end",
  "inventory_management.physical_count",
  "inventory_management.physical_count_period",
  "inventory_management.spot_check",
  "inventory_management.stock_in",
  "inventory_management.stock_out",
  "inventory_management.transaction",
  "operation_plan",
  "operation_plan.category",
  "operation_plan.cuisine",
  "operation_plan.equipment",
  "operation_plan.equipment_category",
  "operation_plan.recipe",
  "procurement",
  "procurement.credit_note",
  "procurement.extra_cost",
  "procurement.goods_received_note",
  "procurement.purchase_order",
  "procurement.purchase_request",
  "procurement.purchase_request_template",
  "product_management",
  "product_management.category",
  "product_management.eco_label",
  "product_management.item_group",
  "product_management.master_eco_label",
  "product_management.product",
  "product_management.sub_category",
  "report",
  "report.history",
  "report.list",
  "report.schedule",
  "store_operations",
  "store_operations.stock_replenishment",
  "store_operations.store_requisition",
  "store_operations.wastage_reporting",
  "system_admin",
  "system_admin.activity_log",
  "system_admin.document",
  "system_admin.inventory_period",
  "system_admin.role",
  "system_admin.running_code",
  "system_admin.user",
  "system_admin.workflow",
  "system_admin.workflow.purchase_order",
  "system_admin.workflow.purchase_request",
  "system_admin.workflow.store_requisition",
  "vendor_management",
  "vendor_management.price_list",
  "vendor_management.price_list_template",
  "vendor_management.request_price_list",
  "vendor_management.vendor",
  "vendor_management.vendor_certificate",
  "vendor_management.vendor_master_certificate",
  "vendor_management.vendor_product",
];

/** เฉพาะ module-level key (entry ที่ `parent_key: null` ใน catalog) */
export const LICENSE_MODULE_KEYS: readonly string[] = [
  "accounting",
  "ai",
  "configuration",
  "dashboard",
  "interface",
  "inventory_management",
  "operation_plan",
  "procurement",
  "product_management",
  "report",
  "store_operations",
  "system_admin",
  "vendor_management",
];
