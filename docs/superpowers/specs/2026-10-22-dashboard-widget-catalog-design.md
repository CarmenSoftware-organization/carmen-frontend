# Dashboard widget catalog (generated doc) — design

วันที่: 2026-10-22 · รีโป: carmen-inventory-frontend-react

## เจตนา

ทีม dev และทีม support ต้องรู้ว่าระบบมี widget/dataset อะไรบ้าง แต่ละตัวแสดงผลแบบไหนได้
ได้ข้อมูลอะไร และปรับตัวแปรอะไรได้ — ตอนนี้ความรู้นี้กระจายอยู่ 3 รีโป (micro-data registry,
gateway/platform templates, FE i18n + renderer) ไม่มีที่ไหนรวบไว้

- **support** — ตั้ง dashboard ให้ BU ลูกค้า ต้องตอบได้ว่า widget บอกอะไร วาดแบบไหนได้
  ตัวแปรเลือกค่าอะไรได้ (และทำไมเลือกค่าอื่นไม่ได้) และหน้า dashboard ไหนมี widget อะไรติดมา
- **dev** — ดูว่ามี dataset อะไรอยู่แล้วก่อนเพิ่มตัวใหม่ และเช็คสัญญา id / shape / params /
  supported_renders / display ระหว่าง micro-data กับ FE

## เป้าหมาย

1. ไฟล์ markdown ไฟล์เดียว `docs/dashboard-widgets.md` ที่ **สร้างจากสคริปต์ทั้งหมด** ไม่มีส่วนเขียนมือ
2. คำสั่งเดียว `bun run docs:widgets` สร้างใหม่ได้ทุกเมื่อ ผลลัพธ์ commit เข้ารีโป
3. แหล่งข้อมูลคือ **สิ่งที่ deploy อยู่บน dev** (`https://dev.blueledgers.com:4001` ซึ่ง FE เรียกว่า prod
   ตอนนี้ — `public/config.prod.json`) ไม่ใช่โค้ดบน main ของ micro-data — user ยอมรับข้อแลกเปลี่ยนนี้แล้ว

## Non-goals

- ไม่ทำคำอธิบายภาษาไทย / หมายเหตุสำหรับ support ที่เขียนมือ — user ยืนยัน "ชื่อไทยกับคำอธิบายอังกฤษพอ"
- ไม่ทำหน้าเว็บในแอป ไม่ทำ Excel
- ไม่ทำตัวสร้างฝั่ง micro-data (Go) — ไม่ตามโค้ดบน main
- ไม่รันใน CI / ไม่บังคับให้ไฟล์สดใหม่อัตโนมัติ (ต้องมี credential)
- ไม่แก้ dataset / template / i18n ที่ขาด — เอกสารแค่ **ติดป้าย** สิ่งที่ขาด

## Anti-goals (ทำงานได้แต่ถือว่าล้มเหลว)

- เอกสารที่ดูเหมือนจริงแต่ไม่บอกว่าเป็นภาพถ่ายจาก env ไหน เมื่อไร → support เชื่อผิด BU/env
- ซ่อน dataset ที่วาดไม่ได้หรือขาดชื่อไทย แทนที่จะแสดงพร้อมป้าย
- commit รหัสผ่าน / token ลงรีโป หรือลงในไฟล์ที่สร้าง (ดู memory "ห้าม commit token จริง")
- ตัวสร้างที่ผลลัพธ์เปลี่ยนลำดับทุกครั้งที่รัน ทำ diff อ่านไม่ออก

## โครงไฟล์ที่สร้าง (`docs/dashboard-widgets.md`)

**หัวไฟล์** — env (base URL), วันเวลาที่สร้าง, บรรทัด "ไฟล์นี้สร้างอัตโนมัติ ห้ามแก้มือ —
`bun run docs:widgets`", สารบัญ, จำนวน dataset / template

**ส่วนที่ 1 — แคตตาล็อก dataset** จัดกลุ่มตาม prefix ของ id (`procurement.` `inventory.`
`product.` `config.` `vendor.` `pricelist.` `rfp.` `recipe.` `equipment.` `document.` `workflow.` …)
ต่อ dataset หนึ่งตัว:

