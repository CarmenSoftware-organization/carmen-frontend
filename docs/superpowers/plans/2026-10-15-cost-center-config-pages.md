# Cost Center / Cost Center Group Config Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มหน้า `/config/cost-center-group` และ `/config/cost-center` (list + dialog CRUD) และกัน backend ไม่ให้ลบ cost center ที่ยังถูกอ้างถึง

**Architecture:** FE ทำตาม pattern `routes/config/credit-term/` ทุกไฟล์ (`ConfigListTemplate` + `ConfigEntityDialog` + `createConfigCrud`) โดยไม่สร้าง abstraction ใหม่ BE เพิ่ม catalog entry `COST_CENTER_IN_USE` และเช็กการอ้างถึงใน `CostCenterService.delete` แบบเดียวกับที่ group ทำอยู่

**Tech Stack:** Vite + React 19 + React Router 7 + TanStack Query/Table + react-hook-form + zod + use-intl (FE) · NestJS + Prisma (BE)

**Spec:** `docs/superpowers/specs/2026-10-15-cost-center-config-pages-design.md`

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (preference ของ user) — ข้ามทุกขั้น "write failing test"; แต่ `typecheck` / `lint` / เทสต์เดิมต้องผ่าน และ subagent ต้องได้รับคำสั่งนี้ตรง ๆ
- Commit message เป็น**ภาษาไทย** (conventional prefix เป็นอังกฤษได้) · PR เป็นภาษาอังกฤษ
- ห้ามสลับ branch ใน working tree หลักของ FE — มีไฟล์ค้างของเซสชันอื่น ใช้ git worktree
- ไม่มี `color_tag`, ไม่แตะ `accounts` / `dimension` / `setAccounts`
- code แก้ได้ทั้งตอนสร้างและแก้ (backend เช็กซ้ำ case-insensitive ให้แล้ว)
- คำไทย: "ศูนย์ต้นทุน" / "กลุ่มศูนย์ต้นทุน"
- ห้ามตั้งสี/ขนาดใหม่ที่ call site — ใช้ primitive จาก `components/ui/` (ดู `docs/DESIGN.md`)
- ไฟล์แปลห้ามมี `{{` `}}` (ICU พัง); placeholder ใช้ `{name}` เดี่ยว
- Deploy: **BE ก่อน FE**

## Review Focus

1. **ลบ cost center ที่ location ใช้อยู่** → ต้องได้ 409 และ toast ข้อความไทย ไม่ใช่ลบสำเร็จ (Task 1 step 5 curl, Task 4 browser)
2. **ลบ group ที่ยังมี cost center** → toast 409 `COST_CENTER_GROUP_IN_USE` (Task 4 browser) — ถ้า toast ไม่ขึ้น ให้แก้ใน Task 4 step 4
3. **BU ที่ยังไม่มี group เลย** เปิด dialog cost center → dropdown ว่าง + ข้อความพร้อมลิงก์ไปหน้า group ไม่ใช่ dialog ค้าง (Task 3 step 6, Task 4)
4. **code ซ้ำ (ต่างตัวพิมพ์)** เช่น `ZZ-TEST-a` vs `ZZ-TEST-A` → backend 409 `*_DUPLICATE_CODE` ขึ้น toast, dialog ไม่ปิด (Task 4)
5. **cost center ที่ group ถูกปิดใช้ (inactive)** เปิดแก้ → dropdown ยังแสดงชื่อ group เดิม (ใช้ `defaultLabel` จาก `cost_center_group_code · name`) ไม่ขึ้นช่องว่าง (Task 3 step 6)

---

## File Structure

**BE (`carmen-turborepo-backend-v2`, branch `fix/cost-center-delete-in-use`)**
- Modify `packages/error-catalog/src/catalog.ts` — entry `COST_CENTER_IN_USE`
- Modify `apps/micro-business/src/master/cost-center/cost-center.service.ts` — `delete()` เช็กการอ้างถึง

**FE (`carmen-inventory-frontend-react`, worktree branch `feature/cost-center-config-pages`)**
- Modify `constant/api-endpoints.ts` — `GL_COST_CENTER_GROUPS`
- Modify `constant/query-keys.ts` — `COST_CENTER_GROUPS`
- Modify `constant/list-page-keys.ts` — `COST_CENTER`, `COST_CENTER_GROUP`
- Modify `constant/permissions.ts` — `cost_center`, `cost_center_group`
- Modify `constant/module-list.ts` — 2 leaf
- Modify `routes/router.tsx` — 2 route
- Modify `messages/en.json`, `messages/th.json`
- Create `types/cost-center-group.ts`; Modify `types/cost-center.ts` (เพิ่ม `note`, `audit`)
- Create `routes/config/shared/use-cost-center-group.ts`
- Create `routes/config/cost-center-group/` — `cost-center-group.route.tsx`, `cost-center-group-component.tsx`, `cost-center-group-dialog.tsx`, `cost-center-group-form-schema.ts`, `cost-center-group-filter-fields.ts`, `cost-center-group-card.tsx`, `use-cost-center-group-table.tsx`
- Create `routes/config/cost-center/` — ชุดเดียวกัน + `lookup-cost-center-group.tsx`

