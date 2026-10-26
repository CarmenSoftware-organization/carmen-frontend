# Ask AI — จัดการ provider และ prompt จาก backstage, แก้ทับราย BU

วันที่: 2026-10-27 · รีโปที่แตะ: `carmen-turborepo-backend`, `carmen-backstage`, `carmen-frontend`

## เจตนาและเหตุผล

ปุ่ม "Ask AI" บนหน้า Purchase Request (`routes/procurement/purchase-request/ai/`) ประกอบ
prompt + ตารางรายการสินค้า แล้วเปิดแท็บไปยังเว็บ AI สาธารณะ (Claude, ChatGPT, Gemini,
DeepSeek, Grok, Google Search) — **ไม่มีการเรียก AI ผ่าน backend** และไม่ควรมีในงานนี้

ปัญหาวันนี้: ทั้งรายชื่อ provider (`ai-providers.ts`) และ prompt (`CONTEXT` ใน
`build-pr-ai-query.ts`) ฝังอยู่ในโค้ด แก้คำเดียวต้อง build + deploy ใหม่ และทุก BU ได้ prompt
เดียวกันหมด

ที่ user ต้องการ:
- ตั้ง **prompt มาตรฐาน** ได้เอง และ prompt แยก **ราย AI provider** (Claude ชุดหนึ่ง ChatGPT อีกชุด)
- **เพิ่ม provider ใหม่** และ **เปิด/ปิด** provider ได้ — มีผลทันทีโดยไม่ต้อง compile เว็บใหม่
- จัดการค่ามาตรฐานที่ **carmen-backstage** ในเมนูใหม่ชื่อ **AI**
- ใน **carmen-frontend** แต่ละ BU **แก้ prompt ทับ** ราย provider และ **ปิด provider เอง** ได้
- หน้า PR **แค่ใช้** ค่าที่ได้ ไม่มีค่าฝังในโค้ดอีก

## เป้าหมาย

1. backstage มีหน้า AI → Providers: list / create / edit / เปิด-ปิด provider, แก้ prompt มาตรฐาน
2. frontend มีหน้า `/system-admin/ask-ai`: ต่อ provider — เปิด/ปิดสำหรับ BU นี้, แก้ prompt ทับ,
   ปุ่ม "กลับไปใช้ค่ามาตรฐาน"
3. หน้า PR ดึงรายการ provider ที่ใช้ได้ + prompt ที่มีผลจริง จาก backend ครั้งเดียวตอนเปิดเมนู/หน้า
4. หลัง deploy พฤติกรรมหน้า PR **เหมือนเดิมทุกอย่าง** (6 provider เดิม prompt เดิม เปิดอยู่ทุก BU)

## ไม่ใช่เป้าหมาย

- ไม่เรียก LLM ฝั่ง server, ไม่เก็บ API key ของ AI
- ไม่ทำ Ask AI ให้หน้าอื่น (PO, vendor ฯลฯ) และไม่ทำโครง "หลายจุดใช้งาน" เผื่อไว้ —
  ใช้แค่หน้า PR หน้าเดียว (user สั่ง)
- ไม่ทำ prompt ราย user, ไม่ทำประวัติเวอร์ชันของ prompt

## Anti-goals (ถ้าเกิดถือว่าล้มเหลวแม้โค้ดจะทำงาน)

- หลัง deploy หน้า PR เปลี่ยนพฤติกรรม หรือปุ่ม Ask AI หายเพราะ BU ยังไม่มีค่าตั้ง
- ผูก license feature key ใหม่ → หน้าล็อกทันทีที่ deploy (`LICENSE_ENFORCEMENT` เปิดทุก env)
- provider ที่ backstage ปิด แต่ BU ยังเปิดใช้ได้
- เพิ่ม `api_name` ใหม่แล้วไม่เติม allowlist → user ถูก logout (ดู memory
  `new-api-name-401-logs-users-out`)

## การตัดสินใจของ user

