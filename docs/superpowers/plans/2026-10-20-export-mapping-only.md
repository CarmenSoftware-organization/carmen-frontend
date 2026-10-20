# Export: Chart of Account mapping only + Accounting settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AP/GL export and the mapping page take contra accounts from the Chart of Account mapping only (no vendor / BU default / adjustment-type fallback, no tax account), the External page loses its two config sections, and a new `/accounting/settings` page edits all of `gl_setting`.

**Architecture:** Backend first (`carmen-turborepo-backend-v2`, micro-business + gateway): shrink the resolver and its SQL twin, drop the tax account from the AP export, loosen the `interface_export_*` schema. Frontend second (`carmen-inventory-frontend-react`): strip the External page, update mapping-page types/labels, drop the adjustment-type account field, add the settings page.

**Tech Stack:** NestJS + Prisma raw SQL + zod (BE, jest) · React 19 + React Router 7 + TanStack Query + react-hook-form/zod + use-intl (FE, vitest).

**Spec:** `docs/superpowers/specs/2026-10-20-export-mapping-only-design.md` (read it first — it holds the why and the GL posting rules table).

## Global Constraints

- **User preference: do not write new test files and skip "write failing test" steps.** Do update existing specs/tests that assert removed behaviour so the suites stay green. Type-check + lint are mandatory.
- BE tests: `npx jest <path>` from `apps/micro-business` or `apps/backend-gateway` — never `bun test` there.
- FE: `bun run typecheck`, `bunx eslint <files>`, `bun test:run <path>`.
- Commit messages in Thai, conventional prefix (e.g. `refactor(account-mapping): …`). No squash merge later.
- Branch `feature/export-mapping-only` in **both** repos (FE branch already exists with the spec; BE: create from up-to-date `main`).
- Product-side chain is **unchanged**: override → item_group → sub_category → category (by location kind). Cost center unchanged: override → location.
- AP contra = override only, else `missing_ap_account`. GL adjustment contra = override only, else `missing_adjustment_account`.
- Do not touch `ap/ap-invoice/*`, `ap/ap-payment/*`, `ar/*` (they read `gl_setting` themselves via `GlPostingService.getSetting()`).
- No migration, no deletion of stored values.
- Deploy order BE → FE (FE-first makes nothing 400 any more since the External page stops saving, but the mapping page would show stale sources).
- FE i18n: every new key in both `messages/en.json` and `messages/th.json`; no `{}` or `<word>` literals in messages.
- FE module boundary: `routes/accounting/` must not import from `routes/config/` or `routes/system-admin/`.

## Review Focus

1. **List counts vs preview disagree** — the mapping list's "incomplete" count (SQL `statusCte`) must equal the number of rows whose preview shows an issue. Owned by Task 1: update the service spec's expected SQL/resolution to the new rule.
2. **Clearing a field on the settings page** must delete the key, never send `null` (backend `.uuid().optional()` rejects null). Owned by Task 6 — `toGlSettingValue` covers it.
3. **Saving the settings page on a BU with no `gl_setting` (404)** must create it with `fiscal_year_start_month` from the form, not crash. Owned by Task 6.
4. **Saving the settings page must keep keys it does not know** (another writer may add one) — merge onto a fresh server read. Owned by Task 6.
5. **A taxed AP line with every account mapped** must come back `unmapped: false` and `issues: []`. Owned by Task 2: adjust the existing AP export spec case that expected `missing_input_vat_account`.

---

## Backend — `carmen-turborepo-backend-v2`

### Task 1: Resolver + SQL twin = mapping only for AP and GL adjustment

