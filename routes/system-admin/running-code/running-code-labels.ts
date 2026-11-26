/**
 * ชื่อเอกสารแบบคนอ่านของ running code type ที่ backend ใส่ให้ (preset ใน
 * `micro-business/.../running-code.const.ts` + JOURNAL-VOUCHER)
 *
 * type เป็น key ของเครื่อง — แอดมินไม่ควรต้องแปล `ACCOUNTS-RECEIVABLE-RECEIPT`
 * ในหัวเองว่าคือ "AR Receipt" · type ที่ไม่อยู่ในนี้ (แอดมินเพิ่มเอง หรือ preset
 * ใหม่ที่ยังไม่มีชื่อ) ผู้เรียกโชว์ key ดิบแทน — ไม่เดาชื่อ
 *
 * ค่าคือคีย์ใต้ `systemAdmin.runningCode.typeLabel` ในไฟล์แปล
 */
const TYPE_LABEL_KEY: Readonly<Record<string, string>> = {
  "ACCOUNTS-PAYABLE-CREDIT-NOTE": "apCreditNote",
  "ACCOUNTS-PAYABLE-DEBIT-NOTE": "apDebitNote",
  "ACCOUNTS-PAYABLE-DEPOSIT": "apDeposit",
  "ACCOUNTS-PAYABLE-INVOICE": "apInvoice",
  "ACCOUNTS-PAYABLE-PAYMENT": "apPayment",
  "ACCOUNTS-RECEIVABLE-CREDIT-NOTE": "arCreditNote",
  "ACCOUNTS-RECEIVABLE-DEBIT-NOTE": "arDebitNote",
  "ACCOUNTS-RECEIVABLE-INVOICE": "arInvoice",
  "ACCOUNTS-RECEIVABLE-RECEIPT": "arReceipt",
  "ASSET-DISPOSAL": "assetDisposal",
  "ASSET-REGISTER": "assetRegister",
  "CREDIT-NOTE": "creditNote",
  "GOOD-RECEIVED-NOTE": "goodReceivedNote",
  "JOURNAL-VOUCHER": "journalVoucher",
  "PHYSICAL-COUNT": "physicalCount",
  "PRICE-LIST": "priceList",
  PRODUCT: "product",
  "PRODUCT-CAT": "productCategory",
  "PRODUCT-ITEM-GROUP": "productItemGroup",
  "PRODUCT-SUB-CAT": "productSubCategory",
  "PURCHASE-ORDER": "purchaseOrder",
  "PURCHASE-REQUEST": "purchaseRequest",
  "SPOT-CHECK": "spotCheck",
  "STOCK-IN": "stockIn",
  "STOCK-OUT": "stockOut",
  "STORE-REQUISITION": "storeRequisition",
  "TAX-INVOICE": "taxInvoice",
  "TAX-INVOICE-CREDIT-NOTE": "taxInvoiceCreditNote",
  "TAX-INVOICE-DEBIT-NOTE": "taxInvoiceDebitNote",
  "TAX-INVOICE-RECEIPT": "taxInvoiceReceipt",
};

/** คีย์แปลของ type หรือ `null` ถ้าไม่รู้จัก (ผู้เรียกโชว์ key ดิบ) */
export function typeLabelKey(type: string | undefined | null): string | null {
  return (type && TYPE_LABEL_KEY[type]) || null;
}

/**
 * note ที่ backend เขียนให้ทุกแถวตอนกด Init — เหมือนกันทุกแถวจึงไม่บอกอะไร
 * ตารางโชว์เป็น "—" เหมือนค่าว่าง ให้เห็นเฉพาะ note ที่คนเขียนเอง (dialog ยังโชว์
 * ค่าจริง ไม่ได้ลบทิ้ง)
 */
const SYSTEM_DEFAULT_NOTE = "initialized by system default.";

export function isDefaultNote(note: string | undefined | null): boolean {
  return note?.trim().toLowerCase() === SYSTEM_DEFAULT_NOTE;
}
