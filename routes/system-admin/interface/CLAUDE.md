# Interfaces config (`/system-admin/interface`)

Per-BU config for connections to external systems — **Accounting**, **POS**, **PMS**
(the customer's "HMS"). Config storage only; no sync/test-connection.

- **Registry (`interface-registry.ts`)** holds *list metadata only* — `key` (route param),
  `configKey` (`interface_<key>`), `icon`, and a `lazy()` form. Each interface owns its own
  form + zod schema (`<name>-interface-form.tsx`), NOT a shared schema. **Add an interface** =
  one registry entry + one form file (+ its i18n block, + a backend `secretPathsByKey` path if
  it has a secret). A future interface can render anything (e.g. a mapping table) without
  touching the others.
- **Shared bits:** `use-interface-config.ts` (wraps `useAppConfigByKey`/`useUpsertAppConfig`;
  maps 404 → `isNew`, not an error), `interface-page-layout.tsx` (presentational shell +
  nav-guard, takes `isDirty`, holds no form state), `interface-fields.tsx`
  (`TextField`/`EnumField`/`ToggleField` — label+value, not schema-driven). Forms derive
  dropdown options from `schema.shape.<field>.options` so options and validation can't drift.
- **Storage:** one `tb_application_config` row per interface. The backend
  (`carmen-turborepo-backend-v2`) encrypts+masks the `api_key` secret via a generic
  `secretPathsByKey` registry; a never-configured interface returns `{ enabled: false }`
  (not 404). **Prod/UAT must set `SECRET_ENCRYPTION_KEY`** or any secret-bearing save (incl.
  the pre-existing `report_email`) 400s.
- **The list page (`interface-list.tsx`) no longer calls the list endpoint.** It reads every
  brand's config one key at a time via `use-interface-configs.ts` (plural — distinct from the
  per-interface `use-interface-config.ts` above; fires one `useAppConfigByKey`-style query per
  brand via `useQueries`) — moved off `useAppConfigs()` on 2026-09-20 because the backend
  stopped returning `interface_*` keys from `GET /app-config` (that list maps to the shared
  `configuration.app_config` license; the three groups split out — `email_profiles`,
  `email_templates`, `interface_*` — now each have their own feature and are read one key at a
  time instead). `useAppConfigs()` itself still exists (kept for `GET /app-config`'s other
  callers) but has no caller left in this app besides its own test.
- **List-envelope gotcha (for other list callers, not this page):** the app-config *list*
  endpoint still returns `{ data: { items, count } }` for the keys it does return — the array
  is at `json.data.items`, NOT `json.data` (which is the array only in a mental model, never
  in reality). The *single-key* GET's `json.data` IS the row. Any hook that still reads the
  list must unwrap `.items`. A test mocking a bare `{ data: [...] }` passes while the real page
  crashes — verify list features in a real browser.

## API Access (กุญแจ API ขาเข้าต่อ BU)

ส่วน API Access ในแบรนด์ External เป็น **ขาเข้า** — ระบบภายนอกใช้ `x-client-id` / `x-client-secret`
เรียก Carmen (`/api/ext/v1/...`) ไม่เหมือน secret ของแบรนด์อื่นที่เป็น **ขาออก** (Carmen เอาไปเรียกระบบเขา
และเก็บใน `tb_application_config` แบบ encrypt+mask)

- สิทธิ์คือ `system_admin.bu_api_key` (view/update) ไม่ใช่สิทธิ์ของหน้า Interface — ปุ่มสร้าง / สร้างใหม่ /
  เปิดใช้ปิดใช้ / ดู secret ต้องมี `update`
- **ดู secret (reveal) ถือเป็น update** และถูกบันทึกลง activity log ทุกครั้ง · ใบอนุญาต INF หมดอายุ = ซ่อนปุ่มดู
  (backend ตอบ 403 ทั้ง reveal / regenerate / toggle)
- **secret ห้ามเข้า React Query cache** — GET ไม่คืน secret; reveal เป็น mutation ที่ถือค่าไว้ใน state ชั่วคราว
  ของ component แล้วทิ้งเมื่อปิด ห้ามใส่ใน `queryClient` / localStorage / log
- รูปแบบ response, กติกา Dr/Cr และขั้นตอน deploy อยู่ที่ BE: `docs/external-api/inventory-postings.md`
  (รีโป `carmen-turborepo-backend-v2`) · ลำดับ deploy: BE (micro-business ต้องตั้ง env `SECRET_ENCRYPTION_KEY` ไม่งั้น create/regenerate/reveal ตอบ 500) + allowlist `buApiKey.*` ก่อน FE
