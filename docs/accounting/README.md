# Carmen Blue Accounting

เอกสารชุดนี้กำหนดฐานของโมดูล Accounting ที่จะทำงานร่วมกับ Carmen Blue โดยไม่สร้าง master data และ infrastructure ซ้ำโดยไม่จำเป็น

> สถานะ: Phase 1 implementation (dev2) — Foundation และ General Ledger/JV มี backend schema/contract ตามเอกสาร backend แต่ frontend JV ยังใช้ mock repository ที่แยกผ่าน adapter boundary; Accounts Payable มี interactive UI prototype สำหรับ Dashboard, Invoice และ Payment แต่ยังใช้ browser-local mock repository และยังไม่เชื่อม AP backend; migration/runtime integration verification ยังเป็นงานถัดไป

## เอกสาร

สถานะ API เทียบกับ mock ล่าสุด: [Accounting API integration checklist](api-integration-checklist.md)

| เอกสาร                                                                             | เนื้อหา                                                                                                          |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Accounting Foundation](accounting-foundation.md)                                  | ขอบเขต Accounting, shared services, domain model, posting engine, period/currency rules และ integration contract |
| [Accounting Dashboard Framework](specs/accounting-dashboard-framework.md)          | Operational/Management views, role preview, permission, shared states และ drill-down rules                       |
| [General Ledger — Dashboard](specs/general-ledger-dashboard-design.md)             | Posting health, close readiness, financial position และ Cash Forecast                                            |
| [General Ledger — Journal Voucher](specs/general-ledger-journal-voucher-design.md) | Functional design ของ GL/JV รวม Schedule Post และ Auto-Reverse                                                   |
| [General Ledger — Implementation Readiness](specs/general-ledger-implementation-readiness.md) | สถานะ frontend/backend, subledger Accounting Event contract, generated-JV policy, control-account rules และ AP-to-GL reconciliation |
| [Accounts Payable — Module](specs/accounts-payable-design.md)                      | ขอบเขต AP, shared status, dashboard/aging, integration และ delivery slices                                       |
| [Accounts Payable — Implementation Readiness](specs/accounts-payable-implementation-readiness.md) | สถานะ UI ปัจจุบัน, canonical routes, frontend/backend boundary, contract requirements, decision defaults และ delivery checklist |
| [Accounts Payable — Dashboard](specs/accounts-payable-dashboard-design.md)         | Functional design ของ KPI, Aging, Due Date, approval queue, tax exceptions และ drill-down                        |
| [Accounts Receivable — Dashboard](specs/accounts-receivable-dashboard-design.md)   | AR aging, collection queue, DSO, concentration และ expected collections                                          |
| [Asset — Dashboard](specs/asset-dashboard-design.md)                               | Depreciation, reconciliation, NBV, asset mix และ Capex/Disposal forecast                                         |
| [13-Week Cash Forecast](specs/cash-forecast-design.md)                             | Forecast model, scenarios, sources, API contract และ reconciliation                                              |
| [Accounts Payable — Invoice](specs/accounts-payable-invoice-design.md)             | Functional design ของ Invoice, matching, tax, open item และ posting                                              |
| [Accounts Payable — Payment](specs/accounts-payable-payment-design.md)             | Functional design ของ Payment Voucher, WHT/FX, approval, execution และ settlement                                |
| [Phase 1 Runbook](phase1-runbook.md)                                               | ขั้นตอน migration, smoke test และ verification สำหรับ dev2                                                       |
| [Drive UI Specs — Implementation Plan](drive-ui-spec-implementation-plan.md)         | แผนต่อเนื่องและ delta จาก Drive ล่าสุดถึง 2026-09-27 รวม AR FRD v1.07, AP Invoice v4.5.06 และ AP Payment v2.16 |

## ลำดับการส่งมอบ

1. Accounting Foundation — shared master data, Chart of Accounts, periods, dimensions, posting engine และ audit contract
2. General Ledger — Journal Voucher
3. General Ledger — Template/Recurring/Allocation Voucher
4. General Ledger — Trial Balance, Account Ledger และ Financial Statements
5. Accounts Payable
6. Accounts Receivable
7. Fixed Assets

AP, AR และ Fixed Assets ต้องส่งรายการเข้า GL ผ่าน posting contract เดียวกัน ห้ามเขียน journal tables โดยตรง

## Implementation decision (Phase 1)

- Accounting Journal Voucher backend อยู่ใน `apps/micro-business` และเปิดผ่าน `apps/backend-gateway`
- Frontend route หลักคือ `/accounting/journal-voucher`
- Workflow เป็น optional ต่อ BU; เมื่อปิดจะไม่สร้างสถานะ approval ที่ไม่จำเป็น

## ขอบเขตของ repository

Repository นี้เป็น Vite/React SPA และไม่มี application server ดังนั้น:

- UI, route, validation ฝั่งผู้ใช้ และการเรียก API อยู่ใน repository นี้
- การสร้างเลขเอกสาร, approval, posting, scheduled jobs, auto-reversal, period locking และ transaction integrity ต้องทำใน backend
- งาน scheduler ต้องทำแบบ idempotent และใช้ distributed lock ตาม operational pattern ของ Carmen Blue
- Phase 1 ใช้ `micro-business` เป็น owner ของ Accounting backend และ `backend-gateway` เป็น HTTP boundary; การแยก service เป็นการตัดสินใจเชิงสถาปัตยกรรมในอนาคตเมื่อปริมาณงานต้องการ

## หลักการ

- Reuse master data และ infrastructure ที่มีอยู่ เมื่อ semantics ตรงกัน
- Extend service เดิมเมื่อข้อมูลเดิมถูกต้องแต่ยังไม่พอสำหรับบัญชี
- Accounting เป็นเจ้าของ ledger, posting state, rate snapshot และการปิดงวด
- รายการที่ post แล้วแก้ไม่ได้ การแก้ต้องทำผ่าน reversal หรือ adjusting journal
- ทุกยอดต้องอธิบายย้อนกลับถึง source document, ผู้ทำรายการ, approval และ posting event ได้