| เรื่อง | คำตัดสิน |
|---|---|
| prompt แยกตามอะไร | ราย **AI provider** |
| ที่จัดการค่ามาตรฐาน | carmen-backstage เมนู **AI** |
| BU ทำอะไรได้ | แก้ prompt ทับราย provider **และ** ปิด provider เองได้ |
| provider ใหม่ที่เพิ่มใน backstage | **ปิดไว้ก่อน** ในทุก BU — แต่ละ BU ไปเปิดเอง |
| เพิ่ม provider / แก้ prompt | ต้องมีผลทันที ไม่ต้อง build เว็บใหม่ |
| ขอบเขตการใช้ | หน้า PR หน้าเดียว |

## โมเดลข้อมูล

### ฝั่ง platform (`prisma-shared-schema-backstage`) — ตารางใหม่ `tb_ai_provider`

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid | |
| `code` | varchar unique | slug เช่น `claude`, `perplexity` — ใช้เป็น key ผูกค่าฝั่ง BU, แก้ไม่ได้หลังสร้าง |
| `label` | varchar | ชื่อที่แสดง |
| `icon_key` | varchar? | ไอคอนสำเร็จรูปใน FE (`claude`/`chatgpt`/`gemini`/`deepseek`/`grok`/`google`) |
| `icon_url` | varchar? | URL รูป `https://` สำหรับ provider ใหม่ (CSP `img-src https:` รองรับแล้ว) |
| `url_template` | varchar | ต้องขึ้นต้น `https://` · ถ้ามี `{query}` = รับข้อความผ่าน URL (ระบบ `encodeURIComponent` ให้) · ถ้าไม่มี = เปิด URL เปล่า + คัดลอกข้อความลง clipboard |
| `default_prompt` | text | prompt มาตรฐาน |
| `is_active` | bool | backstage เปิด/ปิด — ปิดแล้วทุก BU ไม่เห็น |
| `default_enabled_for_bu` | bool | ค่าเปิด/ปิดของ BU ที่ยังไม่เคยตั้งเอง · seed 6 ตัวเดิม = `true`, ตัวใหม่ default `false` |
| `sort_order` | int | ลำดับในเมนู |
| audit columns + soft delete | | ตามแบบตารางอื่นใน schema |

`supportsPrefill` เดิมไม่ต้องเก็บแยก — อนุมานจากการมี `{query}` ใน `url_template`

### ฝั่ง BU (tenant) — ใช้ `tb_application_config` ที่มีอยู่ key `ask_ai`

```json
{
  "providers": {
    "claude":     { "enabled": true,  "prompt": "..." },
    "perplexity": { "enabled": true }
  }
}
```

- ไม่มีแถว / ไม่มี entry ของ provider = ใช้ `default_enabled_for_bu` และ `default_prompt`
- `prompt` ไม่มีหรือเป็นค่าว่าง = ใช้ค่ามาตรฐาน · "กลับไปใช้ค่ามาตรฐาน" = ลบฟิลด์ `prompt`
- entry ของ `code` ที่ถูกลบจาก platform ไปแล้ว = ข้ามเงียบ ๆ

### การคำนวณค่าที่มีผลจริง (ทำฝั่ง backend)

```
ใช้ได้ใน BU  = provider.is_active && (bu.enabled ?? provider.default_enabled_for_bu)
prompt จริง  = bu.prompt (ไม่ว่าง) ?? provider.default_prompt
```

## Prompt template

- prompt เป็นข้อความล้วน มีจุดแทนค่า **`{items}`** — ระบบใส่ตารางรายการสินค้า (Markdown table
  แบบเดิม: `# | Item | Qty | Quoted price`) ตรงนั้น