---

### Task 0: เตรียม worktree และ commit spec

**Files:** `docs/superpowers/specs/2026-10-15-cost-center-config-pages-design.md`, `docs/superpowers/plans/2026-10-15-cost-center-config-pages.md` (มีอยู่แล้วใน working tree หลัก ยังไม่ commit)

- [ ] **Step 1: สร้าง worktree จาก `origin/main`**

```bash
cd /Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react
git fetch origin
git worktree add ../carmen-inventory-frontend-react-cost-center -b feature/cost-center-config-pages origin/main
```

- [ ] **Step 2: ย้าย spec + plan เข้า worktree แล้ว commit**

```bash
W=../carmen-inventory-frontend-react-cost-center
mkdir -p $W/docs/superpowers/specs $W/docs/superpowers/plans
mv docs/superpowers/specs/2026-10-15-cost-center-config-pages-design.md $W/docs/superpowers/specs/
mv docs/superpowers/plans/2026-10-15-cost-center-config-pages.md $W/docs/superpowers/plans/
cd $W && bun install
git add docs/superpowers && git commit -m "docs(cost-center): spec และ plan หน้า Cost Center / Cost Center Group"
```

ทุก task FE หลังจากนี้ทำใน `$W`

---

### Task 1: BE — กันลบ cost center ที่ยังถูกอ้างถึง

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อจาก `COST_CENTER_ACCOUNT_NOT_FOUND` ~บรรทัด 1234)
- Modify: `apps/micro-business/src/master/cost-center/cost-center.service.ts` (`delete()` ~บรรทัด 266)

**Interfaces:**
- Produces: HTTP 409 `{ code: "COST_CENTER_IN_USE" }` จาก `DELETE /api/config/:bu_code/cost-centers/:id`

- [ ] **Step 1: branch**

```bash
cd /Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2
git status --short   # ต้องสะอาด ถ้าไม่สะอาด หยุดถาม user
git fetch origin && git switch -c fix/cost-center-delete-in-use origin/main
```

- [ ] **Step 2: เพิ่ม catalog entry** — ต่อท้าย `COST_CENTER_ACCOUNT_NOT_FOUND` ใน `packages/error-catalog/src/catalog.ts`

```ts
  COST_CENTER_IN_USE: {
    code: 'COST_CENTER_IN_USE',
    id: makeId(MODULE.COST_CENTER, 4),
    http_status: 409,
    message_en: 'Cost center is still referenced by locations or account mappings',
    message_th: 'ศูนย์ต้นทุนยังถูกใช้โดยสถานที่หรือการผูกบัญชี',
  },
```

แล้ว build package (micro-business อ่านจาก `dist/`):

```bash
cd packages/error-catalog && bun run build:package && bun run test && cd ../..
```

ถ้ามีไฟล์ reference ที่ commit ไว้ (`git ls-files packages/error-catalog | grep -i reference`) ให้รัน `bun run gen:reference` ใน package นั้นด้วย

- [ ] **Step 3: เช็กการอ้างถึงใน `delete()`** — ใน `cost-center.service.ts` ระหว่าง `if (!existing) return ...NOT_FOUND` กับ `const now = new Date();` แทรก:

```ts
    const [locations, accountMappings] = await Promise.all([
      this.prismaService.tb_location.count({
        where: { cost_center_id: id, deleted_at: null },
      }),
      this.prismaService.tb_account_mapping.count({
        where: { cost_center_id: id, deleted_at: null },
      }),
    ]);
    if (locations + accountMappings > 0) {
      return Result.errorFromCatalog(ERROR_CATALOG.COST_CENTER_IN_USE, {
        locations,
        account_mappings: accountMappings,
      });
    }
```

และแก้ JSDoc `@returns` ของ `delete` เป็น `` `{ id }` or IN_USE / id หรือ IN_USE `` (ตาม group)

- [ ] **Step 4: type-check + เทสต์เดิม**

```bash
cd apps/micro-business && bunx tsc --noEmit && npx jest src/master && cd ../..
```

Expected: ผ่าน (ใช้ jest ไม่ใช่ `bun test`)

- [ ] **Step 5: ตรวจด้วย curl** (ต้องรัน micro-business + gateway local ต่อ dev DB — **DB ใช้ร่วม**; หา cost center ที่ location อ้างอยู่ด้วย GET location ก่อน ห้ามลบของจริงที่ไม่มีคนใช้)