**Files:**
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.resolver.ts`
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.service.ts` (`ContraCodes` ≈ :58, `statusCte` ≈ :120–:172, `findAll` ≈ :255, `loadContraCodes` ≈ :326–:386, `contraOf` ≈ :388–:406, callers ≈ :517 and ≈ :888)
- Modify: `apps/micro-business/src/inventory/accounting-export/export-core.service.ts` (remove `inputVatCode` ≈ :335 only if Task 2 is done in the same branch — otherwise leave to Task 2)
- Modify: `apps/backend-gateway/src/common/dto/account-mapping/account-mapping.serializer.ts` (source enum ≈ :28)
- Modify: `apps/backend-gateway/src/application/account-mapping/swagger/response.ts` (source / issue enums + descriptions)
- Modify: `apps/micro-business/CLAUDE.md` (any line describing the vendor/bu_default/adjustment_type chain)
- Test (update): `account-mapping.resolver.spec.ts`, `account-mapping.service.spec.ts`

**Interfaces:**
- Produces:
  - `AccountSource = 'override' | 'item_group' | 'sub_category' | 'category'`
  - `AccountIssue` unchanged (`missing_ap_account`, `missing_adjustment_account` stay)
  - `ResolveInput` **without** `contra`
  - `statusCte(mappingType: MappingType): Prisma.Sql` (no second parameter)
  - `ContraCodes`, `loadContraCodes`, `contraOf` deleted — unless Task 2 still needs `inputVat`; Task 2 deletes the last reader, so delete them in whichever task lands second.

- [ ] **Step 1: Branch** — `git switch main && git pull && git switch -c feature/export-mapping-only`
- [ ] **Step 2: Resolver** — in `resolveAccountMapping`: AP branch = `override ? {source:'override'} : {code:null, source:null, issue:'missing_ap_account'}`; adjustment branch = same with `missing_adjustment_account`. Remove `contra` from `ResolveInput`, the three sources from `AccountSource`, and rewrite the header comment (lines 1–9) to the new order.
- [ ] **Step 3: SQL twin** — in `statusCte` the AP and adjustment `WHEN` arms become `NULLIF(m.account_code, '')`; drop the `buDefaultApCode` parameter and the `adj` / `at_coa` joins; update the JSDoc. In `findAll` remove the `buDefaultAp` lookup.
- [ ] **Step 4: Callers** — remove `contra:` from the two `resolveAccountMapping({...})` calls and the `loadContraCodes` calls feeding them. If `MappingKey.vendor_id` is then unread anywhere, remove it from `MappingKey` and from the builders that set it (`grep -rn "vendor_id" src/inventory/accounting-export src/master/account-mapping`). Keep `adjustment_type_id` — it is part of the mapping row key.
- [ ] **Step 5: Gateway enums** — serializer + swagger: account `source` enum = `override | item_group | sub_category | category`; issue descriptions for `missing_ap_account` / `missing_adjustment_account` say "no account in the mapping" (not "BU default" / "adjustment type"). Also `grep -rni "adjustment type\|bu default\|vendor's AP" apps/backend-gateway/src/external-api` and fix any ext-API swagger text (GL journals / AP invoices) that still describes the old fallbacks — Task 2 Step 5 regenerates the doc from it.
- [ ] **Step 6: Update specs** — in `account-mapping.resolver.spec.ts` replace cases that expect `vendor` / `bu_default` / `adjustment_type` sources with: AP + override → override; AP without override → `missing_ap_account` (even when the vendor has an account); adjustment without override → `missing_adjustment_account`. In `account-mapping.service.spec.ts` drop `getSetting` / vendor / adjustment-type mocks that only fed contra.
- [ ] **Step 7: Verify**
  Run: `cd apps/micro-business && npx tsc --noEmit -p . && npx jest src/master/account-mapping src/inventory/accounting-export`
  Run: `cd apps/backend-gateway && npx tsc --noEmit -p .`
  Expected: no type errors; all listed suites pass.
- [ ] **Step 8: Commit** — `refactor(account-mapping): บัญชี AP และ adjustment มาจาก mapping อย่างเดียว ตัด fallback vendor / BU / adjustment type`

### Task 2: AP export drops the tax account

