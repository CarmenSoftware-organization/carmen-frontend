# Lookup layout audit — 2026-11-17

## ขอบเขตของหลักฐาน

ตรวจ source ใน working tree ของ `components/` และ `routes/`: อ่าน production `*.tsx` ด้วย TypeScript AST โดยไม่นับ `*.test.tsx` นับหนึ่ง JSX opening/self-closing invocation เป็นหนึ่ง callsite; ไม่คูณตามการ reuse component หรือจำนวน route ที่ render component นั้น

นับ `LookupCombobox` โดยตรงและ named lookup wrappers ที่ใช้ primitive นี้ ไม่รวม lookup คนละ implementation เช่น `LookupProductUnit`, `LookupWorkflow`, `LookupBuType` และไม่นับ helper/provider ภายในซ้ำเป็นหน้าผู้ใช้ ตัวเลขนี้ไม่ใช่จำนวนหน้าที่ตรวจใน browser และไม่รับรอง UI อื่นนอกปัญหา lookup width

| Source inventory                         |                           จำนวน |
| ---------------------------------------- | ------------------------------: |
| `LookupCombobox` โดยตรง                  |         58 callsites / 47 files |
| อยู่ใน shared lookup wrappers            |                    35 callsites |
| อยู่ใน route/local components โดยตรง     |                    23 callsites |
| Named wrapper invocations                |        127 callsites / 71 files |
| Route subset ของ direct + named wrappers | 149 callsites / 81 source files |

Named wrapper invocations มี internal call จาก `LookupChartOfAccountById` ไป `LookupChartOfAccount` หนึ่งจุด; อีก 126 จุดอยู่ใต้ `routes/` รายการด้านล่างเป็น audit snapshot ไม่ใช่ allowlist ที่อนุญาตให้ caller ใหม่ข้ามกฎ

## สัญญาการใช้พื้นที่

- Trigger ของ `LookupCombobox` ใช้ `w-full min-w-0` เป็นค่าเริ่มต้น ช่องกรอกและ cell จึงไม่ต้องจำเติม width ทุกครั้ง
- `className` ที่ผู้เรียกส่งตามหลังผ่าน `cn` ยัง override width ได้ เช่น `w-40` และ `w-24` ต้องรักษาเจตนาของ inline/suffix controls เหล่านี้
- Picker ที่อยู่ใน flex row ร่วมกับ action ใช้ `min-w-0 flex-1` เพื่อแบ่งพื้นที่กับปุ่มข้างเคียง ไม่ให้ `w-full` แย่งทั้งแถว
- โหมด view ยังแสดง plain value; การแก้ width ไม่เปลี่ยน UUID mapping, validation, query, selection หรือ mutation

## Compact contexts ที่ตรวจ source แล้ว

| Context                           | Source                                                                | เหตุผล/ข้อกำหนด                                                               |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Recipe step equipment             | `routes/operation-plan/recipe/recipe-steps-fields.tsx`                | Explicit `w-40`, `size="xs"`; picker อยู่กับตัวเลขและ action ในแถว            |
| CN currency suffix                | `routes/procurement/credit-note/cn-general-fields.tsx`                | Explicit `w-24` ภายใน `InputSuffixAddon`                                      |
| GRN currency suffix               | `routes/procurement/goods-receive-note/grn-form-header.tsx`           | Explicit `w-24` ภายใน `InputSuffixAddon`                                      |
| PO currency suffix                | `routes/procurement/purchase-order/po-general-fields.tsx`             | Explicit `w-24` ภายใน `InputSuffixAddon`                                      |
| PR currency cell                  | `routes/procurement/purchase-request/pr-item-cells/currency-cell.tsx` | ใช้ width contract เดิมของ `LookupCurrency`; ไม่ขยาย suffix แบบเหมารวม        |
| Company-profile currency          | `routes/system-admin/company-profile/company-profile-component.tsx`   | Read-only inline value                                                        |
| POS recipe mapping                | `routes/operation-plan/shared/pos-item-mapping.tsx`                   | Parent `w-72` กำหนดขนาดแล้ว; trigger ควรเต็ม parent นี้                       |
| Physical-count header period      | `routes/inventory-management/physical-count/pc-component.tsx`         | Header item อยู่ใน parent แบบ intrinsic width; ต้องยืนยัน geometry ใน browser |
| Sales-consumption Location/Recipe | `routes/operation-plan/sales-consumption/sc-sales-lines.tsx`          | เติม `min-w-0 flex-1` สองจุด เพื่อคงพื้นที่ให้ Reset/Ignore                   |