```bash
# TOKEN/BU/APP_ID ตั้งเป็นตัวแปร shell — ห้ามวาง token ลงไฟล์
curl -s -X DELETE "http://localhost:4000/api/config/$BU/cost-centers/$CC_ID_USED_BY_LOCATION" \
  -H "Authorization: Bearer $TOKEN" -H "x-app-id: $APP_ID" | jq
```

Expected: HTTP 409, `code: "COST_CENTER_IN_USE"` · ถ้า gateway รันไม่ได้ ให้บอก user ว่าข้ามขั้นนี้ (ห้ามอ้างว่าผ่าน)

- [ ] **Step 6: commit + push + PR**

```bash
git add packages/error-catalog apps/micro-business/src/master/cost-center/cost-center.service.ts
git commit -m "fix(cost-center): ห้ามลบศูนย์ต้นทุนที่ location หรือ account mapping ยังอ้างถึง (409 COST_CENTER_IN_USE)"
git push -u origin fix/cost-center-delete-in-use
gh pr create --base main --title "fix(cost-center): refuse deleting a cost center still referenced" \
  --body "Adds COST_CENTER_IN_USE (409). Cost center delete now counts live tb_location / tb_account_mapping references, mirroring cost-center-group. Must deploy before FE cost-center pages."
```

---

### Task 2: FE — หน้า Cost Center Group

**Files:** ตาม File Structure ส่วน cost-center-group + constants + router + module-list + messages

**Interfaces:**
- Produces: `routes/config/shared/use-cost-center-group.ts` exports `useCostCenterGroup`, `useCostCenterGroupById`, `useCreateCostCenterGroup`, `useUpdateCostCenterGroup`, `useDeleteCostCenterGroup`
- Produces: `types/cost-center-group.ts` exports `CostCenterGroup`, `CreateCostCenterGroupDto`

- [ ] **Step 1: constants**

`constant/api-endpoints.ts` ต่อจาก `GL_COST_CENTERS`:
```ts
  GL_COST_CENTER_GROUPS: (buCode: string) =>
    `/api/proxy/api/config/${buCode}/cost-center-groups`,
```
`constant/query-keys.ts` ต่อจาก `COST_CENTERS`:
```ts
  COST_CENTER_GROUPS: "cost-center-groups",
```
`constant/list-page-keys.ts` (เรียงตามตัวอักษร ใกล้ `CREDIT_TERM`):
```ts
  COST_CENTER: "cost_center",
  COST_CENTER_GROUP: "cost_center_group",
```
`constant/permissions.ts` ใน `configuration` (เรียงตามตัวอักษร หลัง `business_type`):
```ts
    cost_center: crud("configuration.cost_center"),
    cost_center_group: crud("configuration.cost_center_group"),
```

- [ ] **Step 2: type + hook**

`types/cost-center-group.ts`:
```ts
import type { Audit } from "./audit";

export interface CostCenterGroup {
  id: string;
  doc_version?: number;
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  note?: string | null;
  audit?: Audit;
}

export interface CreateCostCenterGroupDto {
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  note: string | null;
}
```

`routes/config/shared/use-cost-center-group.ts`:
```ts
import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  CostCenterGroup,
  CreateCostCenterGroupDto,
} from "@/types/cost-center-group";

// cost center list ฝัง group code/name มาด้วย — แก้ group แล้วต้อง invalidate ทั้งคู่
const crud = createConfigCrud<CostCenterGroup, CreateCostCenterGroupDto>({
  queryKey: QUERY_KEYS.COST_CENTER_GROUPS,
  endpoint: API_ENDPOINTS.GL_COST_CENTER_GROUPS,
  label: "costCenterGroup",
  updateMethod: "PATCH",
  extraInvalidateKeys: [QUERY_KEYS.COST_CENTERS],
});

export const useCostCenterGroup = crud.useList;
export const useCostCenterGroupById = crud.useById;
export const useCreateCostCenterGroup = crud.useCreate;
export const useUpdateCostCenterGroup = crud.useUpdate;
export const useDeleteCostCenterGroup = crud.useDelete;
```

- [ ] **Step 3: schema + filter fields**

`routes/config/cost-center-group/cost-center-group-form-schema.ts`:
```ts
import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";

export function createCostCenterGroupSchema(
  tv: TranslationFn,
  tf: TranslationFn,
) {
  return z.object({
    code: z.string().trim().min(1, tv("required", { field: tf("code") })),
    name: z.string().trim().min(1, tv("required", { field: tf("name") })),
    description: z.string().optional(),
    note: z.string().optional(),
    is_active: z.boolean(),
  });
}

export type CostCenterGroupFormValues = z.infer<
  ReturnType<typeof createCostCenterGroupSchema>
>;
```