- id, ชื่ออังกฤษ (`meta.name`), ชื่อไทย, คำอธิบายอังกฤษ (`meta.description`)
- shape, หน่วย (`unit`), หมวด (`category`)
- รูปแบบที่วาดได้: `supported_renders` จาก backend **และ** สิ่งที่ FE วาดได้จริง
  (`availableRenders()` ใน `components/dashboard-widget/render-support.ts` — ผลตัดกันสองชุด)
- ตัวแปร (params): name, label, type, ค่าที่เลือกได้ (options), default, required —
  แสดงแค่ options ที่ API ส่งมา ไม่ต้องอธิบายว่าทำไมเลือกค่าอื่นไม่ได้ (ไม่มีแหล่งข้อมูลนั้น และ non-goal ห้ามเขียนมือ)
- ป้ายเตือน: **วาดไม่ได้ใน FE** (ผลตัดว่าง เช่น matrix) · **ไม่มีชื่อไทย**

**ส่วนที่ 2 — widget สำเร็จรูปบน dev** จาก dashboard templates ของ platform:

- `kind=system` แยกตาม module ตามลำดับ `DASHBOARD_MODULES`
  (procurement, inventory, product, config, vendor-management, operation-plan, store-operation)
- `kind=bu_default` (หน้า dashboard หลัก, module = main/null)
- ต่อแถว: order_index, ชื่อ (title_i18n th/en หรือ title), dataset_id (ลิงก์ anchor ไปส่วนที่ 1),
  widget_type, params/display ถ้ามี, allow/deny BU, สถานะ active
- ป้ายเตือน: template ที่อ้าง dataset_id ที่ไม่มีในแคตตาล็อก · widget_type ที่ FE วาดไม่ได้กับ shape นั้น

**ส่วนที่ 3 — ภาคผนวก**

- ตาราง shape → widget_type ที่ FE วาดได้ (จาก `RENDERERS`)
- รูปข้อมูลที่ได้ต่อ shape (สรุปจาก `types/dashboard-widget.ts`: scalar = `{value}`,
  scalar_delta = `{value, prev, change?}`, time_series = `[{date,value}]` …)
- display keys (FE เป็นเจ้าของ schema): width (กริด 12 คอลัมน์), height (แถวละ 4rem), decimals,
  min/max (gauge), thresholds — คำอธิบายจาก `WidgetDisplay` ใน `types/dashboard-widget.ts`
  (เขียนเป็นค่าคงที่ในสคริปต์ได้ เพราะไม่มี API ส่งมา)

## แหล่งข้อมูล

| ข้อมูล | ที่มา |
| --- | --- |
| แคตตาล็อกทั้งก้อน (meta + params + supported_renders) | `GET /api-system/dashboard-templates/datasets` — ไม่ผูก BU, ต้องมี `dashboard_template.read` ตอบ `{items, count}` |

**ยืนยันจากโค้ดแล้ว:** endpoint นี้ส่งต่อ `GET /api/dashboard-lab/datasets` ของ micro-data ทั้งก้อน
(`platform_dashboard-templates.service.ts` → `micro-data-template.client.ts` แค่ cast type ไม่ได้ตัดฟิลด์)
micro-data ตอบ `LabDatasetInfo` (`service/dashboard/lab.go`) = `DashboardMeta` แบบแบน
(`id name description shape category unit`) + `params: LabParam[]` (`name label type required default? options?`)
+ `supported_renders: string[]` — type ฝั่ง gateway ที่ประกาศแค่ `{id, supported_renders}` ไม่ตรงกับของจริง
อย่าเชื่อ type นั้น ใช้แค่ endpoint นี้ตัวเดียว ไม่ต้องใช้ BU

`params` ที่นี่มีเฉพาะตัวที่ผู้ใช้ตั้งได้ (ParamConfig) — param ที่ระบบเติมเอง (`user_id` ฯลฯ) จะไม่โผล่
จึง **ไม่ต้อง** ทำป้าย "ระบบเติมให้"
| templates | `GET /api-system/dashboard-templates?kind=system` และ `?kind=bu_default` |
| ชื่อไทย | `messages/th.json` คีย์ `dashboard.datasets.<dataset_id>` (ดู `use-widget-title.ts`) — อ่านจากไฟล์ในเครื่อง |
| renderer ฝั่ง FE | import `availableRenders` จาก `components/dashboard-widget/render-support.ts` ตรง ๆ |

## ข้อจำกัด

