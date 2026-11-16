# Accounting API integration checklist

ตรวจเมื่อ **2026-09-30** จาก [dev Swagger](https://dev.blueledgers.com:4001/swagger) (API Gateway `3.0.2-build.20260928.3b26a29ac`) เทียบกับ hook, repository และ route ที่หน้า Accounting ใช้จริง

**นิยามสถานะ:** `API` = หน้าจอเรียก backend จริง; `API + mock` = เรียก backend แต่แสดงข้อมูลจำลองเมื่อว่างหรือผิดพลาด; `Mock · API พร้อม` = หน้าจอยังใช้ mock แม้ Swagger มี endpoint; `Mock · ยังไม่มี API` = ยังไม่พบ endpoint ที่ตรงกับเอกสารนั้น; `Frontend` = พฤติกรรมใน browser ที่ไม่ต้องมี endpoint แยก

> **หมายเหตุเรื่อง URL Prefix `/api/proxy/`:**  
> ในโค้ด Frontend จะเห็น path เช่น `/api/proxy/api/{bu_code}/...` — ตัวนี้เป็นเพียง **Internal Rewrite Prefix** ที่ `lib/http-client.ts` ดักจับแล้วตัดคำว่า `/api/proxy` ออกอัตโนมัติ เพื่อส่งตรงไปยัง Backend URL (`https://dev.blueledgers.com:4001/api/...`) ดังนั้นบน Backend จริงจะไม่มี path `/api/proxy/`
>
> ตารางนี้แยก **การมี endpoint ใน Swagger** ออกจาก **การใช้งานจริงในหน้า UI**; endpoint ที่ยังไม่ต่อ UI ยังไม่ถือว่าทดสอบ business flow ผ่าน ดู [Business Flow Checklist](business-flow-checklist.md) สำหรับความคืบหน้าเชิง workflow

| หน้าจอ / งาน | สถานะ frontend | API ที่พบใน Swagger | ตรวจจาก code / ข้อจำกัด |
| :--- | :--- | :--- | :--- |
| Config → Chart of Accounts | **API** | `GET/POST /api/config/{bu_code}/chart-of-accounts`; `GET/PUT/PATCH/DELETE .../{id}` | ข้อมูลพื้นฐานใช้ `createConfigCrud`; Dimension Rules ใช้ API แยก; Account Group อ่านได้แต่การเปลี่ยนกลุ่มยังรอ backend DTO; เคยทดสอบ CRUD พื้นฐานกับ `CARMEN-FIFO` |
| JV list, detail, create | **API** | `GET/POST /api/{bu_code}/gl-jv`; `GET/PATCH/DELETE .../{id}` | `useJournalVoucher` ใช้ HTTP repository จริง ไม่มี fallback สำหรับรายการจริง; `CARMEN-AVG` สร้าง JV `20260900004` พร้อม Cost Center แล้วอ่านกลับได้ |
| JV แก้ไขหลังสร้าง | **API เฉพาะ header** | `PATCH /api/{bu_code}/gl-jv/{id}` | API dev ไม่บันทึกการแก้บรรทัด/Cost Center ผ่าน PATCH; frontend แจ้งข้อจำกัดแทน success. `DELETE` มีใน Swagger แต่ frontend ยังไม่ใช้ |
| JV workflow / Posting | **API ที่ผูกแล้ว** | `POST .../gl-jv/{id}/{submit,approve,reject}`; `POST .../gl-posting/{id}/{post,void,reverse}` | Action ของ JV จริงส่ง HTTP; ยังไม่ได้ smoke test ทุกสถานะ. Mock repository ใช้เฉพาะ id ที่ขึ้นต้น `mock-` |
| JV Cost Center lookup | **API** | `GET /api/config/{bu_code}/cost-centers` | ฟอร์ม JV ใช้ Cost Center จริงและส่ง id ในบรรทัด ไม่ใช้ Department แทน; `CARMEN-AVG` มี test center `JV-TEST` |
| JV Dimension lookup / save | **API บางส่วน** | `GET /api/config/{bu_code}/dimensions`, `/dimension-values`; `POST /api/{bu_code}/gl-jv` | ค่า Dimension ที่สร้างจาก API เลือกในฟอร์ม JV ได้; Save พร้อม Dimension บน `CARMEN-AVG` (2026-09-30) ตอบ `Unknown argument updated_by_id` แต่ Save รายการเดิมโดยไม่ใส่ Dimension ผ่าน (JV ทดลอง `20260900005`) จึงเป็นปัญหาเฉพาะ nested Dimension ของ backend และยังยืนยัน read-back ไม่ได้ |
| JV Fast Entry / Auto Balance | **Frontend** | ใช้ JV API ตอนบันทึก | ตารางและคีย์ลัดคำนวณใน browser; ไม่มี endpoint เฉพาะ |
| Config → Bank Accounts | **API** | `GET/POST /api/config/{bu_code}/bank-accounts`; `GET/PUT/DELETE .../{id}` | หน้า Config ต่อ CRUD จริงและส่ง `doc_version` ตอนแก้ไข; ยังไม่ได้ smoke test runtime |
| Bank Account lookup ใน AP Payment | **API** | `GET /api/config/{bu_code}/bank-accounts` | `useBankAccounts` อ่าน API จริง; API error/ข้อมูลว่างไม่เติม seed แล้ว |
| Config → GL Periods | **API** | `GET /api/config/{bu_code}/gl-periods`; `POST .../years`; `POST .../{id}/{close,reopen}` | หน้า Config สร้างปี/ปิด/เปิดงวดด้วย API; ไม่มี Lock action เพราะไม่พบ endpoint; ยังไม่ได้ smoke test runtime |
| Period Lock ในฟอร์ม JV | **API** | `GET /api/config/{bu_code}/gl-periods` | ฟอร์ม JV ใช้งวดจริง; หากอ่าน API ล้มเหลวจะไม่ให้ Save แทนการสมมติว่างวดเปิด |
| Config → JV Prefix, GL Dimensions, Account Groups | **API** | `/api/config/{bu_code}/gl-jv-prefixes`, `/dimensions`, `/dimension-values`, `/gl-account-groups` | หน้า Config ต่อ API จริง; Dimension และ Sub-Value ทดสอบ Create/Read/Update ผ่านบน `CARMEN-AVG` (2026-09-30), แต่ Delete ทั้งคู่ตอบ `Unknown argument deleted_at`; Dimension ทดลอง `qa_jv_0930` และค่า `QA` ยังอยู่เพราะ API ลบ/ปิดใช้งานไม่สำเร็จ |
| Config → Titles | **Mock · ยังไม่มี API** | ไม่พบ `/api/config/{bu_code}/titles` | หน้า Title ใช้ `useAccountingMasterMock`; `useTitles` ใน AR เรียก path นี้แต่ fallback เป็น seed เมื่อ 404/error |
| Config → WHT Forms / Service Types / Payment Types | **Mock · ยังไม่มี API master ที่ตรง** | มี `POST /api/{bu_code}/ap-payment/wht-preview` เฉพาะคำนวณ preview | หน้า Config และ lookup ใช้ค่าจำลอง; WHT preview ยังไม่ถูกเรียกจาก UI |
| AP Invoice list, detail, create, workflow | **Mock · API ยังไม่ครบตามฟอร์ม** | `GET/POST /api/{bu_code}/ap-invoice`; `GET/PUT/DELETE .../{id}`; `POST .../{submit,approve,review,reject,void}` | ทุก hook ใน `use-accounts-payable.ts` ยังใช้ mock ตามที่โอมเลือก; Swagger GET detail มีข้อมูลสรุป แต่ไม่มี invoice lines ที่ฟอร์มต้องใช้ |
| AP 3-Way Matching | **Mock · API บางส่วนพร้อม** | `GET /api/{bu_code}/ap-invoice/grn-candidates`; `POST .../from-grn` | Modal/tolerance ใน frontend ยังจำลอง; endpoint สำหรับ GRN candidate และสร้างจาก GRN มีแล้ว แต่ยังไม่ผูก UI |
| AP Payment list, detail, workflow | **Mock · API ยังไม่ครบตามฟอร์ม** | `GET/POST /api/{bu_code}/ap-payment`; `GET/PUT/DELETE .../{id}`; `POST .../{submit,approve,review,reject,void}` | ยังใช้ AP mock repository ตามที่โอมเลือก; Swagger GET detail ไม่มี payment allocations ที่ฟอร์มต้องใช้ |
| AP Outstanding / WHT Preview | **Mock · API พร้อม** | `GET /api/{bu_code}/ap-payment/outstanding-documents`; `POST .../wht-preview` | API มีแล้วแต่หน้า AP Payment ยังใช้ข้อมูล/สูตรจำลอง; Advance Deposit Offset และ Multi-bank ต้องเทียบสัญญา API ก่อนเชื่อม |
| AR Invoice / Receipt | **Mock · ยังไม่มี API** | ไม่พบ `/api/{bu_code}/ar-*` | AR Invoice ใช้ `AR_INVOICES` จาก model; Receipt ใช้ `documentsFor()` จำลอง |
| JV Templates / Recurring | **Mock · API พร้อมบางส่วน** | `GET/POST /api/{bu_code}/gl-jv-templates`; `GET/PATCH/DELETE .../{id}`; `POST .../generate-all-due`, `POST .../{id}/generate` | หน้า Template/Recurring ใช้ `documentsFor()`; ต้องตรวจ recurring workflow ว่าตรงกับ template API หรือไม่ |
| Allocation Voucher / Asset Register / Disposal | **Mock · ยังไม่พบ API ที่ตรง** | — | หน้า list/detail ใช้ `documentsFor()` และ local UI state |
| Financial Reports | **Mock · API พร้อมบางส่วน** | `GET /api/{bu_code}/gl-reports/trial-balance` | หน้า Report ยังใช้ `documentsFor()`; Trial Balance API ยังไม่ผูก |
| Accounting Dashboards / Cash Forecast | **Mock** | มี Trial Balance; ไม่พบ endpoint ที่ให้ snapshot ตรง UI | `getAccountingDashboardSnapshot()` และ cash forecast ใช้ mock data |

---

## งานเชื่อมต่อ API ที่ทำได้ต่อ

1. **AP Invoice + AP Payment:** รอ backend ส่ง invoice lines / payment allocations ใน GET detail ก่อนย้ายฟอร์มจาก mock ตามข้อตกลงกับโอม
2. **Config masters:** endpoint ผูกกับ UI แล้ว; ต้อง smoke test CRUD กับ BU ที่มี license/permission ก่อนถือว่าใช้งานจริงผ่าน
3. **GL Templates และ Trial Balance:** มี API แต่หน้า UI ยัง mock; ต่อเมื่อ mapping ของหน้าจอตรง API

---

## ผลตรวจที่ยืนยันด้วยข้อมูลจริง

- `CARMEN-FIFO` เคยทดสอบ Chart of Accounts CRUD ผ่าน; ณ การทดสอบครั้งนั้น `GET /api/CARMEN-FIFO/gl-jv` ได้ 403 จาก license และ `GET /api/config/CARMEN-FIFO/gl-periods` ได้ 403. **ไม่ได้ทดสอบซ้ำในการอัปเดตเอกสารครั้งนี้**
- `CARMEN-AVG` สร้าง JV `20260900004` พร้อม Cost Center แล้ว `GET` อ่านกลับได้หลัง reload; `PATCH` ของ JV ใบเดิมไม่บันทึกการแก้บรรทัด
- รายการ endpoint อื่นในตารางยืนยันจาก Swagger และ code path เท่านั้น ยังไม่ถือว่า runtime CRUD/workflow ของแต่ละ BU ผ่าน

## Accounting Config — Activity (2026-10-02)

- API: COA, Account Code Grouping, JV Prefix, Dimension/Sub-values, Bank Account, GL Period ใช้ Activity sheet กลาง → `GET /api/{bu_code}/activity-logs/record/{entityId}` และ endpoint detail เดิม
- Mock: Title Master, Payment Type, WHT Form, WHT Service Type, Asset Category, Account Mapping แสดง Activity แบบ disabled เพราะข้อมูลยังเป็น mock
- Backend source มี Prisma CRUD audit เพิ่มเติมจาก Activity registry; การไม่มีรายการใน registry อย่างเดียวไม่ได้แปลว่าไม่มี CRUD audit
- การเชื่อม API ไม่รับประกันว่าทุก record เก่ามีประวัติ; แสดง empty/error state จาก Activity sheet จริง ไม่มี fallback mock
- Runtime verification: COA record `101` ใน CARMEN-AVG แสดง Created และรายละเอียด field จาก API จริง; Payment Type แสดง Activity disabled สำหรับ mock (2026-10-02)

## COA form contract repair (2026-10-02)

- Account Group: อ่าน `account_group.id` (fallback `account_group_id` สำหรับ response เดิม) ใน detail และ list; แสดง read-only เพราะ DTO ของ COA ยังไม่รับ field นี้
- Dimensions: ใช้ `GET/POST/PUT/DELETE /api/config/{bu_code}/account-dimension-rules` พร้อม `chart_of_accounts_id`, `gl_dimension_id`, `requirement` (`mandatory`, `optional`, `prohibited`); GET วน pagination และจำกัด rule ของบัญชีนั้น
- ไม่ส่ง `allowed_dimensions` / `dimension_required` ที่ COA DTO ไม่รองรับ และไม่บังคับเลือก Account Group ที่ยังบันทึกไม่ได้
- Save สำเร็จเมื่อข้อมูลพื้นฐานและกฎ Dimension บันทึกครบเท่านั้น; ถ้าบางกฎผิดพลาด แจ้ง partial save และเก็บ ID/version ไว้ให้ retry โดยไม่สร้าง COA ซ้ำ
- Verified: GET rules ใน CARMEN-AVG โหลดฟอร์มได้จริง; tests ตรวจ create/update/delete/unchanged, pagination, isolation ระหว่างบัญชี และ API failure. ยังไม่ได้ทดสอบ save กฎใหม่บน backend จริง
- Live GET เมื่อไม่มี rules ส่ง `data: []` โดยไม่มี `paginate`; รองรับกรณีว่างนี้แล้ว ส่วน response ที่มีข้อมูลแต่ไม่มี pagination จะหยุดพร้อม error เพื่อไม่อ่าน rules ขาดโดยเงียบ ๆ
- Nature: dropdown Debit/Credit; Category ตั้งค่าเริ่มต้น และ Save ส่งค่าที่ผู้ใช้เลือก ตรวจตัวเลือกใน browser แล้ว ยังไม่ได้บันทึกเปลี่ยน Nature ของบัญชีจริง