- ถ้า prompt ไม่มี `{items}` → ต่อท้ายตารางให้หลังบรรทัดว่าง (กันคนลบทิ้งแล้วส่งไปแต่คำสั่งเปล่า)
- ข้อมูลที่ส่งไปยังคงเดิม: ชื่อสินค้า (+ชื่อ local), จำนวน+หน่วย, ราคา+สกุลเงิน — **ไม่ส่งชื่อคลัง**
  (เหตุผลเดิมในคอมเมนต์ `build-pr-ai-query.ts` ยังใช้)
- ค่า seed ของ `default_prompt` ทั้ง 6 ตัว = `CONTEXT` ปัจจุบัน + `{items}`
- ใช้ `{items}` ในฐานข้อมูลเท่านั้น — ห้ามใส่ข้อความที่มี `{}` ลงไฟล์แปล `messages/*.json`
  (ICU พังทั้งหน้า) ข้อความช่วยในหน้าตั้งค่าที่ต้องพูดถึง `{items}` ให้ใส่ตรงใน JSX หรือ escape ตาม ICU

## API (gateway)

| ใช้ที่ | Endpoint (ชื่อเป็น call ของ builder) | หน้าที่ |
|---|---|---|
| backstage | `GET/POST/PATCH/DELETE /api-system/.../ai-providers` | CRUD `tb_ai_provider` · สิทธิ์ backstage permission ใหม่ (เช่น `ai_provider.*`) + seed ให้ role ที่ควรมี |
| FE หน้าตั้งค่า | `GET /api/{bu}/ask-ai/config` | รายการ provider ที่ `is_active` ทั้งหมด + ค่ามาตรฐาน + ค่าที่ BU ตั้งไว้ (ไว้แสดงหน้าแก้) |
| FE หน้าตั้งค่า | `PUT /api/{bu}/ask-ai/config` | บันทึก `ask_ai` ของ BU · validate ว่า `code` มีจริงและ prompt ยาวไม่เกินเพดาน |
| หน้า PR | `GET /api/{bu}/ask-ai/providers` | เฉพาะ provider ที่ใช้ได้ใน BU พร้อม prompt จริง, `url_template`, `icon_key`/`icon_url` เรียงตาม `sort_order` |

- ตามกฎ `KeycloakGuard` ข้าม tenant (memory `keycloak-guard-query-bu-code-cross-tenant`):
  ใช้ bu_code จาก path และตรวจว่า user อยู่ใน BU นั้น
- endpoint อ่านของหน้า PR: ใครก็ตามที่เปิดหน้า PR ได้ต้องอ่านได้ · endpoint หน้าตั้งค่า: สิทธิ์
  system-admin ที่มีอยู่ (ไม่สร้าง permission key ใหม่ที่ไม่มีใน DB — memory `permission-key-audit-against-db`)
- เพิ่ม `api_name` ใหม่ → **ต้องเติม allowlist ของ app ก่อน deploy FE**

## carmen-backstage

- เมนูใหม่ **AI** → หน้า **Providers** (ตามแบบหน้า management อื่นใน `src/pages/`)
- ตาราง: ไอคอน, label, code, เปิด/ปิด (`is_active`), "เปิดให้ BU เป็นค่าเริ่มต้น", ลำดับ
- ฟอร์ม: code (ล็อกหลังสร้าง), label, ไอคอน (เลือกไอคอนสำเร็จรูป หรือใส่ URL), `url_template`
  (บอกใต้ช่องว่า `{query}` คืออะไร และแสดงว่าตัวนี้ "เปิดพร้อมข้อความ" หรือ "คัดลอกให้วางเอง"),
  prompt มาตรฐาน (textarea, บอกเรื่อง `{items}`)
- ลบ provider: soft delete; ค่าของ BU ที่อ้าง code นี้ถูกข้าม

## carmen-frontend

### หน้า `/system-admin/ask-ai` (ใหม่)

- route `routes/system-admin/ask-ai/ask-ai.route.tsx` + เพิ่มใน `constant/module-list.ts`
  ใต้ System Admin **ไม่ใส่ `licenseFeature`**