`routes/config/cost-center-group/cost-center-group-filter-fields.ts`: คัดลอก `credit-term-filter-fields.ts` เปลี่ยนชื่อ const เป็น `COST_CENTER_GROUP_FILTER_FIELDS`

- [ ] **Step 4: dialog** — `cost-center-group-dialog.tsx`

```tsx
import { Controller } from "react-hook-form";
import { FolderTree } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateCostCenterGroup,
  useUpdateCostCenterGroup,
} from "@/routes/config/shared/use-cost-center-group";
import type {
  CostCenterGroup,
  CreateCostCenterGroupDto,
} from "@/types/cost-center-group";
import {
  createCostCenterGroupSchema,
  type CostCenterGroupFormValues,
} from "./cost-center-group-form-schema";

interface CostCenterGroupDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly costCenterGroup?: CostCenterGroup | null;
  readonly readOnly?: boolean;
}

export function CostCenterGroupDialog({
  open,
  onOpenChange,
  costCenterGroup,
  readOnly,
}: CostCenterGroupDialogProps) {
  const t = useTranslations("config.costCenterGroup");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      CostCenterGroup,
      CostCenterGroupFormValues,
      CreateCostCenterGroupDto
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={costCenterGroup}
      readOnly={readOnly}
      icon={FolderTree}
      translationNamespace="config.costCenterGroup"
      useCreate={useCreateCostCenterGroup}
      useUpdate={useUpdateCostCenterGroup}
      buildSchema={createCostCenterGroupSchema}
      toFormValues={(e) => ({
        code: e?.code ?? "",
        name: e?.name ?? "",
        description: e?.description ?? "",
        note: e?.note ?? "",
        is_active: e?.is_active ?? true,
      })}
      toPayload={(v) => ({
        code: v.code.trim(),
        name: v.name.trim(),
        description: v.description?.trim() || null,
        note: v.note?.trim() || null,
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="ccg-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="ccg-code"
              placeholder={t("codePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.code?.message}
              maxLength={20}
              {...form.register("code")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ccg-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="ccg-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ccg-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="ccg-description"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ccg-note">{tfl("note")}</FieldLabel>
            <Textarea
              id="ccg-note"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("note")}
            />
          </Field>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="ccg-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </>
      )}
    </ConfigEntityDialog>
  );
}
```

- [ ] **Step 5: table hook** — `use-cost-center-group-table.tsx`: คัดลอก `routes/config/credit-term/use-credit-term-table.tsx` แล้ว
  - เปลี่ยน `CreditTerm` → `CostCenterGroup` (import จาก `@/types/cost-center-group`), ชื่อ interface/function → `UseCostCenterGroupTableOptions` / `useCostCenterGroupTable`
  - คอลัมน์แรกเป็น `accessorKey: "code"` (หัว `tfl("code")`, `CellAction` เปิด edit, `skeleton: columnSkeletons.textShort`)
  - คอลัมน์ที่สองเป็น `accessorKey: "name"` แบบธรรมดา (ไม่มี `CellAction`)
  - ลบคอลัมน์ `value`, คง `description`, `statusColumn`, `auditColumns`
  - `activity: { id: (r) => r.id, label: (r) => \`${r.code} · ${r.name}\` }`

- [ ] **Step 6: card + component + route**

`cost-center-group-card.tsx`: คัดลอก `credit-term-card.tsx` → `title={\`${item.code} · ${item.name}\`}`, ลบแถว `value`, เพิ่มแถว note ถัดจาก description:
```tsx
      {item.note && <ListCardRow label={tfl("note")}>{item.note}</ListCardRow>}
```

`cost-center-group-component.tsx`:
```tsx
import { useTranslations } from "use-intl";
import {
  useCostCenterGroup,
  useDeleteCostCenterGroup,
} from "@/routes/config/shared/use-cost-center-group";
import type { CostCenterGroup } from "@/types/cost-center-group";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { CostCenterGroupDialog } from "./cost-center-group-dialog";
import { useCostCenterGroupTable } from "./use-cost-center-group-table";
import { COST_CENTER_GROUP_FILTER_FIELDS } from "./cost-center-group-filter-fields";
import CostCenterGroupCard from "./cost-center-group-card";

export default function CostCenterGroupComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<CostCenterGroup>
      translationNamespace="config.costCenterGroup"
      entityNameField="name"
      useList={useCostCenterGroup}
      useDelete={useDeleteCostCenterGroup}
      useTable={useCostCenterGroupTable}
      pageKey={LIST_PAGE_KEYS.COST_CENTER_GROUP}
      filterFields={COST_CENTER_GROUP_FILTER_FIELDS}
      defaultSort="code:asc"
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 14 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 40,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <CostCenterGroupDialog
          open={open}
          onOpenChange={onOpenChange}
          costCenterGroup={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <CostCenterGroupCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
```
(ถ้า `ConfigListTemplate` มี prop สิทธิ์เขียน/permission ที่ credit-term ไม่ได้ส่ง ให้ดูว่า template อ่านจาก leaf ใน module-list เอง — ไม่ต้องส่งเพิ่ม)

