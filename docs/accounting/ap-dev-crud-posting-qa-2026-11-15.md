# AP dev CRUD and posting QA — 2026-11-15

ขอบเขต: ยืนยัน Invoice/Payment ตาม **API ปัจจุบัน** บน dev, BU FIF / CARMEN-FIFO
โดยใช้ THB, exchange rate 1, WHT 3%, ไม่มี VAT และค่าธรรมเนียม 5 บาท
ไม่ใช่การยืนยัน flow เต็มตาม FRD หรือการจ่ายเงินจริงผ่านธนาคาร

## ขอบเขต master ที่ต้องแยกให้ชัด

Payment Type, WHT Form และ WHT Service Type ใน Config ยังเป็น mock/localStorage
และไม่ได้เป็น dependency ของ AP Payment ที่ทดสอบ:

| ส่วน | Contract ที่ใช้งานจริง | สิ่งที่ยังไม่เชื่อม |
| --- | --- | --- |
| วิธีจ่าย | `payment_method` enum เช่น `bank_transfer` | Payment Type master / `payment_type_id` |
| แบบ ภ.ง.ด. | Tax Profile API: `wht_pnd_form` enum | WHT Form master / `wht_form_id` |
| ประเภทเงินได้ | Tax Profile API: `wht_income_type` free text | WHT Service Type master / `wht_service_type_id` |

หลักฐาน source: `hooks/use-accounting-master.ts`, Config ทั้งสามหน้า,
gateway `ap-payment/swagger/request.ts` และ micro-business
`master/tax_profile/dto/tax-profile.dto.ts` ใน `carmen-turborepo-backend-v2`
ดูรายการรอ API ทั้งหมดใน [deferred ledger](ap-api-deferred-fields.md)

## ข้อมูลทดสอบ

| Fixture | ผล / ค่าที่ใช้ |
| --- | --- |
| GRN `GRN261000038` | Manual/AP, 2026-10-31, C010, T-30-F, 2 BOX × 500 = 1,000; Save/Commit ผ่าน; auto-create AP ของ BU ปิดอยู่ |
| WHT `QA WHT 3% 20261115` | Tax Profile API จริง, `tax_type=wht`, 3%, `pnd_53`, income type `QA service verified 20261115`, GL 219992 |
| COA 219992 | `DEV QA WHT Payable 20261115`, liability/balance sheet, ไม่บังคับ Cost Center |
| COA 119992 / Bank `QA-WHT-1115` | บัญชีธนาคารจำลองแยกสำหรับ QA, asset/balance sheet; account number ระบุ `QA-NOT-REAL-20261115` |

ไม่เปลี่ยนข้อบังคับ Cost Center ของบัญชีเดิม 119991 ซึ่งบังคับอยู่จริง

## CRUD ผ่าน UI และโหลดซ้ำจาก backend

| เอกสาร | Create / Read | Update / Read | Delete |
| --- | --- | --- | --- |
| Invoice `APIV26110003` | Total 500, WHT estimate 15, GRN matched qty 1, PDF บันทึก/ดาวน์โหลดได้ | Total 1,000, WHT estimate 30, matched qty 2, matched amount 1,000, variance 0; ถอด PDF แล้ว reload ไม่มีไฟล์แนบ | ผ่าน; draft ถูกลบ |
| Payment `APPV26110003` | Applied/base 900, manual WHT 27.01, net 872.99; PND/income type บันทึกครบ | Applied/base 800, WHT 24.01, net 775.99; reload ตรง | ผ่าน; reservation คืนให้ Invoice |

ทดสอบลบ WHT จนว่างแล้วเปลี่ยน allocation: auto-preview ไม่สร้างแถวกลับมา
และเพิ่ม WHT ใหม่ด้วยมือผ่าน profile/base/amount editor ได้จริง

## Posting และ GL จริง

| เอกสาร | ผล | JV |
| --- | --- | --- |
| Invoice `APIV26110004` | Posted, Total 1,000, WHT estimate 30, GRN matched qty 2 | `20261100002` (`e41322a0-55ec-4557-8d0f-26a13cf4ec93`) |
| Payment `APPV26110004` | Posted, Applied 1,000 − WHT 30 + fee 5 = Net 975 | `20261100003` (`e167d94e-438f-4143-9351-4ffb17937939`) |

Invoice JV: Dr 619991 = 1,000 / Cr 219991 = 1,000