**Files:**
- Modify: `apps/micro-business/src/inventory/accounting-export/accounting-export.types.ts` (`ApAccountRole` :80, `tax_account_code` :125)
- Modify: `apps/micro-business/src/inventory/accounting-export/ap-invoice/ap-invoice.service.ts` (:87–:170)
- Modify: `apps/micro-business/src/inventory/accounting-export/export-core.service.ts` (delete `inputVatCode`)
- Modify: `apps/backend-gateway/src/external-api/ap-invoice/swagger/response.ts` (:10, :16, :21, :150–:154), `swagger/examples.ts` (:62, :86, :147)
- Regenerate: `docs/external-api/openapi.json`
- Test (update): AP export specs under `src/inventory/accounting-export/ap-invoice/` that assert `tax_account_code` or `missing_input_vat_account`

**Interfaces:**
- Consumes: Task 1 (`ResolveInput` without contra).
- Produces: `ApAccountRole = 'debit' | 'ap'`; `ApInvoiceLine` without `tax_account_code`; `ApInvoiceService.finalize(d, resolved)` (no `inputVat` param).

- [ ] **Step 1:** Remove `tax_account_code` from `ApInvoiceLine`, `'tax'` from `ApAccountRole`, the `inputVat` fetch/param and the `add('tax', 'missing_input_vat_account')` line. Keep `tax_type`, `tax_rate`, `tax_amount`, `base_tax_amount`, `tax_cost_center_code`.
- [ ] **Step 2:** Delete `ExportCoreService.inputVatCode`; then delete `ContraCodes` / `loadContraCodes` / `contraOf` from `account-mapping.service.ts` if Task 1 left them for this reader, and the now-unused `GlPostingService` constructor dependency of `AccountMappingService` (also its module provider import if nothing else needs it).
- [ ] **Step 3:** Gateway swagger: `account` enum `['debit','ap']`; remove `missing_input_vat_account` from the reason list; delete the `tax_account_code` property and the three example values.
- [ ] **Step 4:** Update the AP export specs — the taxed-line case expects no `tax_account_code` key, `issues: []`, `unmapped: false` when debit/AP accounts resolve (Review Focus 5).
- [ ] **Step 5: Regenerate the integrator doc** — `cd apps/backend-gateway && bun run swagger:export-external`; confirm `grep -c tax_account_code ../../docs/external-api/openapi.json` prints `0`.
- [ ] **Step 6: Verify** — `npx tsc --noEmit -p .` in both apps; `npx jest src/inventory/accounting-export src/master/account-mapping` (micro-business). Expected: pass.
- [ ] **Step 7: Commit** — `feat(ext-api): AP export เลิกส่งบัญชีภาษีซื้อ ระบบบัญชีภายนอกตั้งเอง`

### Task 3: `interface_export_*` schema + JV prefix reference check

**Files:**
- Modify: `apps/micro-business/src/app-config/app-config.service.ts` (schema switch ≈ :553–:565, near `InterfaceAccountingSchema` ≈ :20–:30)
- Modify: `apps/micro-business/src/gl/gl-jv-prefix/gl-jv-prefix.service.ts` (`countReferences` ≈ :190–:197)
- Test (update): `app-config.service.spec.ts` (:840, :882 if they target `interface_export_*`)

**Interfaces:**
- Produces: `InterfaceExportSchema` — `z.object({ enabled: z.boolean().optional() }).passthrough()` (no required fields); used for `/^interface_export(_.+)?$/`.