- รายการ provider (ที่ backstage เปิดอยู่) แต่ละตัว: สวิตช์เปิด/ปิดสำหรับ BU นี้, ป้าย
  "ใช้ค่ามาตรฐาน" / "แก้แล้ว", textarea prompt (ว่าง = ใช้ค่ามาตรฐาน, แสดงค่ามาตรฐานเป็นตัวอ่านอย่างเดียวให้เทียบ),
  ปุ่ม "กลับไปใช้ค่ามาตรฐาน"
- ใช้ UI primitive ที่มีอยู่ (ดู `docs/DESIGN.md`) และอ่านออกทั้ง light/dark
- hook อยู่ข้างหน้า (`routes/system-admin/ask-ai/use-ask-ai-config.ts`)

### หน้า PR

- `pr-ask-ai-menu.tsx` เลิกใช้ `AI_PROVIDERS` คงที่ → ดึงจาก `GET .../ask-ai/providers`
  (hook ข้าง PR feature เพราะใช้ที่เดียว)
- `buildPrAiQuery(items)` → `buildPrAiQuery(promptTemplate, items)` แทน `{items}` ตามกฎด้านบน
- เปิดแท็บ: ถ้า `url_template` มี `{query}` แทนด้วย `encodeURIComponent(query)` ถ้าไม่มี
  คัดลอกลง clipboard + toast แบบเดิม แล้วเปิด URL · `noopener,noreferrer` เหมือนเดิม
- ไอคอน: `icon_key` → ไอคอนใน `components/icons/provider-icons.tsx`; มี `icon_url` → `<img>`;
  ไม่มีทั้งคู่ → `Sparkle`
- ไม่มี provider ที่ใช้ได้เลย → ซ่อนปุ่ม Ask AI · โหลดไม่สำเร็จ → ปุ่ม disabled (ไม่ fallback ไปค่าฝังในโค้ด)
- ลบ `ai-providers.ts` (เหลือแค่ map `icon_key` → component) และ `CONTEXT`

## Migration / seed / ลำดับ deploy

1. migration สร้าง `tb_ai_provider` + seed 6 ตัวเดิม (`url_template` ตาม `ai-providers.ts` ปัจจุบัน,
   `default_prompt` = `CONTEXT` + `{items}`, `is_active=true`, `default_enabled_for_bu=true`)
   + backstage permission seed — ไม่ต้องแตะ tenant (ไม่มีแถว `ask_ai` = ใช้ค่ามาตรฐาน)
2. deploy micro-cluster → gateway → เติม allowlist `api_name` ใหม่ → deploy backstage → deploy FE
   (migration platform ต้องรันครบทุก env: dev / UAT / prod)
3. FE ก่อน BE = หน้า PR ไม่มีปุ่ม Ask AI (โหลดไม่ได้) จึงต้อง BE ก่อนเสมอ

## ข้อที่ผู้เขียน design ตัดสินใจเอง (หลัง builder check)

1. **เส้นทางข้อมูล:** ใช้แบบ dashboard-template คือ `tb_ai_provider` เป็นของ micro-cluster
   gateway เรียกผ่าน `RpcClient` + contract ใหม่ใน `packages/rpc-contract` endpoint ฝั่ง BU
   (`ask-ai/config`, `ask-ai/providers`) อยู่ใน gateway ดึง provider ผ่าน RPC และอ่าน/เขียน
   `ask_ai` ใน tenant แล้ว merge กันที่ gateway การ validate `code` ตอน `PUT` ก็ทำที่ gateway
   **ลำดับ deploy จึงมี micro-cluster ด้วย:** migrate platform → micro-cluster → gateway → allowlist
   → backstage → FE
2. **key `ask_ai` กับ endpoint `/app-config` แบบทั่วไป:** ไม่บล็อก แต่ฝั่งอ่านต้องทนข้อมูลเสียได้
   (parse แบบปลอดภัย ถ้า shape ผิดหรือ `code` ไม่รู้จักก็ข้ามไปใช้ค่ามาตรฐาน) และให้ซ่อน key นี้จาก list
   ทั่วไปเหมือนกับ `interface_*` ถ้าโค้ดตรงนั้นทำได้ง่าย