- **Auth:** login ผ่าน `POST /api/auth/login` (`API_ENDPOINTS.LOGIN`) ด้วยบัญชี platform ที่มีสิทธิ์
  `dashboard_template.read` ส่ง `Authorization: Bearer` + `x-app-id` (ค่าจาก `public/config.prod.json`
  หรือ config ที่เลือก) — **email/password อ่านจาก env เท่านั้น** (เช่น `WIDGET_DOC_EMAIL`,
  `WIDGET_DOC_PASSWORD`) ไม่มี default ใน source ถ้า env หายให้ error ชัด ๆ
- dev DB เป็นของร่วม (memory: ":4000 local backend is a shared dev DB") — สคริปต์ **อ่านอย่างเดียว**
- **ข้อมูลไม่ครบ = ล้ม:** login / catalog / templates call ใดพัง หรือ catalog ว่าง → exit non-zero
  และ **ไม่เขียนทับ** `docs/dashboard-widgets.md` (ไม่มีโหมดเขียนบางส่วน)
- ผลลัพธ์ต้อง deterministic: เรียงกลุ่ม/dataset ตาม id, template ตาม module แล้ว order_index;
  เวลาที่สร้างอยู่บรรทัดเดียวในหัวไฟล์
- ข้อความ i18n บางตัวอาจไม่ใช่ string ธรรมดา — ใช้ค่าดิบได้ ไม่ต้องรัน ICU
- โมดูล boundary ของ ESLint ไม่ครอบ `scripts/` แต่ห้าม import จาก `routes/`

## ส่วนที่ user ตัดสินใจแล้ว

- markdown ในรีโป · สร้างจากโค้ด/ระบบ ไม่เขียนมือ
- ครอบทั้งแคตตาล็อก dataset และ widget สำเร็จรูปต่อหน้า dashboard
- widget สำเร็จรูปเป็นภาพถ่ายจาก dev.blueledgers.com:4001 พร้อมระบุ env + วันที่
- แคตตาล็อกตามที่ deploy บน dev (ไม่ตาม main ของ micro-data)
- ชื่อไทย + คำอธิบายอังกฤษพอ

## การตัดสินใจของผม (ตรวจได้)

- ไฟล์อยู่ที่ `docs/dashboard-widgets.md` ในรีโป FE; สคริปต์ `scripts/gen-widget-docs.ts`
  + `package.json` script `docs:widgets` (ตามแบบ `gen:route-map` / `docs:i18n-check`)
- จัดกลุ่มตาม prefix ของ dataset_id
- แสดงทั้ง `supported_renders` ของ backend และผลตัดกับ FE renderer
- ภาคผนวก display keys เป็นค่าคงที่ในสคริปต์
- บัญชีที่ใช้ตอนพัฒนา: บัญชี god mode ของ dev (ดู memory "Local backend test accounts") ผ่าน env
  `WIDGET_DOC_EMAIL` / `WIDGET_DOC_PASSWORD` — ผู้สร้าง **รันกับ dev ได้** (อ่านอย่างเดียว) เพื่อตรวจรูป response
  และสร้าง `docs/dashboard-widgets.md` ชุดแรกที่ commit ถ้า login ด้วย `X_APP_ID` ของ config.prod.json แล้ว
  ได้ 403 จาก endpoint `api-system/*` ให้หยุดแล้วรายงาน อย่าเดา app-id อื่น
- ลำดับ module (`DASHBOARD_MODULES`) อยู่แค่ใน gateway → hardcode 7 ตัวในสคริปต์ module ที่ไม่รู้จักต่อท้าย
- แก้ comment ที่ล้าสมัยใน `types/dashboard-widget.ts` (บอกว่า system widget hardcode ที่ gateway —
  จริง ๆ เป็นแถว template ใน DB ของ platform ที่ gateway cache 60 วินาที)

## เหลือให้ผู้สร้างตัดสินใจ

- ชื่อ env var, รูปแบบตาราง/รายการใน markdown, การทำ anchor
- เลือก config ไฟล์ด้วย flag (`--env dev`) หรือ fix ที่ prod — ค่าเริ่มต้นต้องเป็น `config.prod.json`
- จัดการ dataset ที่ backend ส่งมาแต่ id ไม่มี prefix ที่รู้จัก (ใส่กลุ่ม "อื่น ๆ")
