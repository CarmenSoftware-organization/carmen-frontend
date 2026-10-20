# External export: Chart of Account mapping only + Accounting settings page

Date: 2026-10-20 · Repos: carmen-turborepo-backend-v2, carmen-inventory-frontend-react

## Intent

The External interface page (`/system-admin/interface/export/external`) carries two blocks
besides API access:

- **Vendor fallbacks** — `default_account_code` / `default_department_code` in app-config key
  `interface_export_external`. No export endpoint reads them; they are dead inputs, kept alive
  only because the shared `InterfaceAccountingSchema` requires them.
- **Default accounts** — `gl_setting.ap_control_account_id` and `gl_setting.input_vat_account_id`.
  These do change the export: the AP account resolver walks *mapping override → vendor's AP
  account → BU default* (`micro-business/src/master/account-mapping/account-mapping.resolver.ts:77`),
  and the AP export fills `tax_account_code` from `input_vat_account_id`.

The user wants the export to take accounts **from the Chart of Account mapping only**. When the
mapping does not name an account, the line must say so — the export must not guess one from the
vendor or the BU.

The input VAT account is **set in the external accounting system**, not by us. The export
sends tax amounts only.

`gl_setting` is still needed by our own Accounting module (AP Invoice posting uses
`vendor → ap_control_account_id` and `input_vat_account_id`, `ap/ap-invoice/ap-invoice.service.ts:1122`,
`ap/ap-invoice/ap-invoice.posting.ts:615`). The External page is today the only UI that edits
`gl_setting`, so the user chose to **move it to a new Accounting settings page that edits all
of `gl_setting`** (15 fields), not just the two that leave the External page.

## Goals