`cost-center-group.route.tsx`:
```tsx
import CostCenterGroupComponent from "./cost-center-group-component";

export function Component() {
  return <CostCenterGroupComponent />;
}
```

- [ ] **Step 7: router + module-list**

`routes/router.tsx` ต่อจาก route `dimension`:
```tsx
              {
                path: "cost-center-group",
                lazy: () =>
                  import("./config/cost-center-group/cost-center-group.route"),
              },
```
`constant/module-list.ts` ต่อจาก leaf `dimension` (เพิ่ม `FolderTree` ใน import จาก `lucide-react`):
```ts
      {
        name: "costCenterGroup",
        path: "/config/cost-center-group",
        licenseFeature: "configuration.cost_center_group",
        icon: FolderTree,
        permission: PERMISSIONS.configuration.cost_center_group.view,
      },
```

- [ ] **Step 8: i18n** — ทั้ง `messages/en.json` และ `messages/th.json` (ใช้ python/json แก้ ระวังไม่ให้ลำดับ key อื่นเปลี่ยน — ถ้าไฟล์ format ด้วย 2 space ให้เขียนกลับ `indent=2, ensure_ascii=False` และตรวจ `git diff --stat` ว่าเปลี่ยนเฉพาะบรรทัดที่เพิ่ม)

| key | en | th |
|---|---|---|
| `modules.costCenterGroup` | Cost Center Group | กลุ่มศูนย์ต้นทุน |
| `systemAdmin.role.resources.cost_center_group` | Cost Center Group | กลุ่มศูนย์ต้นทุน |
| `config.costCenterGroup.entity` | Cost Center Group | กลุ่มศูนย์ต้นทุน |
| `config.costCenterGroup.title` | Cost Center Group | กลุ่มศูนย์ต้นทุน |
| `config.costCenterGroup.desc` | Group cost centers for reporting — every cost center belongs to one group. | จัดกลุ่มศูนย์ต้นทุนเพื่อทำรายงาน — ศูนย์ต้นทุนทุกตัวต้องอยู่ในกลุ่มใดกลุ่มหนึ่ง |
| `config.costCenterGroup.add` | Add Cost Center Group | เพิ่มกลุ่มศูนย์ต้นทุน |
| `config.costCenterGroup.deleteTitle` | Delete Cost Center Group | ลบกลุ่มศูนย์ต้นทุน |
| `config.costCenterGroup.deleteConfirm` | Are you sure you want to delete cost center group "{name}"? This action cannot be undone. | ต้องการลบกลุ่มศูนย์ต้นทุน "{name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้ |
| `config.costCenterGroup.codePlaceholder` | e.g. ADM | เช่น ADM |
| `config.costCenterGroup.namePlaceholder` | e.g. Administration | เช่น ฝ่ายบริหาร |

ตรวจว่า `config.creditTerm` มี key อื่นที่ `ConfigListTemplate` / `ConfigEntityDialog` อ่าน (เช่น `editTitle`, `addTitle`) — ถ้ามี ให้เพิ่มให้ครบชุดเดียวกัน; ข้อความ deleteConfirm ภาษาไทยให้คัดรูปประโยคจาก `config.creditTerm.deleteConfirm` ใน th.json

- [ ] **Step 9: static checks**

```bash
bun run typecheck && bunx eslint routes/config/cost-center-group routes/config/shared constant types && bun test:run constant
```
Expected: ผ่านหมด รวม `module-list.permission.test.ts` / `module-list.license-feature.test.ts` (ถ้าแดงเพราะคีย์ไม่อยู่ใน fixture ให้หยุดรายงาน — ห้ามแก้ fixture ด้วยมือ)

- [ ] **Step 10: commit**

```bash
git add -A constant types routes messages
git commit -m "feat(config): หน้า Cost Center Group (list + dialog เพิ่ม/แก้/ลบ)"
```

---

### Task 3: FE — หน้า Cost Center

**Interfaces:**
- Consumes: `useCostCenterGroup` จาก `@/routes/config/shared/use-cost-center-group`; `useCostCenter`, `useCreateCostCenter`, `useUpdateCostCenter`, `useDeleteCostCenter` จาก `@/hooks/use-cost-center` (มีอยู่แล้ว)
- Produces: `LookupCostCenterGroup` (ใช้ในโฟลเดอร์นี้เท่านั้น)

- [ ] **Step 1: ขยาย type** — `types/cost-center.ts`