`LookupCurrency` มี `fullWidth` contract ของตัวเองและส่ง `w-fit` เมื่อไม่ได้ขอ full width ส่วนที่อยู่ใน `Field` อาจถูก `[&>*]:w-full` ของ Field ขยายอยู่แล้ว จึงไม่สรุปว่าทุกจุดที่มี `w-fit` เป็น bug และไม่เปลี่ยน default ของ Currency ทั้งแอปโดยไม่มี runtime evidence

## Route source coverage

| Module               | JSX callsites | Source files |
| -------------------- | ------------: | -----------: |
| accounting           |            42 |           13 |
| config               |            19 |           12 |
| inventory-management |            10 |            7 |
| operation-plan       |            12 |            8 |
| procurement          |            29 |           19 |
| product-management   |            16 |            7 |
| report               |             1 |            1 |
| store-operation      |             5 |            3 |
| system-admin         |             3 |            3 |
| vendor-management    |            12 |            8 |

### accounting

- `routes/accounting/accounts-payable/invoice/ap-invoice-header.tsx`
- `routes/accounting/accounts-payable/invoice/ap-invoice-lines.tsx`
- `routes/accounting/accounts-payable/invoice/ap-invoice-source-editor.tsx`
- `routes/accounting/accounts-payable/payment/ap-payment-expenses.tsx`
- `routes/accounting/accounts-payable/payment/ap-payment-header.tsx`
- `routes/accounting/accounts-receivable/ar-contract-dialog.tsx`
- `routes/accounting/accounts-receivable/ar-customer-lookup.tsx`
- `routes/accounting/accounts-receivable/ar-invoice-line-dialog.tsx`
- `routes/accounting/accounts-receivable/ar-profile-dialog.tsx`
- `routes/accounting/documents/accounting-document-detail.tsx`
- `routes/accounting/jv-template/jv-template-header-fields.tsx`
- `routes/accounting/jv-template/jv-template-lines.tsx`
- `routes/accounting/settings/accounting-settings-form.tsx`

### config

- `routes/config/asset-category/asset-category-page.tsx`
- `routes/config/bank-account/bank-account-page.tsx`
- `routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx`
- `routes/config/chart-of-account-mapping/coam-edit-sheet.tsx`
- `routes/config/cost-center/cost-center-dialog.tsx`
- `routes/config/cost-center/lookup-cost-center-group.tsx`
- `routes/config/currency/currency-dialog.tsx`
- `routes/config/exchange-rate/exchange-rate-dialog.tsx`
- `routes/config/location/location-form.tsx`
- `routes/config/payment-type/payment-type-bank-lookup.tsx`
- `routes/config/payment-type/payment-type-dialog.tsx`
- `routes/config/shared/ap-master-account-fields.tsx`

### inventory-management

- `routes/inventory-management/inventory-adjustment/ia-doc-info.tsx`
- `routes/inventory-management/inventory-adjustment/lookup-adjustment-type.tsx`
- `routes/inventory-management/inventory-adjustment/use-ia-item-table.tsx`
- `routes/inventory-management/physical-count/pc-component.tsx`
- `routes/inventory-management/physical-count/pc-general-fields.tsx`
- `routes/inventory-management/spot-check/sc-general-fields.tsx`
- `routes/inventory-management/transaction/transaction-component.tsx`

### operation-plan