3. **สิทธิ์:**
   - หน้า `/system-admin/ask-ai` ใช้ `licenseFeature: "system_admin"` (key เดิม) กับ permission
     `system_admin.business_unit.view` สำหรับดู และ `.update` สำหรับบันทึก แบบเดียวกับ `default-setting`
     ต้องตรวจกับ DB ก่อนว่า key มีจริง
   - `GET ask-ai/providers` ใช้แค่ `KeycloakGuard` และ bu_code จาก path ไม่ใส่ `@Permission` แบบเดียวกับ
     `/app-config` เพราะ PR มีทั้ง `view` / `view_department` / `view_all` ถ้าบังคับ `view` อย่างเดียว role ที่มีแค่
     `view_department` จะไม่เห็นปุ่ม และข้อมูลชุดนี้ก็ไม่ลับ (ปรับหลังสำรวจ backend ตอนเขียนแผน)
   - backstage seed `ai_provider.*` ให้ role ที่ได้ `dashboard_template.*` และ `ai_provider.read`
     ให้ role ที่ได้ `dashboard_template.read` ต้องเขียน seed ให้รันซ้ำได้ (idempotent)
4. **ตอนโหลด:** ดึงข้อมูลตอน mount หน้า PR (ไม่ใช่ตอนเปิดเมนู) ใช้ retry ตามค่าเริ่มต้นของ TanStack
   ถ้าดึงไม่สำเร็จปุ่มจะเป็น disabled ถ้าได้ list ว่างจะซ่อนปุ่ม และไม่มี fallback ไปใช้ค่าที่ฝังในโค้ด
5. **provider ที่ backstage ปิดอยู่:** ไม่แสดงในหน้าของ BU แต่ค่าของ BU ยังเก็บไว้ ถ้าเปิดกลับมา prompt
   และสถานะเปิด/ปิดเดิมของ BU จะกลับมาด้วย ส่วนลำดับใช้ `sort_order` ของ platform อย่างเดียว BU เรียงเองไม่ได้
6. **ตรวจ URL:** `url_template` และ `icon_url` ต้องเป็น `https://` ห้ามมี userinfo (`user@`) และ
   `{query}` วางได้เฉพาะหลัง `?` หรือ `#` เท่านั้น ห้ามอยู่ที่ host หรือ path ไม่จำกัด host
   (คนตั้งค่าคือ backstage admin)
7. **การแทนค่า:**
   - แทน `{items}` **ทุกจุด** ใช้ function replacer เพื่อกันปัญหาอักขระพิเศษแบบ `$&`
   - `{query}` ที่อยู่ใน prompt เป็นข้อความธรรมดา ไม่แทนค่า
   - เพดาน ~4,000 ตัวอักษรใช้กับ template เท่านั้น
   - ถ้า URL สุดท้ายยาวเกิน ~8,000 ตัวอักษร (PR มีหลายบรรทัด) ให้เปลี่ยนไปใช้วิธีคัดลอกลง clipboard
     แล้วเปิด URL ที่ไม่มี query แทน ไม่ตัดตารางทิ้ง

## ปล่อยให้ builder ตัดสินใจ

- ชื่อ endpoint, ชื่อ module/ไฟล์ใน gateway และ backstage (ตามแบบที่มีอยู่)
- ตารางอยู่ใน micro-cluster หรือ gateway อ่าน backstage prisma ตรง — ตามแบบ dashboard-template
- เพดานความยาว prompt (แนะนำ ~4,000 ตัวอักษร — URL ยาวเกินบาง provider ตัด)
- cache ฝั่ง FE (TanStack Query, staleTime สั้น ๆ พอ ให้ "มีผลทันที" ในระดับเปิดหน้าใหม่)
- ข้อความ i18n (th/en)
