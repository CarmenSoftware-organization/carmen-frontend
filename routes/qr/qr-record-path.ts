/**
 * QR บนเอกสารที่พิมพ์ใบเดียวชี้มาที่ `/qr/<type>/<id>?bu=<bu_code>` — route กลางที่ไม่เปลี่ยนชื่อ
 * แล้วหน้านี้พาไปหน้าจริงของเอกสาร กระดาษที่พิมพ์ไปแล้วจึงยังสแกนได้แม้วันหลังจะย้ายหรือเปลี่ยนชื่อ route
 * ของหน้าเอกสาร (แก้ที่ตารางนี้ที่เดียว)
 *
 * ชนิดต้องตรงกับฝั่งที่สร้าง QR: `qrLinkTypes` ของ micro-report และ `PrintLinkType` ของ
 * micro-business — ชนิดที่ไม่มีในตารางนี้ = QR ที่หน้าบ้านเปิดไม่ได้
 *
 * SI / SO อยู่หน้าเดียวกัน แยกด้วย `?type=` (ไม่ส่ง type หน้า inventory adjustment จะขึ้น error)
 * ใบปรับปรุงสต๊อก (IA) ไม่มีหน้าของตัวเอง — micro-business ส่ง si / so ตามตารางที่อ่านเจอ
 */
const QR_RECORD_ROUTES: Record<string, (id: string) => string> = {
  pr: (id) => `/procurement/purchase-request/${id}`,
  po: (id) => `/procurement/purchase-order/${id}`,
  grn: (id) => `/procurement/goods-receive-note/${id}`,
  cn: (id) => `/procurement/credit-note/${id}`,
  sr: (id) => `/store-operation/store-requisition/${id}`,
  si: (id) => `/inventory-management/inventory-adjustment/${id}?type=stock-in`,
  so: (id) => `/inventory-management/inventory-adjustment/${id}?type=stock-out`,
  pc: (id) => `/inventory-management/physical-count/${id}`,
  sc: (id) => `/inventory-management/spot-check/${id}`,
  rfp: (id) => `/vendor-management/request-price-list/${id}`,
  vendor: (id) => `/vendor-management/vendor/${id}`,
  recipe: (id) => `/operation-plan/recipe/${id}`,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * path ของหน้าเอกสารที่ QR ชี้ไป
 *
 * @param type - ชนิดลิงก์จาก URL (`pr`, `grn`, `vendor`, …)
 * @param id - UUID ของเอกสาร
 * @returns path หรือ null เมื่อชนิดไม่รู้จัก หรือ id ไม่ใช่ UUID
 */
export function qrRecordPath(
  type: string | undefined,
  id: string | undefined,
): string | null {
  const route = type ? QR_RECORD_ROUTES[type.toLowerCase()] : undefined;
  if (!route || !id || !UUID_RE.test(id)) return null;
  return route(id.toLowerCase());
}
