/**
 * แผนที่ `reference_type` ที่ backend ผูกไว้กับไฟล์ → key ใต้ namespace `modules` ของ i18n
 *
 * ครอบ 31 ค่าจาก 39 ค่าที่ backend ใช้จริง (สแกนจาก carmen-turborepo-backend)
 * ที่เหลืออีก 8 ค่ามี key ของตัวเองที่เพิ่มเข้าไปพร้อมกัน
 */
export const DOCUMENT_REFERENCE_MODULE_KEY: Record<string, string> = {
  config_running_code: "runningCode",
  credit_note: "creditNote",
  credit_term: "creditTerm",
  currency: "currency",
  delivery_point: "deliveryPoint",
  department: "department",
  dimension: "dimension",
  exchange_rate: "exchangeRate",
  extra_cost: "extraCost",
  good_received_note: "goodsReceiveNote",
  location: "storeLocation",
  news: "news",
  period: "period",
  physical_count: "physicalCount",
  physical_count_period: "physicalCountPeriod",
  pricelist: "priceList",
  pricelist_template: "priceListTemplate",
  product: "product",
  product_category: "productCategory",
  product_item_group: "productItemGroup",
  product_master_eco_label: "eco",
  product_sub_category: "productSubCategory",
  purchase_order: "purchaseOrder",
  purchase_request: "purchaseRequest",
  purchase_request_template: "purchaseRequestTemplate",
  recipe: "operationRecipe",
  recipe_equipment: "operationEquipment",
  recipe_preparation_step: "recipePreparationStep",
  request_for_pricing: "requestPriceList",
  spot_check: "spotCheck",
  stock_in: "stockIn",
  stock_out: "stockOut",
  store_requisition: "storeRequisition",
  tax_profile: "taxProfile",
  unit: "unit",
  vendor: "vendor",
  vendor_business_type: "businessType",
  vendor_master_certificate: "certification",
  workflow: "workflow",
};

type TFn = (key: string) => string;

/**
 * แปลง `reference_type` เป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง
 *
 * ค่าที่ยังไม่มีในแผนที่จะถูกคืนเป็น**สตริงดิบตามจริง** ไม่ยุบเป็น "อื่น ๆ" — หน้านี้เป็น
 * เครื่องมือของผู้ดูแลระบบ การเห็นถังที่ระบบยังไม่รู้จักคือข้อมูลที่มีค่า และทำให้
 * reference_type ใหม่ที่ backend เพิ่มเข้ามาโผล่เองโดยไม่ต้อง release frontend
 *
 * @param referenceType - ค่าจาก backend (`null` = ไฟล์ที่อัปโหลดจากหน้า Document โดยตรง)
 * @param tModules - ตัวแปลของ namespace `modules` (ได้จาก `useTranslations("modules")`)
 * @param directUploadLabel - ข้อความสำหรับไฟล์ที่ไม่มี `reference_type`
 * @returns ข้อความที่พร้อมแสดงผล
 * @example
 * documentReferenceLabel("purchase_request", tm, "อัปโหลดโดยตรง"); // "ใบขอซื้อ"
 * documentReferenceLabel(null, tm, "อัปโหลดโดยตรง");              // "อัปโหลดโดยตรง"
 * documentReferenceLabel("brand_new_thing", tm, "…");             // "brand_new_thing"
 */
export function documentReferenceLabel(
  referenceType: string | null,
  tModules: TFn,
  directUploadLabel: string,
): string {
  if (!referenceType) return directUploadLabel;
  const key = DOCUMENT_REFERENCE_MODULE_KEY[referenceType];
  return key ? tModules(key) : referenceType;
}