- [ ] **Step 1:** Add `InterfaceExportSchema` and point the `interface_export` arm at it; fix the inline comment that says it reuses the accounting schema.
- [ ] **Step 2:** `countReferences`: also count `value.ap_jv_prefix_id === id` → `refs['gl_setting.ap_jv_prefix_id'] = 1` and `ar_jv_prefix_id` likewise.
- [ ] **Step 3:** Update spec cases that expect `interface_export_external` to reject missing `default_account_code`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit -p . && npx jest src/app-config src/gl/gl-jv-prefix`. Expected: pass.
- [ ] **Step 5: Commit** — `fix(app-config): interface_export ไม่บังคับ vendor fallback และนับ prefix ของ AP/AR ก่อนลบ`
- [ ] **Step 6:** Push the BE branch and open a PR (English title/body) listing deploy note: "BE before FE; after deploy every AP row and GL adjustment row without an override shows incomplete — expected".

---

## Frontend — `carmen-inventory-frontend-react` (branch `feature/export-mapping-only`)

### Task 4: External page = live API zone only

**Files:**
- Delete: `routes/system-admin/interface/external-gl-defaults-section.tsx`
- Modify: `routes/system-admin/interface/external-interface-form.tsx`
- Modify: `routes/system-admin/interface/interface-registry.ts` (:85 comment)
- Modify: `routes/system-admin/interface/CLAUDE.md` (any mention of the gl_setting section)
- Modify: `messages/en.json`, `messages/th.json` — remove `systemAdmin.interface.export.{glDefaults, glDefaultsDesc, apControlAccount, inputVatAccount, glLoadError, partialSaveFailed}` after `grep -rn` confirms no other reader. Keep `systemAdmin.interface.accounting.defaults*` (other brands use them).
- Copy: BE `docs/external-api/openapi.json` → `lib/external-api/openapi.json`; then `bun run docs:i18n-check` and delete overlay entries in `lib/external-api/openapi.th.json` for `tax_account_code`; edit the TH/EN reason-list text (≈ :299–:300) to drop `missing_input_vat_account`.

**Interfaces:**
- Consumes: nothing from other FE tasks.
- Produces: `ExternalInterfaceForm` default export, no props, no `useForm`, no Save/Cancel.

- [ ] **Step 1:** Rewrite `ExternalInterfaceForm` to render the page title/description (`te("brand.external")`, `te("desc")`), then `LiveZoneDivider` (when `showApiZone`), `ExternalApiAccessSection`, `ExternalApiDocsSection`. No `useInterfaceConfig(CONFIG_KEY)`, no `AccountingFields`, no GL handle plumbing. If `InterfacePageLayout` cannot render without `onSave`, do not fake a save — render the same header markup it uses (extract a small `InterfacePageHeader` from `interface-page-layout.tsx` if needed and use it in both). Update the JSDoc.
- [ ] **Step 2:** Delete `external-gl-defaults-section.tsx`; fix the registry/CLAUDE.md comments; remove the i18n keys.
- [ ] **Step 3:** Copy openapi.json, run `bun run docs:i18n-check`, clean `openapi.th.json`.
- [ ] **Step 4: Verify** — `bun run typecheck && bunx eslint routes/system-admin/interface && bun test:run routes/system-admin/interface lib/__tests__`. Expected: pass (adjust `interface-list.test.tsx` only if it asserted the removed sections).
- [ ] **Step 5: Commit** — `refactor(interface): หน้า External เหลือแค่ส่วน API ตัด Vendor fallbacks และบัญชีตั้งต้นออก`

### Task 5: Mapping page types + labels

**Files:**
- Modify: `types/chart-of-account-mapping.ts` (:19–:27)
- Modify: `routes/config/chart-of-account-mapping/coam-cells.tsx` (`SOURCE_KEY` :19–:28, `sourceHref` :53–:72)
- Modify: `messages/en.json` / `th.json` under the mapping block (≈ en :1727–:1740)

**Interfaces:**
- Produces: FE `AccountSource = "override" | "item_group" | "sub_category" | "category"` (matches Task 1).

- [ ] **Step 1:** Shrink the union and `SOURCE_KEY`; delete the `bu_default` / `adjustment_type` cases and the vendor comment in `sourceHref`.
- [ ] **Step 2:** Remove `sourceVendor`, `sourceBuDefault`, `sourceAdjustmentType`. Reword (en / th):
  - `issueMissingApAccount`: "No AP account in the mapping — set one on this row" / "ยังไม่ได้ผูกบัญชีเจ้าหนี้ใน mapping — กำหนดที่แถวนี้"
  - `issueMissingAdjustmentAccount`: "No account in the mapping for this adjustment — set one on this row" / "ยังไม่ได้ผูกบัญชีของรายการปรับปรุงนี้ใน mapping — กำหนดที่แถวนี้"
- [ ] **Step 3: Verify** — `bun run typecheck && bunx eslint routes/config/chart-of-account-mapping types && bun test:run routes/config/chart-of-account-mapping`. Fix existing tests that use removed sources.
- [ ] **Step 4: Commit** — `refactor(coam): ตัดที่มาของบัญชีแบบ vendor / BU / adjustment type`

### Task 6: Accounting settings page (`/accounting/settings`)

**Files:**
- Create: `routes/accounting/settings/accounting-settings.route.tsx` (`export function Component`)
- Create: `routes/accounting/settings/accounting-settings-form.tsx`
- Create: `routes/accounting/settings/gl-setting-value.ts` (pure mapping helpers)
- Create: `routes/accounting/settings/use-gl-jv-prefix-options.ts`
- Modify: `routes/router.tsx` (accounting children ≈ :861, after allocation-voucher)
- Modify: `constant/module-list.ts` (generalLedger subModules ≈ :178, after `allocationVoucher`)
- Modify: `constant/permissions.ts` (`configuration` block ≈ :29) — add `app_config: crud("configuration.app_config")` (exists in DB: `seed.permission.data.ts:1286` view/create/update/delete)
- Modify: `messages/en.json`, `messages/th.json` — `modules.accountingSettings` ("Settings" / "ตั้งค่า") and a new `accounting.settings` block
- Test (update only if they enumerate GL leaves): `constant/accounting-navigation.test.ts`, `constant/module-list.*.test.ts`

**Interfaces:**
- Consumes: `useInterfaceConfig` is in `routes/system-admin/` — **do not import it**. Use `useAppConfigByKey(key)`, `fetchAppConfigByKey(buCode, key)`, `useUpsertAppConfig()` from `@/hooks/use-app-config`; `LookupChartOfAccountById` from `@/components/lookup/lookup-chart-of-account-by-id`; `SettingSection` + `Field`/`FieldLabel`; `useCan()` (`can`, `canWrite`).
- Produces:
  - `GL_SETTING_KEY = "gl_setting"`
  - `type GlSettingForm = { fiscal_year_start_month: number; allow_post_to_closed_period: boolean } & Record<GlUuidField, string | null>`
  - `GL_UUID_FIELDS` — readonly tuple of the 14 uuid keys: `retained_earnings_account_id, reversal_prefix_id, auto_jv_prefix_id, ap_control_account_id, input_vat_account_id, wht_payable_account_id, advance_deposit_account_id, realized_fx_gain_account_id, realized_fx_loss_account_id, ap_jv_prefix_id, ar_control_account_id, output_vat_account_id, ar_jv_prefix_id`, plus `GlUuidField` = its element type
  - `toGlSettingForm(value: Record<string, unknown> | undefined): GlSettingForm` — non-string/empty → null; missing month → 1; missing boolean → false
  - `toGlSettingValue(form: GlSettingForm, fresh: Record<string, unknown> | undefined): Record<string, unknown>` — `{...fresh}`, then for each uuid field delete the key and re-set only when non-null; always set month and boolean
  - `useGlJvPrefixOptions(): { options: { value: string; label: string }[]; isLoading: boolean }` — `GET API_ENDPOINTS.GL_JV_PREFIXES(buCode)`, query key `["accounting-master", "jv-prefixes", buCode]` (same key as `routes/config/jv-prefix` so caches share), label `${code} — ${description}`

- [ ] **Step 1: Helpers** — write `gl-setting-value.ts` per the Interfaces block (Review Focus 2, 4).
- [ ] **Step 2: Prefix hook** — `use-gl-jv-prefix-options.ts`; unwrap `Array.isArray(json) ? json : json.data ?? []` like `jv-prefix-page.tsx:49`.
- [ ] **Step 3: Form** — `AccountingSettingsForm`: RHF + zod (`fiscal_year_start_month` int 1–12 required; uuid fields `string().nullable()`); three `SettingSection`s in the spec's order (General ledger / Accounts payable / Accounts receivable); account fields = `LookupChartOfAccountById`, prefix fields = the repo's select primitive fed by `useGlJvPrefixOptions` with a clear option, boolean = switch, month = select of 12 localized month names. Save: `fetchQuery({ queryKey: [QUERY_KEYS.APP_CONFIGS, buCode, GL_SETTING_KEY], queryFn: () => fetchAppConfigByKey(buCode, GL_SETTING_KEY), staleTime: 0 })`; 404 (`ApiError.statusCode === 404`) → `fresh = undefined`; other errors → error toast, abort; then `upsert.mutate({ key: GL_SETTING_KEY, value: toGlSettingValue(values, fresh) })` → success toast + `form.reset(values)`. Load error → `ErrorState` with retry. Use the repo's existing settings-page header/Edit-Save pattern (look at `routes/system-admin/default-setting/default-setting-component.tsx`) and nav guard for dirty state.
- [ ] **Step 4: Write gate** — editable only when `canWrite && can(PERMISSIONS.configuration.app_config.update)`; otherwise render read-only (disabled fields, no Save). Hints (en/th):
  - `fiscal_year_start_month`: "Changing this after GL periods exist shifts every period boundary." / "ถ้าเปลี่ยนหลังจากมีงวดบัญชีแล้ว ขอบเขตของทุกงวดจะเลื่อนตาม"
  - `ap_control_account_id` + `input_vat_account_id`: "Used by AP Invoice posting. The External export takes accounts from the Chart of Account mapping only." / "ใช้ตอนลงบัญชี AP Invoice — การส่งออก External ใช้บัญชีจาก Chart of Account mapping อย่างเดียว"
  Other labels: builder's wording, in both languages.
- [ ] **Step 5: Wire up** — route `{ path: "settings", lazy: () => import("./accounting/settings/accounting-settings.route") }`; menu leaf `{ name: "accountingSettings", path: "/accounting/settings", licenseFeature: "accounting.gl", icon: Settings }` (lucide `Settings`; no `permission`, matching siblings).
- [ ] **Step 6: Verify** — `bun run typecheck && bunx eslint routes/accounting/settings constant routes/router.tsx && bun test:run constant`. Expected: pass.
- [ ] **Step 7: Manual check (offer to user)** — `bun dev`, open `/accounting/settings` on T02: loads existing values, change one AP account → Save → reload shows it, other `gl_setting` keys intact (compare `GET …/app-config/gl_setting` before/after), clear a field → key gone from the stored value, light + dark, TH + EN.
- [ ] **Step 8: Commit** — `feat(accounting): หน้าตั้งค่า Accounting แก้ gl_setting ครบทุกช่อง`

### Task 7: Adjustment Type dialog drops the account field

**Files:**
- Modify: `routes/config/adjustment-type/adjustment-type-dialog.tsx` (:13 import, :41 type, :69 error map, :81–:106 payload, :172 field)
- Modify: i18n keys used only by that field (grep before deleting)

- [ ] **Step 1:** Remove the `chart_of_accounts_id` form field, its default, its dirty-diff/payload lines and the `GL_ACCOUNT_NOT_POSTABLE` field mapping. Do **not** send `chart_of_accounts_id` at all (stored values stay). Remove the column from `use-adjustment-type-table.tsx` / `adjustment-type-card.tsx` if they display it.
- [ ] **Step 2: Verify** — `bun run typecheck && bunx eslint routes/config/adjustment-type`. Expected: pass.
- [ ] **Step 3: Commit** — `refactor(adjustment-type): ตัดช่องบัญชีออก เพราะไม่มีที่ใดอ่านแล้ว`

### Task 8: Wrap-up

- [ ] **Step 1:** Full FE gate — `bun run typecheck && bun run lint && bun test:run`. Expected: green (or only failures that also fail on `main` — say so with output).
- [ ] **Step 2:** Push the FE branch, open a PR (English) with: link to BE PR, deploy order BE → FE, release-note line "AP and GL adjustment rows without an override now show incomplete until mapped; External page no longer holds account defaults — see Accounting → Settings".
- [ ] **Step 3:** Update memory (`gl-ap-account-mapping.md` or a new note) with: merged/deployed state, BE-before-FE, expected incomplete rows after deploy.