Payment JV: Dr 219991 = 1,000; Dr 619991 = 5;
Cr 119992 = 975; Cr 219992 = 30 — รวม Dr/Cr 1,005 เท่ากัน

ตรวจ Trial Balance API แบบ authenticated read-only, fiscal year 2026 / period 11 /
`include_draft=false` ซึ่ง backend อ่าน `tb_gl_balance` โดยตรง
ไม่ได้เชื่อม database โดยตรง และลบหน้า QA ชั่วคราวออกหลังเก็บหลักฐานแล้ว

| GL account | Debit เพิ่มจากก่อนทดสอบ | Credit เพิ่มจากก่อนทดสอบ | Closing เปลี่ยน |
| --- | ---: | ---: | ---: |
| 119992 Bank QA | 0 | 975 | -975 |
| 219991 AP | 1,000 | 1,000 | 0 |
| 219992 WHT payable | 0 | 30 | -30 |
| 619991 Expense | 1,005 | 0 | 1,005 |

ยอด AP เดิม -12 คงเดิม; Invoice ทดสอบคงค้าง/Unpaid = 0 หลัง Payment post
Save Draft ไม่เปลี่ยน GL ทั้ง Invoice และ Payment

Negative case: Payment Submit ด้วย bank เดิม 119991 ถูกบล็อกเพราะต้องมี
Cost Center; ไม่มี JV/GL ซ้ำจากคำขอที่ล้มเหลว จากนั้นใช้ bank fixture แยก 119992
ตาม contract ที่รองรับ และ post สำเร็จ Bank/WHT GL Cost Center ยังเป็น API gap

## UI และไฟล์

- ทดสอบ CRUD ใน view/create/edit ที่ desktop; ตรวจ posted Invoice/Payment ที่
  390, 768, 1366, 1920, 3840px: document width ไม่ล้น viewport; Invoice dialog ที่
  390px กว้าง 358px และเลื่อนดู GRN matching ได้
- VAT/WHT lookup แยกชนิดจาก master API, GRN lookup เลือก fixture ที่ commit แล้วได้
- แสดง PND.53 / ภ.ง.ด.53 ด้วย label กลาง และมี regression test กัน uncontrolled
  Select warning เมื่อเพิ่ม WHT row แล้วเลือก profile
- PDF 627 bytes upload/save/reload/download หลัง posting ได้ทั้ง Invoice/Payment;
  SHA-256 ตรงต้นฉบับ: `B264577C557D333D80694FDDEC6CDB63E60C7FB3036DEFA03DEF4FB376030D76`
- ไฟล์ `.exe` ที่ใช้ทดสอบถูกปฏิเสธก่อน upload; detach PDF จาก draft ผ่าน
- Documents มี PDF QA รวม 5 ไฟล์: 2 ไฟล์ผูกเอกสารที่ post แล้ว และ 3 ไฟล์จาก draft
  ที่ถอดออก/ลบแล้ว ยังไม่ได้ลบไฟล์ถาวร
- คง posted dev fixtures ไว้ให้ตรวจย้อนหลัง; คืน URL/viewport ของหน้าจอเดิมแล้ว

หลักฐาน JSON และ screenshots อยู่ที่
`C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/`:
`ap-dev-crud-posting-verification.json`, `ap-gl-before.json`,
`ap-gl-after-invoice.json`, `ap-gl-before-payment.json`, `ap-gl-after-payment.json`,
`ap-invoice-posted-journal.jpg`, `ap-payment-posted-journal.jpg`,
`ap-payment-posted-wht.jpg`, `ap-invoice-grn-mobile.jpg`, `ap-payment-wht-mobile.jpg`

## Source verification

Typecheck, Vite build (local runtime config) และ focused tests 58 รายการ / 15 files
ผ่าน; ESLint ของไฟล์ที่แก้ไม่มี error/warning ส่วน React Doctor ได้ 84/100 โดยเหลือ
maintainability warnings 4 รายการเกี่ยวกับ component size/complexity ยังไม่ได้
refactor นอก scope; build ยังมีคำเตือน chunk ใหญ่ของแอป

ตรวจ hash ของสำเนาที่ download ทั้ง 4 ไฟล์แล้วตรงกัน จึงลบสำเนาซ้ำใน Downloads
และไฟล์ `.exe` fixture ในเครื่องออก โดยเก็บ PDF ต้นฉบับและหลักฐาน QA ไว้