- `routes/operation-plan/category/recipe-category-general-fields.tsx`
- `routes/operation-plan/equipment/eq-general-section.tsx`
- `routes/operation-plan/recipe/recipe-general-fields.tsx`
- `routes/operation-plan/recipe/recipe-ingredients-fields.tsx`
- `routes/operation-plan/recipe/recipe-steps-fields.tsx`
- `routes/operation-plan/sales-consumption/sc-sales-lines.tsx`
- `routes/operation-plan/shared/pos-item-mapping.tsx`
- `routes/operation-plan/shared/pos-outlet-mapping.tsx`

### procurement

- `routes/procurement/credit-note/cn-general-fields.tsx`
- `routes/procurement/goods-receive-note/grn-extra-cost-fields.tsx`
- `routes/procurement/goods-receive-note/grn-form-header.tsx`
- `routes/procurement/goods-receive-note/grn-item-cells/discount-tax-cell.tsx`
- `routes/procurement/goods-receive-note/grn-item-cells/location-cell.tsx`
- `routes/procurement/goods-receive-note/grn-item-cells/product-cell.tsx`
- `routes/procurement/purchase-order/from-price-list/step-select-items.tsx`
- `routes/procurement/purchase-order/po-general-fields.tsx`
- `routes/procurement/purchase-order/po-item-cells/location-cell.tsx`
- `routes/procurement/purchase-order/po-item-cells/product-cell.tsx`
- `routes/procurement/purchase-order/po-item-cells/row-pricing-cells.tsx`
- `routes/procurement/purchase-order/po-item-cells/tax-cell.tsx`
- `routes/procurement/purchase-request-template/use-prt-item-table.tsx`
- `routes/procurement/purchase-request/pr-item-cells/currency-cell.tsx`
- `routes/procurement/purchase-request/pr-item-cells/delivery-point-cell.tsx`
- `routes/procurement/purchase-request/pr-item-cells/location-cell.tsx`
- `routes/procurement/purchase-request/pr-item-cells/product-cell.tsx`
- `routes/procurement/purchase-request/pr-item-expand.tsx`
- `routes/procurement/purchase-request/pr-money-fields.tsx`

### product-management

- `routes/product-management/category/category-form.tsx`
- `routes/product-management/category/category-report-dialog.tsx`
- `routes/product-management/product/lookup-eco-label.tsx`
- `routes/product-management/product/pd-eco-label-dialog.tsx`
- `routes/product-management/product/pd-tab-general.tsx`
- `routes/product-management/product/pd-tab-locations.tsx`
- `routes/product-management/product/pd-unit-cells.tsx`

### report

- `routes/report/list/report-param-dialog.tsx`

### store-operation

- `routes/store-operation/stock-replenishment/stock-repl-sr-wizard.tsx`
- `routes/store-operation/store-requisition/sr-request-details.tsx`
- `routes/store-operation/store-requisition/use-sr-item-table.tsx`

### system-admin

- `routes/system-admin/company-profile/company-profile-component.tsx`
- `routes/system-admin/user/user-assigned-departments.tsx`
- `routes/system-admin/workflow/wf-stage-notifications.tsx`

### vendor-management

- `routes/vendor-management/price-list-template/plt-form.tsx`
- `routes/vendor-management/price-list/pl-general-card.tsx`
- `routes/vendor-management/price-list/pl-item-cells.tsx`
- `routes/vendor-management/request-price-list/rfp-form.tsx`
- `routes/vendor-management/vendor/lookup-certification.tsx`
- `routes/vendor-management/vendor/vendor-address.tsx`
- `routes/vendor-management/vendor/vendor-certificate-dialog.tsx`
- `routes/vendor-management/vendor/vendor-general.tsx`

## Runtime coverage

ตรวจผ่าน browser ของ dev server โดยไม่ Save/Post/Generate หรือเปลี่ยนข้อมูล backend:

