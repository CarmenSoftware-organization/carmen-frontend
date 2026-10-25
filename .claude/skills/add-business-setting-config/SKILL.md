---
name: add-business-setting-config
description: Use when adding a new configuration option or section to the /system-admin/default-setting page in carmen-frontend — a new config key (boolean toggle or enum dropdown) and/or a new named section (like PR / SI / PO) that persists per business unit.
---

# Add a Business Setting config module

## Overview

Config options on `/system-admin/default-setting` are **frontend-seeded**: they live in a
registry, not the backend schema. Adding one is (almost always) **registry data + i18n only** —
no component, hook, endpoint, or form-schema changes. The value persists in the business unit's
`config` array via the existing `PATCH /api/business-units`.

Reuse path per datatype:
- `boolean` → renders a **Switch** (view = Yes/No)
- `enum` → renders a **Select**, with optional per-option visibility conditioned on the BU's
  `calculation_method`

## When to use

- Adding a new config key like `pr.allow-duplicate.product` (boolean) or `si.cost-from` (enum)
- Adding a new section header (e.g. `[PO]`) that groups config keys
- NOT for config that must be enforced/used by a real backend flow — this skill covers the
  UI + persistence of the setting only

## Files you touch

| File | Change |
|---|---|
| `routes/system-admin/company-profile/company-profile-config-registry.ts` | add/extend a `CONFIG_SECTIONS` entry |
| `messages/en.json` + `messages/th.json` | add i18n under `defaultSetting.sections.*` and `defaultSetting.config.*` |
| `routes/system-admin/company-profile/company-profile-config-registry.test.ts` | add a registry test |

**Do not touch** `company-profile-ui.tsx` (ConfigField), `default-setting/default-setting-component.tsx`
(where the registry is rendered), `company-profile-form-schema.ts` (`mergeSeededConfig`/
`buildPatch`), hooks, or the endpoint — they already handle every datatype.

Note: the registry file lives in `company-profile/` (not `default-setting/`) because
`company-profile-form-schema.ts` consumes its `SEEDED_ITEMS`, but the config it defines
renders on the `/system-admin/default-setting` page, under the `defaultSetting` i18n
namespace.

## Recipe

### 1. Registry entry (`CONFIG_SECTIONS`)

Add a new section object, or append an item to an existing section's `items`. Boolean example:

```ts
{
  id: "po",                          // internal id, lowercase
  titleKey: "sections.po",           // i18n key (short header, e.g. "PO")
  descKey: "sections.poDesc",
  items: [
    {
      key: "po.group-by-pr-comment", // real backend key
      datatype: "boolean",
      defaultValue: "false",         // string always; boolean default = "false"
      label: "Group by PR comment",  // canonical EN — PERSISTED to backend, locale-independent
      labelKey: "config.poGroupByPrComment", // i18n key for DISPLAY (relative to defaultSetting)
    },
  ],
}
```

Enum config adds `options` (order = display order). `visibleWhenCalcMethod` hides an option
unless `data.calculation_method` equals it — but a stored value is never dropped:

```ts
{
  key: "si.cost-from",
  datatype: "enum",
  defaultValue: "last_cost",         // must be a value that's always available
  label: "Default price for added items",
  labelKey: "config.siCostFrom",
  options: [
    { value: "average", labelKey: "config.siCostFromOptions.average", visibleWhenCalcMethod: "average" },
    { value: "last_receiving", labelKey: "config.siCostFromOptions.lastReceiving" },
    { value: "last_cost", labelKey: "config.siCostFromOptions.lastCost" },
  ],
}
```

Types are `ConfigSection` / `SeededConfigItem` / `ConfigOption` (exported from the same file).

Naming & conventions:
- `id` = lowercase section id; append the section object to the end of `CONFIG_SECTIONS`
  (array order = on-screen render order on the Default Setting page — this page renders
  only registry sections, no built-in General/Company sections; those live on the separate
  Company Profile page).
- `key` / option `value` = canonical `snake_case` (locale-independent, stored in the backend
  verbatim). Note real keys may keep dots/hyphens (`pr.allow-duplicate.product`).
- `labelKey` = `config.` + **camelCase of the key** (drop the `<namespace>.` prefix):
  `po.group-by-pr-comment` → `config.poGroupByPrComment`, `si.cost-from` → `config.siCostFrom`.
- `label` (canonical EN) is stored in the registry and persisted; the DISPLAYED label comes from
  i18n (`labelKey`). Keep `label` locale-independent so switching locale never marks the form
  dirty. (No test enforces `label` == the en.json string — keep them consistent by hand.)

### 2. i18n — BOTH `messages/en.json` and `messages/th.json`

Under `defaultSetting`:
- `sections.<id>` = short header (usually the acronym itself); `sections.<id>Desc` = a full
  sentence. You must supply BOTH locales — translate the section name/description yourself if the
  request only gave you a Thai label for the config value. Real example (`po`):
  - en: `sections.po` = `"PO"`, `sections.poDesc` = `"Purchase Order settings for this business unit."`
  - th: `sections.po` = `"PO"`, `sections.poDesc` = `"การตั้งค่า Purchase Order ของหน่วยธุรกิจนี้"`
- `config.<labelKeyLeaf>` (the config's display label) — en + th
- enum only: nested `config.<...>Options.<optKey>` for each option — en + th

Keep Thai diacritics exact; keep JSON valid (watch trailing commas when appending).

### 3. Registry test (`company-profile-config-registry.test.ts`)

Add a `describe` asserting the item's shape (datatype, defaultValue, labelKey; `options`
undefined for boolean, or the option values/order + gate for enum). Follow the existing
`"PR config registry"` / `"SI config registry"` blocks.

## Verify (all must pass)

```bash
bunx tsc --noEmit                                    # 0 errors
bun test:run routes/system-admin/company-profile/    # all pass (registry test lives here)
bun run build                                        # ✓ built
```

## Gotchas

- **Section-count test:** the grouping test asserts
  `expect(groups.sections).toHaveLength(CONFIG_SECTIONS.length)`. Keep it derived from
  `CONFIG_SECTIONS` — never hardcode a number (it breaks on every future addition).
- **`mergeSeededConfig` tests assert per-key** (`.find`/`.filter`/`.some`), not the whole merged
  array — do the same for any new schema test so it survives registry growth.
- **enum `defaultValue`** must be an always-visible option (not a conditional one like `average`).
- The seeded item is NOT sent to the backend until the user actually changes it (untouched →
  `buildPatch` omits `config`).
- `bun run build` in a clean checkout / CI needs `BUILD_CONFIG_FILE=config.sample.json` because
  `public/config.prod.json` is gitignored (see the CI `verify` job / `vite.config.ts`).

## Reference

A plain boolean/enum that reuses the existing rendering is a direct change. Anything that needs
new rendering or logic (a brand-new datatype, novel conditional behavior) warrants a short spec
via brainstorming first.

Prior examples and full designs:
`docs/superpowers/specs/2026-07-09-business-setting-{pr,si,po}-config-section-design.md`
(PR #42 boolean, PR #43 enum + conditional, PR #45 boolean).
