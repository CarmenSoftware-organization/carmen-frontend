/**
 * pageKey ของ saved list views — เป็น identity ถาวรต่อหน้า
 * ห้ามผูกกับ route path / i18n namespace (rename ได้โดย view ผู้ใช้ไม่หาย)
 * ห้ามเปลี่ยนค่าที่ ship แล้ว — จะทำให้ view ที่บันทึกไว้หายทั้งลูกค้า
 */
export const LIST_PAGE_KEYS = {
  // config
  ADJUSTMENT_TYPE: "adjustment_type",
  BUSINESS_TYPE: "business_type",
  CERTIFICATION: "certification",
  CREDIT_NOTE_REASON: "credit_note_reason",
  CHART_OF_ACCOUNT: "chart_of_account",
  CHART_OF_ACCOUNT_MAPPING: "chart_of_account_mapping",
  COST_CENTER: "cost_center",
  COST_CENTER_GROUP: "cost_center_group",
  CREDIT_TERM: "credit_term",
  CURRENCY: "currency",
  DELIVERY_POINT: "delivery_point",
  DEPARTMENT: "department",
  ECO: "eco",
  EXCHANGE_RATE: "exchange_rate",
  EXTRA_COST: "extra_cost",
  LOCATION: "location",
  SHELF: "shelf",
  TAX_PROFILE: "tax_profile",
  UNIT: "unit",
  // inventory-management
  INVENTORY_ADJUSTMENT: "inventory_adjustment",
  PHYSICAL_COUNT: "physical_count",
  SPOT_CHECK: "spot_check",
  INVENTORY_TRANSACTION: "inventory_transaction",
  // operation-plan
  RECIPE: "recipe",
  RECIPE_CATEGORY: "recipe_category",
  CUISINE: "cuisine",
  EQUIPMENT: "equipment",
  EQUIPMENT_CATEGORY: "equipment_category",
  RECIPE_EQUIPMENT_CATEGORY: "recipe_equipment_category",
  // procurement
  PURCHASE_REQUEST: "pr",
  PURCHASE_ORDER: "po",
  GOODS_RECEIVE_NOTE: "grn",
  CREDIT_NOTE: "cn",
  PURCHASE_REQUEST_TEMPLATE: "prt",
  APPROVAL: "approval",
  // product-management
  PRODUCT: "product",
  // report
  REPORT_LIST: "report_list",
  REPORT_HISTORY: "report_history",
  // store-operation
  STORE_REQUISITION: "sr",
  WASTAGE_REPORTING: "wastage",
  // system-admin
  USER: "user",
  ROLE: "role",
  WORKFLOW: "workflow",
  DOCUMENT: "document",
  PERIOD: "period",
  RUNNING_CODE: "running_code",
  NOTIFICATION_TEMPLATE: "notification_template",
  ACTIVITY_LOG: "activity_log",
  USER_ACTIVITY: "user_activity",
  // vendor-management
  VENDOR: "vendor",
  PRICE_LIST: "price_list",
  PRICE_LIST_TEMPLATE: "price_list_template",
  REQUEST_PRICE_LIST: "rfp",
} as const;

export type ListPageKey = (typeof LIST_PAGE_KEYS)[keyof typeof LIST_PAGE_KEYS];