| Route/context                                                           | State/data                       | Actual viewport              | Evidence                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/accounting/template-voucher/new`, `/accounting/recurring-voucher/new` | New, real lookup components      | 390×844, 1366×768, 3840×2160 | Account/Cost Center trigger width equals cell content width, height 32px; page has no horizontal overflow |
| Template/Recurring `/:id`                                               | View/edit, isolated API fixtures | 390×844, 1366×768, 3840×2160 | View is plain text; edit controls fill cells; sticky footer stays visible                                 |
| Template detail loading                                                 | Delayed isolated API fixture     | 390×844                      | Frameless skeleton, no config card shell or page overflow                                                 |
| Template schedule                                                       | New                              | 1366×768, 3840×2160          | Named container queries generate 3 then 6 field columns; field order preserved                            |
| `/accounting/accounts-payable/invoice/new`                              | New, real lookup components      | 390×844, 1366×768            | Vendor/Currency/Credit Term/Unit fill their containing fields/cells                                       |
| `/accounting/accounts-payable/payment/new`                              | New, real Vendor lookup          | 390×844, 1366×768            | Vendor fills containing field; expense dialog not exercised                                               |
| `/inventory-management/physical-count`                                  | List header, real period picker  | 390×844, 1366×768            | Intrinsic header parent remains contained; picker fills it without page overflow                          |
| `/operation-plan/recipe/new`                                            | New, Recipe Details              | 1366×768                     | Cuisine/Category/Unit fill fields; equipment inside a saved step not exercised                            |
| `/vendor-management/vendor/new`                                         | New, real lookup components      | 390×844, 1366×768            | Business Type/GL Account fill containing fields                                                           |

Sidebar check on Template new at 1720×1000: observed container 1408px with Schedule 3 / identity 4 columns and container 1584px with 6 / 6 after toggling the sidebar. Viewport size was unchanged.

### Automated browser contract

`bun run test:ui` starts its own Vite fixture and Chrome, sets CDP device metrics and checks the **returned** `innerWidth`/`innerHeight`. It uses the real shared component and CSS, without backend calls or auth. The same runner is included in the full `bun test:run` suite.

- Actual 390×844, 768×1024, 1366×768, 1920×1080, 3840×2160, in light and dark.
- Field and table-cell cases: empty, selected, long label, disabled, loading, error; width/height/overflow checks.
- Explicit compact width, read-only plain text, and an inline flex lookup beside an action remain valid.
- A negative probe forces an unclassified table lookup to shrink. The gate must detect this failure before accepting positive cases.
- Missing Chrome is a failure, not a silent skip; `CHROME_PATH` overrides the executable.

### Verification results

- Full `bun test:run --maxWorkers=4`: 308 files, 2,605 tests passed, 5 existing todo items.
- Final real-Chrome runner: negative probe detected; all 10 viewport/theme combinations passed, with actual viewport dimensions checked.
- Typecheck and local build passed. Scoped ESLint had no errors; `sc-sales-lines.tsx` retains its existing TanStack/React Compiler warning.
- React Doctor 0.9.23 returned no changed-line diagnostics (`[]`) but score 49. Its installed source calculates the score before filtering diagnostics to changed lines. An unfiltered scan identified four pre-existing `LookupCombobox` warnings (component complexity/size and two callback-effect rules); the relevant logic is unchanged from HEAD. This is not a clean whole-file scan and is not used as evidence that UI appearance passed.

### Limits

- `/operation-plan/sales-consumption?view=mapping&map=items` is blocked in the current BU because POS interface is not enabled. Mapping and sales-line data contexts are source-audited; the sibling-action layout is covered in the browser fixture, not a live POS document.
- Config mapping sheets, exchange-rate dialogs, saved recipe equipment, AP expense dialogs and the remaining source callsites have not all been exercised in the browser in this audit.
- This gate covers the shared lookup geometry contract. It does not certify every page, document workflow, typography, colour, spacing or future feature-specific override.
- CI remains `workflow_dispatch`; no GitHub PR/push trigger or branch protection was changed. The local full test command now includes browser geometry, but CI enforcement is not claimed active on every PR.