1. **AP account resolution (export + mapping preview):** `mapping_type === 'AP'` resolves to
   `override` or `missing_ap_account` — the `vendor` and `bu_default` steps are removed.
   **GL adjustment** (`movement === 'adjustment'`) likewise resolves to `override` or
   `missing_adjustment_account` — the `adjustment_type` step (the adjustment type's own
   `chart_of_accounts_id`) is removed too (user's decision: "mapping อย่างเดียว").
   This resolver also feeds the Chart of Account mapping page's preview, which therefore stops
   showing "Default · vendor" / "Default · BU setting" / "Default · adjustment type" sources.
   The non-adjustment GL chain (override → item group / sub-category / category / location
   levels) is unchanged — those levels are part of the mapping itself.
   **The AP rule has a second copy** in SQL: `statusCte()` in
   `master/account-mapping/account-mapping.service.ts:146` does
   `COALESCE(m.account_code, buDefaultApCode)` and `findAll` (≈ line 256) feeds it `buDefaultAp`.
   It also has `WHEN m.movement::text = 'adjustment'` joining `tb_adjustment_type` (≈ line 147/167).
   It drives the mapping list's incomplete filter and counts — change it together with the
   resolver, or the list and the preview/export disagree. After both changes `loadContraCodes`
   (vendor / buDefaultAp / inputVat / adjustmentType) has no remaining reader on this path —
   remove it and the `contra` input rather than leave dead lookups.
2. **"Missing" = flagged, not failed.** Unchanged behaviour of the export: a line whose account
   cannot be resolved is still returned with `unmapped: true` and an `issues[]` entry. The
   request does not error. (User said "แจ้งว่าบรรทัดนั้นขาดบัญชีแล้วหยุด"; confirmed in chat that
   this means flag-and-don't-guess, not reject the request.)
3. **No tax account in the AP export.** Remove `tax_account_code` from `ApInvoiceLine`
   (micro-business type, gateway serializer + swagger DTO), remove the
   `missing_input_vat_account` issue and the `'tax'` value of `ApIssue.account`. A taxed line is
   no longer `unmapped` merely for lacking a VAT account. `tax_type`, `tax_rate`, `tax_amount`,
   `base_tax_amount` and `tax_cost_center_code` stay.
4. **External page:** remove the Vendor fallbacks section and the Default accounts section
   (`external-gl-defaults-section.tsx` and its handle/binding plumbing in
   `external-interface-form.tsx`). What remains: header/status, API access, API docs.
   Whether the page still needs its Edit/Save cycle at all once no editable fields remain is
   left to the builder (see below).
5. **Backend schema for `interface_export_external`:** stop requiring
   `default_account_code` / `default_department_code`. Give `interface_export_*` its own schema
   instead of reusing `InterfaceAccountingSchema` (other accounting brands keep the required
   fields). Existing stored values are left in the DB untouched.
6. **New page `/accounting/settings`** ("Accounting settings") that reads and writes the whole
   `gl_setting` app-config key, grouped:
   - **General ledger:** `fiscal_year_start_month` (required, 1–12), `retained_earnings_account_id`,
     `reversal_prefix_id`, `auto_jv_prefix_id`, `allow_post_to_closed_period`
   - **Accounts payable:** `ap_control_account_id`, `input_vat_account_id`,
     `wht_payable_account_id`, `advance_deposit_account_id`, `realized_fx_gain_account_id`,
     `realized_fx_loss_account_id`, `ap_jv_prefix_id`
   - **Accounts receivable:** `ar_control_account_id`, `output_vat_account_id`, `ar_jv_prefix_id`

   Account fields use `LookupChartOfAccountById`; prefix fields pick from GL JV prefixes
   (`API_ENDPOINTS.GL_JV_PREFIXES`, the set managed at `routes/config/jv-prefix`); the
   boolean is a switch. Hint text on `ap_control_account_id` / `input_vat_account_id` should
   say they are used by **AP Invoice posting** (not by the External export) so nobody expects
   them to affect the export again.
7. Menu: a leaf under the **General Ledger** group in `constant/module-list.ts`, after
   Allocation Voucher, `licenseFeature: "accounting.gl"` (existing key — no new license key, so
   no lock-on-deploy). No `permission` field, matching every other Accounting leaf. Write access
   is whatever the gateway already enforces for `config:app-config` (`configuration.app_config`).
8. FE snapshots/docs: regenerate `lib/external-api/openapi.json` + update `openapi.th.json`
   for the removed field/issue code; remove `sourceVendor` / `sourceBuDefault` handling from
   `routes/config/chart-of-account-mapping/coam-cells.tsx` and the `ResolveSource` union in
   `types/chart-of-account-mapping.ts`; drop now-unused i18n keys (`glDefaults*`,
   `apControlAccount`, `inputVatAccount`, `defaults*` under `systemAdmin.interface.export` —
   check each is not used by another brand's form before deleting).

## Non-goals

- AP Invoice posting (`ap/ap-invoice/*`) keeps its own `vendor → ap_control_account_id`
  fallback and its use of `input_vat_account_id`. Not touched.
- Vendor master's AP account field (`tb_vendor.ap_chart_of_accounts_id`) stays — AP Invoice uses it.
- Other accounting interface brands (Carmen GL, generic accounting forms) keep their vendor
  fallback fields and required schema.
- GL journals export: changes only through the adjustment rule above.
- No data migration; no deletion of stored `default_account_code` / `gl_setting` values /
  `tb_adjustment_type.chart_of_accounts_id`.
- **No backfill of AP or adjustment overrides (user's decision).** On deploy, every AP mapping
  row and every GL adjustment row without an override turns incomplete and every AP export line is flagged `unmapped` until users map the
  rows themselves (the mapping page's existing batch edit covers this). This is expected, not a
  regression — the release note must say so.

## Anti-goals

- The export silently picking an account the mapping did not name — under any path.
- Saving the Accounting settings page wiping `gl_setting` fields the form does not show
  (the PUT replaces the whole object). The new page owns all 15 schema fields, but must still
  merge onto a **fresh** server read before PUT and preserve any unknown keys, exactly like
  `external-gl-defaults-section.tsx` does today (fetch with `staleTime: 0`, 404 → create with
  `fiscal_year_start_month`).
- Sending `null` for a cleared optional field — the backend zod is `.uuid().optional()`; clearing
  means deleting the key.

## Constraints

- **Deploy order: BE before FE.** If FE ships first the External page saves an object without
  `default_account_code` → 400 from the old schema. The backend change is backward compatible
  with the old FE (fields become optional, export field removal only affects external callers).
- The external API (BE #861) is merged but **not yet deployed** and has no consumers, so
  removing `tax_account_code` breaks nobody. If it gets deployed before this lands, this
  becomes a breaking contract change — re-check before merge.
- Backend tests use jest (`bun test` is wrong there); resolver spec
  `account-mapping.resolver.spec.ts` encodes the vendor/bu_default chain and must change.
- Per user preference: no new test files unless asked; existing suites must pass; typecheck +
  lint required. Update existing specs that assert the removed behaviour.
- Route colocated per repo convention: `routes/accounting/settings/accounting-settings.route.tsx`.
- Dark mode + EN/TH i18n required on the new page (ICU messages: no `{}`/`<word>` literals).

## Calls made by the designer (not discussed with the user)

- **External page stops saving `interface_export_external`.** With both editable sections gone
  there is nothing to save; the page keeps only the live API zone. The new `interface_export_*`
  schema still uses `.passthrough()` so any other writer cannot strip stored keys.
- **`fiscal_year_start_month` is editable** on the new page, with a warning hint that changing
  it after GL periods exist shifts period boundaries. No backend lock this round.
- **Write gate:** the page reads with whatever the menu leaf allows (`accounting.gl`); the Save
  button follows the existing app-config write check (`configuration.app_config` permission +
  license via the repo's `canWrite`/`useCan`). Without it the page renders read-only rather
  than letting Save 403.
- **`gl-jv-prefix.countReferences`** gains `ap_jv_prefix_id` and `ar_jv_prefix_id`, so a prefix
  picked on the new page cannot be deleted unwarned (small backend fix, in scope).

- **Adjustment Type form's account field** (`routes/config/adjustment-type/adjustment-type-dialog.tsx`)
  becomes a dead input — nothing else in micro-business reads `tb_adjustment_type.chart_of_accounts_id`.
  Remove the field from the dialog (keep the DB column and API field). Unlike the vendor's AP
  account, which AP Invoice still uses and so stays on the vendor form.

## Left to the builder

- Exact page component composition (follow existing settings pages such as
  `/system-admin/default-setting` / `SettingSection` patterns).
- Whether the External page keeps its Edit/Save cycle with nothing left to edit, or becomes
  a read-only page with only the live API zone.
- Whether `loadContraCodes` still needs to read `gl_setting` at all after the AP fallback goes
  (it may still be needed for other contra codes — remove only what becomes dead).
- Field labels/hints wording, section order inside each group.