```ts
import type { Audit } from "./audit";

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  cost_center_group_id?: string;
  cost_center_group_code?: string | null;
  cost_center_group_name?: string | null;
  is_active?: boolean;
  note?: string | null;
  doc_version?: number;
  audit?: Audit;
}

export type CreateCostCenterDto = Omit<CostCenter, "id" | "doc_version" | "audit">;
```
แล้ว `bun run typecheck` — ผู้ใช้เดิม (location, JV, accounting doc) ต้องไม่แดง

- [ ] **Step 2: list page key + permission + i18n + module-list + router** (เหมือน Task 2 step 1/7/8 แต่สำหรับ cost center)

`constant/module-list.ts` ต่อจาก leaf `costCenterGroup` (เพิ่ม `Crosshair` ใน import lucide):
```ts
      {
        name: "costCenter",
        path: "/config/cost-center",
        licenseFeature: "configuration.cost_center",
        icon: Crosshair,
        permission: PERMISSIONS.configuration.cost_center.view,
      },
```
`routes/router.tsx` ต่อจาก `cost-center-group`:
```tsx
              {
                path: "cost-center",
                lazy: () => import("./config/cost-center/cost-center.route"),
              },
```

i18n:

| key | en | th |
|---|---|---|
| `modules.costCenter` | Cost Center | ศูนย์ต้นทุน |
| `systemAdmin.role.resources.cost_center` | Cost Center | ศูนย์ต้นทุน |
| `field.costCenterGroup` | Cost center group | กลุ่มศูนย์ต้นทุน |
| `config.costCenter.entity` | Cost Center | ศูนย์ต้นทุน |
| `config.costCenter.title` | Cost Center | ศูนย์ต้นทุน |
| `config.costCenter.desc` | Departments or units that costs are charged to — set a default per location. | หน่วยงานที่รับรู้ค่าใช้จ่าย — ตั้งค่าเริ่มต้นได้ที่แต่ละสถานที่ |
| `config.costCenter.add` | Add Cost Center | เพิ่มศูนย์ต้นทุน |
| `config.costCenter.deleteTitle` | Delete Cost Center | ลบศูนย์ต้นทุน |
| `config.costCenter.deleteConfirm` | Are you sure you want to delete cost center "{name}"? This action cannot be undone. | ต้องการลบศูนย์ต้นทุน "{name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้ |
| `config.costCenter.codePlaceholder` | e.g. 101 | เช่น 101 |
| `config.costCenter.namePlaceholder` | e.g. Front Office | เช่น ฝ่ายต้อนรับ |
| `config.costCenter.groupPlaceholder` | Select group | เลือกกลุ่ม |
| `config.costCenter.noGroupHint` | No cost center group yet — create one first. | ยังไม่มีกลุ่มศูนย์ต้นทุน — สร้างกลุ่มก่อน |
| `config.costCenter.createGroupLink` | Go to Cost Center Group | ไปหน้ากลุ่มศูนย์ต้นทุน |

- [ ] **Step 3: lookup group** — `routes/config/cost-center/lookup-cost-center-group.tsx` (แบบ `components/lookup/lookup-cost-center.tsx`)

```tsx
import { useEffect, useState } from "react";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { useCostCenterGroup } from "@/routes/config/shared/use-cost-center-group";
import type { CostCenterGroup } from "@/types/cost-center-group";

interface LookupCostCenterGroupProps {
  readonly value: string | null;
  readonly onValueChange: (id: string | null) => void;
  /** ชื่อ group เดิมจาก list response — กันช่องว่างเมื่อ group ถูกปิดใช้ */
  readonly defaultLabel?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  /** แจ้งผู้เรียกว่าไม่มี group active เลย (โหลดเสร็จแล้ว) */
  readonly onEmptyChange?: (empty: boolean) => void;
}

export function LookupCostCenterGroup({
  value,
  onValueChange,
  defaultLabel,
  disabled,
  error,
  onEmptyChange,
}: LookupCostCenterGroupProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCostCenterGroup({
    perpage: 100,
    search: search || undefined,
    filter: "is_active|bool:true",
  });
  const items = data?.data ?? [];
  const empty = !isLoading && !search && items.length === 0;
  // แจ้งเฉพาะตอนค่าเปลี่ยน — ผู้เรียกใช้แสดงข้อความ "สร้างกลุ่มก่อน"
  useEffect(() => {
    onEmptyChange?.(empty);
  }, [empty, onEmptyChange]);

  return (
    <LookupCombobox<CostCenterGroup>
      value={value ?? ""}
      onValueChange={(id) => onValueChange(id || null)}
      items={items}
      getId={(g) => g.id}
      getLabel={(g) => `${g.code} · ${g.name}`}
      getSearchValue={(g) => `${g.code} ${g.name}`}
      defaultLabel={defaultLabel}
      isLoading={isLoading}
      onSearchChange={setSearch}
      serverSideSearch
      disabled={disabled}
      error={error}
      modal
    />
  );
}
```
`onEmptyChange` ที่ส่งเข้ามาต้องเป็น setter ของ `useState` (อ้างอิงคงที่) ไม่งั้น effect วนซ้ำ

- [ ] **Step 4: schema + filter fields**

`cost-center-form-schema.ts`: เหมือน group schema (Task 2 step 3) + ฟิลด์
```ts
    cost_center_group_id: z
      .string()
      .min(1, tv("required", { field: tf("costCenterGroup") })),
```
ชื่อ `createCostCenterSchema` / `CostCenterFormValues`

`cost-center-filter-fields.ts`:
```ts
import type { FilterFieldDef } from "@/types/list-filter";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useCostCenterGroup } from "@/routes/config/shared/use-cost-center-group";
import type { CostCenterGroup } from "@/types/cost-center-group";

// ไม่กรอง is_active — ให้เลือก group ที่ปิดไปแล้วได้ เพื่อหา cost center ที่ค้างอยู่ใต้มัน
const GROUP_ENTITY = defineEntitySource<CostCenterGroup>({
  fieldKey: "cost_center_group_id",
  useListHook: useCostCenterGroup,
  getLabel: (g) => `${g.code} · ${g.name}`,
  serverFilter: null,
});

export const COST_CENTER_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "cost_center_group_id",
    control: "entity",
    entity: GROUP_ENTITY,
    labelKey: "field.costCenterGroup",
  },
  {
    key: "filter",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.active", value: "is_active|bool:true" },
      { labelKey: "status.inactive", value: "is_active|bool:false" },
    ],
  },
];
```
ถ้า `useCostCenterGroup` ไม่ตรงกับชนิด `LookupListHook<T>` ให้ดูว่า hook อื่นที่ใช้ใน `defineEntitySource` (เช่น `useConfigLocation`) มี signature ต่างจาก `createConfigCrud().useList` อย่างไร แล้วปรับ — ถ้าต้องแก้เกิน 10 บรรทัด **ตัด filter group ออก** (spec อนุญาต) และบันทึกไว้ในรายงาน

- [ ] **Step 5: ตรวจ filter group กับ backend จริง** — เปิดหน้าใน dev แล้วเลือก group ใน filter ดู network request ว่า `filter=` ส่ง `cost_center_group_id|string:<uuid>` และผลลัพธ์ถูกกรองจริง ถ้า backend ไม่กรอง (คืนทุกแถว) หรือ 400 → ลบ field นี้ออกจาก `COST_CENTER_FILTER_FIELDS` (ไม่แก้ BE)

- [ ] **Step 6: dialog** — `cost-center-dialog.tsx`: เหมือน `CostCenterGroupDialog` (Task 2 step 4) ทุกช่อง แต่ใช้ `Crosshair`, namespace `config.costCenter`, hooks `useCreateCostCenter` / `useUpdateCostCenter` จาก `@/hooks/use-cost-center`, prop `costCenter`, id prefix `cc-` และ:
  - `toFormValues` เพิ่ม `cost_center_group_id: e?.cost_center_group_id ?? ""`
  - `toPayload` เพิ่ม `cost_center_group_id: v.cost_center_group_id` (ชนิด payload = `CreateCostCenterDto`; **ไม่ส่ง** `cost_center_group_code/name`)
  - แทรกช่อง group ระหว่าง name กับ description:

```tsx
          <Field>
            <FieldLabel htmlFor="cc-group" required>
              {tfl("costCenterGroup")}
            </FieldLabel>
            <Controller
              control={form.control}
              name="cost_center_group_id"
              render={({ field, fieldState }) => (
                <LookupCostCenterGroup
                  value={field.value || null}
                  onValueChange={(id) => field.onChange(id ?? "")}
                  defaultLabel={
                    costCenter?.cost_center_group_code
                      ? `${costCenter.cost_center_group_code} · ${costCenter.cost_center_group_name ?? ""}`
                      : undefined
                  }
                  disabled={disabled}
                  error={fieldState.error?.message}
                  onEmptyChange={setNoGroup}
                />
              )}
            />
            {noGroup && (
              <FieldDescription>
                {t("noGroupHint")}{" "}
                <Link to="/config/cost-center-group" className="underline">
                  {t("createGroupLink")}
                </Link>
              </FieldDescription>
            )}
          </Field>
```
  โดย `const [noGroup, setNoGroup] = useState(false);` อยู่ในตัว component, import `Link` จาก `react-router`, `FieldDescription` จาก `@/components/ui/field`, `useState` จาก `react`
  - ถ้า dialog กว้างพอ ให้ code กับ name อยู่แถวเดียว (`grid grid-cols-2 gap-3`) — ไม่บังคับ

- [ ] **Step 7: table / card / component / route** — เหมือน Task 2 step 5–6 โดยเปลี่ยนชื่อเป็น cost center และ:
  - ตารางเพิ่มคอลัมน์ group ระหว่าง name กับ description:
```tsx
    {
      id: "cost_center_group",
      accessorFn: (r) =>
        r.cost_center_group_code
          ? `${r.cost_center_group_code} · ${r.cost_center_group_name ?? ""}`
          : "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("costCenterGroup")} />
      ),
      enableSorting: false,
      meta: { headerTitle: tfl("costCenterGroup"), skeleton: columnSkeletons.text },
    },
```
  - card เพิ่มแถว group (`label={tfl("costCenterGroup")}`)
  - export เพิ่มคอลัมน์ group (`width: 28`)
  - `pageKey={LIST_PAGE_KEYS.COST_CENTER}`, `filterFields={COST_CENTER_FILTER_FIELDS}`, `defaultSort="code:asc"`

- [ ] **Step 8: static checks**

```bash
bun run typecheck && bunx eslint routes/config/cost-center routes/config/location constant types && bun test:run constant routes/config/location
```

- [ ] **Step 9: commit**

```bash
git add -A constant types routes messages
git commit -m "feat(config): หน้า Cost Center (list + dialog, เลือกกลุ่ม, กรองตามกลุ่ม)"
```

---

### Task 4: ตรวจทั้งระบบ + PR

- [ ] **Step 1: full static + เทสต์เดิม**

```bash
bun run typecheck && bun run lint && bun test:run
```
Expected: ผ่าน ยกเว้นเทสต์ที่แดงบน `main` อยู่แล้ว (เช่น `ap-mock-repository.test.ts`) — ยืนยันด้วยการรันไฟล์นั้นบน `origin/main` ก่อนสรุป

- [ ] **Step 2: allowlist x-app-id** — ยิง GET list group ด้วย app id ของ inventory

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4000/api/config/$BU/cost-center-groups?perpage=1" \
  -H "Authorization: Bearer $TOKEN" -H "x-app-id: $APP_ID"
```
Expected 200 · ถ้า 401/403 ที่มาจาก AppIdGuard → หยุดและแจ้ง user (ต้องเติม `cost-center-groups.*` ใน allowlist ก่อน deploy ไม่งั้น user ถูกเด้งออก)

- [ ] **Step 3: เบราว์เซอร์** — `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` ใน worktree (port 3000); ทุก code ขึ้นต้น `ZZ-TEST-`:
  1. เมนู config มี "กลุ่มศูนย์ต้นทุน" และ "ศูนย์ต้นทุน" ต่อจาก Dimension
  2. สร้าง group `ZZ-TEST-G1` → ขึ้นในตาราง
  3. สร้าง group `zz-test-g1` (ตัวพิมพ์ต่าง) → toast code ซ้ำ, dialog ไม่ปิด
  4. สร้าง cost center `ZZ-TEST-C1` ใน `ZZ-TEST-G1` → ตารางแสดง group
  5. แก้ชื่อ group → ตาราง cost center แสดงชื่อใหม่ (invalidate ทำงาน)
  6. ลบ `ZZ-TEST-G1` → toast 409 กลุ่มยังถูกใช้
  7. ตั้ง `ZZ-TEST-C1` เป็น cost center ของ location ทดสอบ (หรือใช้ cost center ที่ location ใช้อยู่แล้ว **โดยไม่กดยืนยันถ้า BE Task 1 ยังไม่รันในเครื่อง**) → ลบ → toast 409 `COST_CENTER_IN_USE`
  8. ปิดใช้ group → เปิดแก้ `ZZ-TEST-C1` → dropdown ยังแสดงชื่อ group เดิม
  9. ล้าง: คืนค่า location, ลบ `ZZ-TEST-C1` แล้ว `ZZ-TEST-G1` → สำเร็จ

- [ ] **Step 4: ถ้า toast 409 ไม่ขึ้น** (ข้อ 6/7) — ดู `components/providers.tsx` `MutationCache.onError` ว่ากรองอะไรออก แล้วเพิ่ม `onError` ที่จุดเรียก `deleteMutation.mutate` ใน `components/templates/config-list-template.tsx` เฉพาะกรณีที่ handler กลางไม่แสดง — commit แยก

- [ ] **Step 5: PR**

```bash
git push -u origin feature/cost-center-config-pages
gh pr create --base main --title "feat(config): Cost Center and Cost Center Group pages" \
  --body "Adds /config/cost-center-group and /config/cost-center (list + dialog CRUD), gated by configuration.cost_center(_group) license + permission keys. Depends on backend fix/cost-center-delete-in-use (deploy BE first). Before deploy: confirm cost-center-groups.* is in the x-app-id allowlist and roles have the new permission keys."
```
(ห้าม squash-merge — changelog generator ต้องการ merge commit)
