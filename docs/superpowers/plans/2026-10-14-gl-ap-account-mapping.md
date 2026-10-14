# Mapping GL/AP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนหน้า `/config/chart-of-account-mapping` จาก mock เป็นของจริง โดยแต่ละแถวคือ location × item group × movement ที่ resolve ได้ account code และ cost center จาก master (แก้ทับรายแถวได้) และเพิ่มช่องตั้งค่า master ที่ location (cost center) และ category / sub-cat / item group (Inventory + Direct account)

**Architecture:** backend เพิ่มตาราง `tb_account_mapping` ที่เก็บแค่ค่าที่แก้ทับ (null = สืบทอด) มี resolver ใน TS ตัวเดียวเป็นแหล่งของค่าที่แสดงผล ส่วน SQL CTE ใช้เฉพาะกรอง status, นับจำนวน และแบ่งหน้า ฝั่ง micro-business มี module `account-mapping` ส่วน gateway มี `api/:bu_code/account-mapping` (5 endpoint) FE เขียนหน้า list ใหม่ด้วย ListPageShell + DataGrid + sheet แก้ไข + dialog generate

**Tech Stack:** NestJS (HTTP-as-RPC, `@repo/rpc-contract`), Prisma tenant schema + raw SQL migration, Zod DTO · React 19 + React Router 7, TanStack Query/Table, react-hook-form, use-intl

**Spec:** `docs/superpowers/specs/2026-10-14-gl-ap-account-mapping-design.md`

## Global Constraints

- **รีโป/branch:** backend `carmen-turborepo-backend-v2` branch `feature/gl-ap-account-mapping` (แตกจาก `main`) · FE `carmen-inventory-frontend-react` branch `feature/gl-ap-account-mapping` (มีอยู่แล้ว มี commit spec)
- **ห้ามเขียนเทสต์ใหม่** ยกเว้น `account-mapping.resolver.spec.ts` (Task B3) ซึ่งผู้ใช้อนุมัติไว้แล้ว ทุก task ปิดท้ายด้วย typecheck + lint + commit ห้ามสร้าง `*.spec.ts` / `*.test.ts` อื่น ส่วนเทสต์เดิมต้องเขียวทั้งหมด
- **commit message เป็นภาษาไทย** (ตาม CLAUDE.md) และ identifier ยังเป็นภาษาอังกฤษ
- **backend ใช้ jest** ห้ามใช้ `bun test`
- **perpage เพดาน 100** ซึ่ง backend มี `MAX_PERPAGE = 100` อยู่แล้ว · FE มีตัวเลือก `[10, 20, 50, 100]`
- **consignment ไม่มีแถว mapping** และไม่ถูก resolve (`skip: true`)
- **license feature ใช้ `configuration.chart_of_account_mapping` เดิม** ห้ามตั้งคีย์ license ใหม่
- **RBAC resource ใหม่ชื่อ `configuration.chart_of_account_mapping`** มี action `view` / `update` / `create` ต้อง seed ก่อน deploy
- **ห้าม query ทีละแถว:** resolve ทำเป็นชุดต่อหน้า และ generate ใช้ `INSERT … SELECT` คำสั่งเดียว
- **raw SQL ต้องใช้ tagged template + `tenantTableRef(this.prismaService, 'tb_x')`** ห้ามใช้ `*Unsafe`
- **i18n ห้ามมี `{{ }}`** ในไฟล์แปล
- **FE:** ใส่ `"use no memo"` บนสุดของ page component และ table hook · `routes/config` ห้าม import จาก `routes/product-management` ของที่ใช้ร่วมกันวางที่ `components/lookup/` และ `hooks/`
- **dev DB (`:4000`) เป็น DB ที่ใช้ร่วมกัน** ต้อง backup ตารางที่จะเขียนก่อนทุกครั้งที่ตรวจด้วยมือ

## Review Focus

1. **กด generate ซ้ำหรือพร้อมกัน:** ต้องไม่ได้แถวซ้ำและไม่เขียนทับแถวที่แก้ทับไว้ ทั้งนี้ `ON CONFLICT` ต้องอ้าง expression ให้ตรงกับ unique index ทุกตัวอักษร ไม่อย่างนั้น Postgres ตอบ 42P10 → ตรวจด้วยมือใน Task B4 ขั้นที่ 9
2. **ค่าที่แสดงไม่ตรงกับตัวกรอง `incomplete`:** item group ที่ไม่มีบัญชีชนิดที่ต้องการในทุกระดับ หรือ location ที่ไม่มี cost center ต้องโผล่ใน `incomplete` และแสดงช่องว่างพร้อม issue → unit test ใน Task B3 + curl เทียบกันใน Task B4 ขั้นที่ 9
3. **location ถูกเปลี่ยนเป็น consignment หลังสร้างแถวแล้ว:** แถวต้องหายจาก list และ resolve ต้องคืน `skip` → Task B3 (test) + Task B4 ขั้นที่ 9
4. **PATCH ด้วยรหัสบัญชีที่ไม่มีใน COA หรือ inactive:** เกิดได้เพราะ `LookupChartOfAccount` fallback ไปใช้ mock `DEFAULT_CHART_OF_ACCOUNTS` เมื่อ API ว่าง ต้องได้ 422 ห้ามบันทึกเงียบ ๆ → Task B4 ขั้นที่ 9 + Task F4 ขั้นที่ 4
5. **`doc_version` ชนกันตอนสองคนแก้แถวเดียวกัน:** ต้องได้ 409 แล้ว FE แสดงข้อความและ refetch ห้ามเขียนทับเงียบ ๆ → Task B4 ขั้นที่ 9 + Task F4 ขั้นที่ 4

---

# ส่วน Backend (`carmen-turborepo-backend-v2`)

ทุกคำสั่งในส่วนนี้รันที่ root ของรีโป backend เว้นแต่จะระบุไว้เป็นอย่างอื่น

### Task B1: Schema + migration

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (enum `enum_account_type` ~L6915, `model tb_location` ~L1470, relation ฝั่ง `tb_product_item_group` / `tb_adjustment_type` / `tb_cost_center`, model ใหม่)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261014100000_account_type_direct/migration.sql`
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261014100100_account_mapping/migration.sql`
- Modify: `apps/micro-business/src/common/account-code/account-code.helper.ts:5-10` (`ACCOUNT_TYPES`)

**Interfaces:**
- Produces: Prisma model `tb_account_mapping` · enums `enum_account_mapping_type { AP GL }`, `enum_account_mapping_movement { grn cn adjustment sr_in sr_out }`, `enum_account_mapping_origin { generated_all generated_used auto_posting }` · `enum_account_type.direct` · `tb_location.cost_center_id`

- [ ] **Step 1: แตก branch**

```bash
git switch main && git pull && git switch -c feature/gl-ap-account-mapping
```

- [ ] **Step 2: แก้ schema.prisma**

เพิ่ม `direct` เข้าไปใน enum เดิม:

```prisma
enum enum_account_type {
  inventory
  cogs
  revenue
  purchase
  direct
}
```

ใน `model tb_location` เพิ่มบรรทัดใต้ `department_account_code`:

```prisma
  cost_center_id          String? @db.Uuid
```

และเพิ่ม relation ในบล็อก relation ของ `tb_location`:

```prisma
  tb_cost_center     tb_cost_center?      @relation(fields: [cost_center_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  tb_account_mapping tb_account_mapping[]
  @@index([cost_center_id], map: "location_cost_center_id_idx")
```

ต่อท้ายไฟล์ด้วย enum และ model ใหม่:

```prisma
enum enum_account_mapping_type {
  AP
  GL
}

enum enum_account_mapping_movement {
  grn
  cn
  adjustment
  sr_in
  sr_out
}

enum enum_account_mapping_origin {
  generated_all
  generated_used
  auto_posting
}

/// ผัง mapping บัญชี — 1 แถว = location × item group × movement (× adjustment type)
/// account_code / cost_center_id = null แปลว่าสืบทอดจาก master (resolver ใน micro-business)
/// partial unique "accountmapping_key_live_u" + CHECK อยู่ใน SQL migration (Prisma แสดงไม่ได้)
model tb_account_mapping {
  id                    String                        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  mapping_type          enum_account_mapping_type
  location_id           String                        @db.Uuid
  product_item_group_id String                        @db.Uuid
  movement              enum_account_mapping_movement
  adjustment_type_id    String?                       @db.Uuid

  account_code   String? @db.VarChar
  cost_center_id String? @db.Uuid

  origin      enum_account_mapping_origin
  is_reviewed Boolean                     @default(false)

  doc_version   Int       @default(0) @db.Integer
  created_at    DateTime? @default(now()) @db.Timestamptz(6)
  created_by_id String?   @db.Uuid
  updated_at    DateTime? @default(now()) @db.Timestamptz(6)
  updated_by_id String?   @db.Uuid
  deleted_at    DateTime? @db.Timestamptz(6)
  deleted_by_id String?   @db.Uuid

  tb_location           tb_location           @relation(fields: [location_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  tb_product_item_group tb_product_item_group @relation(fields: [product_item_group_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  tb_adjustment_type    tb_adjustment_type?   @relation(fields: [adjustment_type_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  tb_cost_center        tb_cost_center?       @relation(fields: [cost_center_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([mapping_type, location_id], map: "accountmapping_type_location_idx")
  @@index([product_item_group_id], map: "accountmapping_item_group_idx")
}
```

เพิ่ม back-relation `tb_account_mapping tb_account_mapping[]` ใน `tb_product_item_group`, `tb_adjustment_type` และ `tb_cost_center` ส่วน `tb_cost_center` ต้องเพิ่ม `tb_location tb_location[]` ด้วย

- [ ] **Step 3: เขียน migration แรก (enum ADD VALUE แยกไฟล์ของตัวเอง)**

`20261014100000_account_type_direct/migration.sql`:

```sql
-- แยกไฟล์: ADD VALUE ใช้ใน transaction เดียวกับคำสั่งที่อ้างค่านั้นไม่ได้
ALTER TYPE "enum_account_type" ADD VALUE IF NOT EXISTS 'direct';
```

- [ ] **Step 4: เขียน migration ที่สอง**

`20261014100100_account_mapping/migration.sql`:

```sql
-- tb_location.cost_center_id (ไม่ backfill จาก department_account_code — เป็น string อิสระ ไม่ใช่ FK)
ALTER TABLE "tb_location" ADD COLUMN IF NOT EXISTS "cost_center_id" UUID;
DO $$ BEGIN
  ALTER TABLE "tb_location" ADD CONSTRAINT "tb_location_cost_center_id_fkey"
    FOREIGN KEY ("cost_center_id") REFERENCES "tb_cost_center"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "location_cost_center_id_idx" ON "tb_location" ("cost_center_id");

DO $$ BEGIN CREATE TYPE "enum_account_mapping_type" AS ENUM ('AP', 'GL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "enum_account_mapping_movement" AS ENUM ('grn', 'cn', 'adjustment', 'sr_in', 'sr_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "enum_account_mapping_origin" AS ENUM ('generated_all', 'generated_used', 'auto_posting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "tb_account_mapping" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mapping_type" "enum_account_mapping_type" NOT NULL,
  "location_id" UUID NOT NULL,
  "product_item_group_id" UUID NOT NULL,
  "movement" "enum_account_mapping_movement" NOT NULL,
  "adjustment_type_id" UUID,
  "account_code" VARCHAR,
  "cost_center_id" UUID,
  "origin" "enum_account_mapping_origin" NOT NULL,
  "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
  "doc_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  "created_by_id" UUID,
  "updated_at" TIMESTAMPTZ(6) DEFAULT now(),
  "updated_by_id" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by_id" UUID,
  CONSTRAINT "tb_account_mapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tb_account_mapping_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "tb_location"("id"),
  CONSTRAINT "tb_account_mapping_product_item_group_id_fkey" FOREIGN KEY ("product_item_group_id") REFERENCES "tb_product_item_group"("id"),
  CONSTRAINT "tb_account_mapping_adjustment_type_id_fkey" FOREIGN KEY ("adjustment_type_id") REFERENCES "tb_adjustment_type"("id"),
  CONSTRAINT "tb_account_mapping_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "tb_cost_center"("id"),
  -- adjustment ต้องมี adjustment_type_id; movement อื่นห้ามมี
  CONSTRAINT "accountmapping_adjustment_type_ck" CHECK (("movement" = 'adjustment') = ("adjustment_type_id" IS NOT NULL)),
  -- AP คู่กับ grn/cn เท่านั้น, GL คู่กับ adjustment/sr_in/sr_out เท่านั้น
  CONSTRAINT "accountmapping_type_movement_ck" CHECK (
    ("mapping_type" = 'AP' AND "movement" IN ('grn', 'cn')) OR
    ("mapping_type" = 'GL' AND "movement" IN ('adjustment', 'sr_in', 'sr_out'))
  )
);

CREATE INDEX IF NOT EXISTS "accountmapping_type_location_idx" ON "tb_account_mapping" ("mapping_type", "location_id");
CREATE INDEX IF NOT EXISTS "accountmapping_item_group_idx" ON "tb_account_mapping" ("product_item_group_id");

-- COALESCE เพราะ adjustment_type_id เป็น null ได้ และ null ไม่ชนกันเองใน unique ปกติ
-- ON CONFLICT ใน service ต้องอ้าง expression ชุดนี้ "ตรงทุกตัวอักษร" ไม่งั้น 42P10
CREATE UNIQUE INDEX IF NOT EXISTS "accountmapping_key_live_u" ON "tb_account_mapping" (
  "mapping_type", "location_id", "product_item_group_id", "movement",
  COALESCE("adjustment_type_id", '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE "deleted_at" IS NULL;
```

- [ ] **Step 5: เพิ่ม `direct` ใน `ACCOUNT_TYPES`**

ใน `apps/micro-business/src/common/account-code/account-code.helper.ts:5-10`:

```ts
const ACCOUNT_TYPES: enum_account_type[] = [
  enum_account_type.inventory,
  enum_account_type.cogs,
  enum_account_type.revenue,
  enum_account_type.purchase,
  enum_account_type.direct,
];
```

- [ ] **Step 6: validate + generate + build dist**

```bash
cd packages/prisma-shared-schema-tenant && npx prisma validate && npx prisma format && cd ../.. \
  && bun run db:generate && bun run build:package
```

Expected: validate ผ่าน, build ไม่มี error

- [ ] **Step 7: ตรวจว่าเกตใน gateway รับ `direct` แล้ว**

```bash
grep -rn "account_type" apps/backend-gateway/src/common/dto/product-category apps/backend-gateway/src/common/dto/product-sub-category apps/backend-gateway/src/common/dto/product-item-group apps/backend-gateway/src/common/dto/product
```

ถ้าเจอ `z.nativeEnum(enum_account_type)` แปลว่ารับ `direct` อัตโนมัติหลัง generate ไม่ต้องแก้อะไร แต่ถ้าเจอ `z.enum([...])` ที่ลิสต์ค่าเองให้เติม `'direct'` ในทุกไฟล์ที่เจอ แล้วทำแบบเดียวกับ swagger `request.ts` ของ `config_product-*`

- [ ] **Step 7b: ตรวจว่า soft-delete extension ครอบตารางใหม่**

```bash
sed -n 405,430p packages/prisma-shared-schema-tenant/src/client.ts
```

Expected: `tb_account_mapping` **ไม่อยู่ใน** `modelsWithoutSoftDelete` (ตารางนี้มี `deleted_at` จึงควรได้ `deleted_at: null` อัตโนมัติ) ไม่ต้องแก้

- [ ] **Step 8: typecheck ทั้งสองแอป**

```bash
cd apps/micro-business && npx tsc --noEmit -p tsconfig.json && cd ../backend-gateway && npx tsc --noEmit -p tsconfig.json
```

Expected: ไม่มี error

- [ ] **Step 9: Commit**

```bash
git add packages/prisma-shared-schema-tenant/prisma apps/micro-business/src/common/account-code/account-code.helper.ts apps/backend-gateway/src/common/dto
git commit -m "feat(tenant-schema): ตาราง tb_account_mapping + location.cost_center_id + account_type direct"
```

---

### Task B2: Location รับและคืน `cost_center_id`

**Files:**
- Modify: `apps/micro-business/src/master/locations/dto/location.dto.ts:51,98`
- Modify: `apps/micro-business/src/master/locations/interface/location.interface.ts:43,58`
- Modify: `apps/micro-business/src/master/locations/dto/location.serializer.ts:49,71`
- Modify: `apps/micro-business/src/master/locations/locations.service.ts` (select ~L131/227/334 · create ~L1295 · update ~L1415)
- Modify: `apps/backend-gateway/src/common/dto/location/location.dto.ts:28,76`
- Modify: `apps/backend-gateway/src/common/dto/location/location.serializer.ts:67,94`
- Modify: `apps/backend-gateway/src/config/config_locations/swagger/request.ts:53,108`, `response.ts:49`

**Interfaces:**
- Produces: location GET (list / detail) คืน `cost_center_id: string | null` · create/update รับ `cost_center_id?: string | null`

- [ ] **Step 1: DTO ทั้งสองฝั่ง**

ทุกที่ที่มี `department_account_code: z.string().nullable().optional(),` (create และ update ทั้ง micro และ gateway) ให้เพิ่มบรรทัดต่อจากนั้น:

```ts
  cost_center_id: z.string().uuid().nullable().optional(),
```

- [ ] **Step 2: interface + serializer**

ใน interface ทั้งสองจุดเพิ่ม `cost_center_id?: string | null;` และใน serializer (micro และ gateway) ทุกจุดที่มี `department_account_code` ให้เพิ่ม:

```ts
  cost_center_id: z.string().uuid().nullable().optional(),
```

- [ ] **Step 3: service**

- ทุก `select` ที่มี `department_account_code: true` ให้เพิ่ม `cost_center_id: true,`
- ใน create (ข้าง `department_account_code: data.department_account_code ?? null`) เพิ่ม:

```ts
        cost_center_id: data.cost_center_id ?? null,
```

- ใน update (ข้าง `?? location.department_account_code`) เพิ่ม:

```ts
        cost_center_id:
          data.cost_center_id === undefined ? location.cost_center_id : data.cost_center_id,
```

(ใช้ `=== undefined` เพื่อให้ส่ง `null` มาล้างค่าได้ ถ้าใช้ `??` จะล้างไม่ได้)

- [ ] **Step 4: swagger**

ใน `request.ts` ทั้งสองจุดเพิ่ม `@ApiPropertyOptional({ format: 'uuid', nullable: true }) cost_center_id?: string | null;` ตามรูปแบบเดียวกับ `department_account_code` และใน `response.ts` เพิ่มแบบเดียวกัน

- [ ] **Step 5: typecheck + เทสต์เดิมของ locations**

```bash
cd apps/micro-business && npx tsc --noEmit -p tsconfig.json && npx jest src/master/locations && cd ../backend-gateway && npx tsc --noEmit -p tsconfig.json
```

Expected: ผ่านทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add apps/micro-business/src/master/locations apps/backend-gateway/src/common/dto/location apps/backend-gateway/src/config/config_locations
git commit -m "feat(location): รับ/คืน cost_center_id สำหรับ mapping บัญชี"
```

---

### Task B3: Resolver (pure TS) + เทสต์ parity

**Files:**
- Create: `apps/micro-business/src/master/account-mapping/account-mapping.resolver.ts`
- Create: `apps/micro-business/src/master/account-mapping/account-mapping.resolver.spec.ts` ← เทสต์ตัวเดียวที่ผู้ใช้อนุมัติ

**Interfaces:**
- Produces:

```ts
export type AccountSource = 'override' | 'item_group' | 'sub_category' | 'category';
export type CostCenterSource = 'override' | 'location';
export type AccountIssue = 'missing_inventory_account' | 'missing_direct_account' | 'account_not_in_coa';
export interface ResolveInput {
  location_type: 'inventory' | 'direct' | 'consignment';
  override_account_code: string | null;
  override_cost_center_id: string | null;
  location_cost_center_id: string | null;
  /** บัญชีของแต่ละระดับ แยกตามชนิด — ค่าที่ไม่มี = null */
  item_group: { inventory: string | null; direct: string | null };
  sub_category: { inventory: string | null; direct: string | null };
  category: { inventory: string | null; direct: string | null };
}
export interface ResolveOutput {
  skip: boolean;
  account: { code: string | null; source: AccountSource | null; issue: AccountIssue | null };
  cost_center: { id: string | null; source: CostCenterSource | null; issue: 'missing_cost_center' | null };
}
export function resolveAccountMapping(input: ResolveInput): ResolveOutput;
/** status ที่ SQL CTE ใน service ต้องคำนวณให้ได้ผลเดียวกัน */
export function mappingStatusFlags(input: ResolveInput, is_reviewed: boolean): {
  incomplete: boolean; overridden: boolean; is_default: boolean; unreviewed: boolean;
};
```

(`account_not_in_coa` ไม่ได้คำนวณใน resolver ตัวนี้ แต่ service ใส่ให้ทีหลังตอน join COA ใน Task B4)

- [ ] **Step 1: เขียนเทสต์ (decision table ชุดเดียวกับที่ SQL ต้องเลียนแบบ)**

```ts
import { mappingStatusFlags, resolveAccountMapping, type ResolveInput } from './account-mapping.resolver';

const none = { inventory: null, direct: null };
const base: ResolveInput = {
  location_type: 'inventory',
  override_account_code: null,
  override_cost_center_id: null,
  location_cost_center_id: 'cc-loc',
  item_group: none,
  sub_category: none,
  category: none,
};

describe('resolveAccountMapping', () => {
  it('override ชนะทุกระดับ', () => {
    const r = resolveAccountMapping({ ...base, override_account_code: 'OV', item_group: { inventory: 'IG', direct: null } });
    expect(r.account).toEqual({ code: 'OV', source: 'override', issue: null });
  });

  it('inventory location ไล่ item_group → sub_category → category ด้วยชนิด inventory', () => {
    expect(resolveAccountMapping({ ...base, sub_category: { inventory: 'SC', direct: 'SCD' }, category: { inventory: 'C', direct: null } }).account)
      .toEqual({ code: 'SC', source: 'sub_category', issue: null });
    expect(resolveAccountMapping({ ...base, category: { inventory: 'C', direct: null } }).account)
      .toEqual({ code: 'C', source: 'category', issue: null });
  });

  it('direct location ใช้ชนิด direct และไม่หยิบ inventory มาแทน', () => {
    const r = resolveAccountMapping({ ...base, location_type: 'direct', item_group: { inventory: 'IG', direct: null }, category: { inventory: null, direct: 'CD' } });
    expect(r.account).toEqual({ code: 'CD', source: 'category', issue: null });
  });

  it('ไม่เจอทุกระดับ → issue ตามชนิด', () => {
    expect(resolveAccountMapping(base).account).toEqual({ code: null, source: null, issue: 'missing_inventory_account' });
    expect(resolveAccountMapping({ ...base, location_type: 'direct' }).account)
      .toEqual({ code: null, source: null, issue: 'missing_direct_account' });
  });

  it('cost center: override → location → issue', () => {
    expect(resolveAccountMapping({ ...base, override_cost_center_id: 'cc-ov' }).cost_center).toEqual({ id: 'cc-ov', source: 'override', issue: null });
    expect(resolveAccountMapping(base).cost_center).toEqual({ id: 'cc-loc', source: 'location', issue: null });
    expect(resolveAccountMapping({ ...base, location_cost_center_id: null }).cost_center)
      .toEqual({ id: null, source: null, issue: 'missing_cost_center' });
  });

  it('consignment → skip และไม่ resolve อะไรเลย', () => {
    const r = resolveAccountMapping({ ...base, location_type: 'consignment', override_account_code: 'OV' });
    expect(r.skip).toBe(true);
    expect(r.account.code).toBeNull();
    expect(r.cost_center.id).toBeNull();
  });
});

describe('mappingStatusFlags (SQL CTE ต้องให้ผลเดียวกัน)', () => {
  it.each([
    ['ครบ + default', { ...base, item_group: { inventory: 'IG', direct: null } }, true, { incomplete: false, overridden: false, is_default: true, unreviewed: false }],
    ['ขาดบัญชี', base, true, { incomplete: true, overridden: false, is_default: true, unreviewed: false }],
    ['ขาด cost center', { ...base, location_cost_center_id: null, item_group: { inventory: 'IG', direct: null } }, true, { incomplete: true, overridden: false, is_default: true, unreviewed: false }],
    ['แก้ทับแค่ cost center', { ...base, override_cost_center_id: 'x', item_group: { inventory: 'IG', direct: null } }, false, { incomplete: false, overridden: true, is_default: false, unreviewed: true }],
  ])('%s', (_name, input, reviewed, expected) => {
    expect(mappingStatusFlags(input as ResolveInput, reviewed as boolean)).toEqual(expected);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

```bash
cd apps/micro-business && npx jest src/master/account-mapping/account-mapping.resolver.spec.ts
```

Expected: FAIL `Cannot find module './account-mapping.resolver'`

- [ ] **Step 3: เขียน resolver**

```ts
/**
 * ตัว resolve ค่า mapping บัญชี — แหล่งความจริงเดียวของ "ค่าที่แสดง"
 *
 * ลำดับ (spec §4): account = override → [ชนิดตาม location_type] item_group → sub_category → category
 *                  cost center = override → location
 * CTE ใน account-mapping.service.ts (statusCte) ใช้ลำดับเดียวกันเพื่อกรอง/นับ/แบ่งหน้า —
 * แก้ที่นี่ต้องแก้ที่นั่นด้วย และ mappingStatusFlags ใน spec คือสัญญาของทั้งสองฝั่ง
 */
export type AccountSource = 'override' | 'item_group' | 'sub_category' | 'category';
export type CostCenterSource = 'override' | 'location';
export type AccountIssue = 'missing_inventory_account' | 'missing_direct_account' | 'account_not_in_coa';

type ByType = { inventory: string | null; direct: string | null };

export interface ResolveInput {
  location_type: 'inventory' | 'direct' | 'consignment';
  override_account_code: string | null;
  override_cost_center_id: string | null;
  location_cost_center_id: string | null;
  item_group: ByType;
  sub_category: ByType;
  category: ByType;
}

export interface ResolveOutput {
  skip: boolean;
  account: { code: string | null; source: AccountSource | null; issue: AccountIssue | null };
  cost_center: { id: string | null; source: CostCenterSource | null; issue: 'missing_cost_center' | null };
}

const LEVELS = ['item_group', 'sub_category', 'category'] as const;

export function resolveAccountMapping(input: ResolveInput): ResolveOutput {
  if (input.location_type === 'consignment') {
    return {
      skip: true,
      account: { code: null, source: null, issue: null },
      cost_center: { id: null, source: null, issue: null },
    };
  }

  const kind = input.location_type; // 'inventory' | 'direct'
  let account: ResolveOutput['account'];
  if (input.override_account_code) {
    account = { code: input.override_account_code, source: 'override', issue: null };
  } else {
    const level = LEVELS.find((l) => input[l][kind]);
    account = level
      ? { code: input[level][kind], source: level, issue: null }
      : { code: null, source: null, issue: kind === 'direct' ? 'missing_direct_account' : 'missing_inventory_account' };
  }

  const cost_center: ResolveOutput['cost_center'] = input.override_cost_center_id
    ? { id: input.override_cost_center_id, source: 'override', issue: null }
    : input.location_cost_center_id
      ? { id: input.location_cost_center_id, source: 'location', issue: null }
      : { id: null, source: null, issue: 'missing_cost_center' };

  return { skip: false, account, cost_center };
}

export function mappingStatusFlags(input: ResolveInput, is_reviewed: boolean) {
  const r = resolveAccountMapping(input);
  const overridden = Boolean(input.override_account_code || input.override_cost_center_id);
  return {
    incomplete: !r.skip && (r.account.code === null || r.cost_center.id === null),
    overridden,
    is_default: !overridden,
    unreviewed: !is_reviewed,
  };
}
```

- [ ] **Step 4: รันให้เขียว**

```bash
cd apps/micro-business && npx jest src/master/account-mapping/account-mapping.resolver.spec.ts
```

Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add apps/micro-business/src/master/account-mapping
git commit -m "feat(account-mapping): resolver บัญชี/cost center + เทสต์ decision table ที่ SQL ต้องตรงกัน"
```

---

### Task B4: micro-business — service + controller + RPC contract

**Files:**
- Create: `apps/micro-business/src/master/account-mapping/account-mapping.service.ts`
- Create: `apps/micro-business/src/master/account-mapping/account-mapping.controller.ts`
- Create: `apps/micro-business/src/master/account-mapping/account-mapping.module.ts`
- Create: `apps/micro-business/src/master/account-mapping/dto/account-mapping.dto.ts`
- Modify: `apps/micro-business/src/app.module.ts` (import + `imports` ข้าง `CostCenterModule` ~L75/L377)
- Modify: `packages/error-catalog/src/module.ts` (เพิ่ม `ACCOUNT_MAPPING: 623` ต่อจาก `AR_INVOICE: 622`)
- Modify: `packages/error-catalog/src/catalog.ts` (3 entry)
- Generated: `packages/rpc-contract/**` ผ่าน `bun run gen:rpc-contract`

**Interfaces:**
- Consumes: `resolveAccountMapping`, `mappingStatusFlags`, types จาก Task B3 · `tb_account_mapping` จาก Task B1
- Produces: RPC contract `AccountMapping` ที่มี `findAll`, `update`, `review`, `generate`, `resolve` (payload: `{ user_id, bu_code, version, paginate? , data? }` ตามรูปแบบ `CostCenter`) · service method `resolveForPosting(tx, keys)` (ยังไม่มีผู้เรียก)

DTO (micro-business) — `dto/account-mapping.dto.ts`:

```ts
import { z } from 'zod';

export const MappingKeySchema = z.object({
  mapping_type: z.enum(['AP', 'GL']),
  location_id: z.string().uuid(),
  product_item_group_id: z.string().uuid(),
  movement: z.enum(['grn', 'cn', 'adjustment', 'sr_in', 'sr_out']),
  adjustment_type_id: z.string().uuid().nullable().optional(),
});
export type MappingKey = z.infer<typeof MappingKeySchema>;

export const AccountMappingUpdateSchema = z.object({
  id: z.string().uuid(),
  account_code: z.string().min(1).nullable().optional(),
  cost_center_id: z.string().uuid().nullable().optional(),
  doc_version: z.number().int(),
});
export const AccountMappingReviewSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });
export const AccountMappingGenerateSchema = z.object({
  mapping_type: z.enum(['AP', 'GL']).optional(),
  mode: z.enum(['all', 'used']),
});
export const AccountMappingResolveSchema = z.object({ lines: z.array(MappingKeySchema).min(1).max(500) });
```

- [ ] **Step 1: error catalog**

ใน `packages/error-catalog/src/module.ts` เพิ่ม `ACCOUNT_MAPPING: 623,` ต่อจาก `AR_INVOICE: 622` แล้วใน `catalog.ts` เพิ่มตามรูปแบบเดียวกับ `GL_SETTING_MISSING`:

```ts
  ACCOUNT_MAPPING_ACCOUNT_INVALID: {
    id: makeId(MODULE.ACCOUNT_MAPPING, 1),
    code: 'ACCOUNT_MAPPING_ACCOUNT_INVALID',
    http_status: 422,
    message: 'account_code ไม่มีในผังบัญชี หรือถูกปิดใช้งาน',
  },
  ACCOUNT_MAPPING_COST_CENTER_INVALID: {
    id: makeId(MODULE.ACCOUNT_MAPPING, 2),
    code: 'ACCOUNT_MAPPING_COST_CENTER_INVALID',
    http_status: 422,
    message: 'cost_center_id ไม่มีอยู่ หรือถูกปิดใช้งาน',
  },
  ACCOUNT_MAPPING_NOT_FOUND: {
    id: makeId(MODULE.ACCOUNT_MAPPING, 3),
    code: 'ACCOUNT_MAPPING_NOT_FOUND',
    http_status: 404,
    message: 'ไม่พบแถว mapping',
  },
```

(ถ้า entry ในไฟล์นั้นใช้ field ต่างจากนี้ เช่นมี `message_th` / `message_en` ให้ใช้ชุด field เดียวกับ `GL_SETTING_MISSING` เสมอ) แล้ว build package: `bun run build:package`

- [ ] **Step 2: service — โครง + SQL ส่วนกลาง**

`account-mapping.service.ts` (ตามรูปแบบ `CostCenterService`: `extends TenantScopedService`, `@TryCatch`, `Result`):

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, tenantTableRef } from '@repo/prisma-shared-schema-tenant';
import { Result } from '@repo/nest-result';
import { ERROR_CATALOG } from '@repo/error-catalog';
import { TenantScopedService } from '@/common/tenant-scoped.service';
import { TryCatch } from '@/common/decorators/try-catch.decorator';
import { resolveAccountMapping, type ResolveInput } from './account-mapping.resolver';
import type { MappingKey } from './dto/account-mapping.dto';

const NIL = '00000000-0000-0000-0000-000000000000';
const AP_MOVEMENTS = ['grn', 'cn'] as const;
const STATUS = ['incomplete', 'overridden', 'default', 'unreviewed'] as const;
type Status = (typeof STATUS)[number];

export interface AccountMappingListQuery {
  mapping_type: 'AP' | 'GL';
  page: number;
  perpage: number;
  search?: string;
  location_id?: string;
  location_type?: 'inventory' | 'direct';
  category_id?: string;
  sub_category_id?: string;
  product_item_group_id?: string;
  movement?: string;
  adjustment_type_id?: string;
  status?: Status;
}

@Injectable()
export class AccountMappingService extends TenantScopedService {
  private t(name: string): Prisma.Sql {
    return Prisma.raw(tenantTableRef(this.prismaService, name));
  }

  /**
   * CTE: ทุกแถวที่มีชีวิตของ mapping_type + ผล resolve แบบ COALESCE
   * ลำดับต้องตรงกับ resolveAccountMapping() — ดู account-mapping.resolver.spec.ts
   */
  private statusCte(mappingType: 'AP' | 'GL'): Prisma.Sql {
    const pacm = this.t('tb_product_account_code_mapping');
    return Prisma.sql`
      WITH r AS (
        SELECT m.*,
               l.location_type,
               ig.product_subcategory_id AS sub_category_id,
               sc.product_category_id    AS category_id,
               COALESCE(m.account_code, a_ig.account_code, a_sc.account_code, a_c.account_code) AS resolved_account,
               COALESCE(m.cost_center_id, l.cost_center_id) AS resolved_cost_center
          FROM ${this.t('tb_account_mapping')} m
          JOIN ${this.t('tb_location')} l             ON l.id = m.location_id AND l.deleted_at IS NULL
          JOIN ${this.t('tb_product_item_group')} ig  ON ig.id = m.product_item_group_id AND ig.deleted_at IS NULL
          JOIN ${this.t('tb_product_sub_category')} sc ON sc.id = ig.product_subcategory_id
          CROSS JOIN LATERAL (SELECT (CASE WHEN l.location_type = 'direct' THEN 'direct' ELSE 'inventory' END)::text AS kind) k
          LEFT JOIN ${pacm} a_ig ON a_ig.product_item_group_id = ig.id AND a_ig.account_type::text = k.kind AND a_ig.deleted_at IS NULL
          LEFT JOIN ${pacm} a_sc ON a_sc.product_sub_category_id = sc.id AND a_sc.account_type::text = k.kind AND a_sc.deleted_at IS NULL
          LEFT JOIN ${pacm} a_c  ON a_c.product_category_id = sc.product_category_id AND a_c.account_type::text = k.kind AND a_c.deleted_at IS NULL
         WHERE m.deleted_at IS NULL
           AND m.mapping_type = ${mappingType}::"enum_account_mapping_type"
           AND l.location_type <> 'consignment'
      )`;
  }

  private statusWhere(status?: Status): Prisma.Sql {
    switch (status) {
      case 'incomplete': return Prisma.sql`AND (r.resolved_account IS NULL OR r.resolved_cost_center IS NULL)`;
      case 'overridden': return Prisma.sql`AND (r.account_code IS NOT NULL OR r.cost_center_id IS NOT NULL)`;
      case 'default':    return Prisma.sql`AND r.account_code IS NULL AND r.cost_center_id IS NULL`;
      case 'unreviewed': return Prisma.sql`AND r.is_reviewed = false`;
      default:           return Prisma.empty;
    }
  }
}
```

- [ ] **Step 3: service — `findAll`**

เพิ่มใน class:

```ts
  @TryCatch
  async findAll(q: AccountMappingListQuery) {
    const perpage = Math.min(Math.max(q.perpage || 10, 1), 100);
    const page = Math.max(q.page || 1, 1);
    const like = q.search ? `%${q.search.trim()}%` : null;
    const filters = Prisma.sql`
      ${q.location_id ? Prisma.sql`AND r.location_id = ${q.location_id}::uuid` : Prisma.empty}
      ${q.location_type ? Prisma.sql`AND r.location_type::text = ${q.location_type}` : Prisma.empty}
      ${q.category_id ? Prisma.sql`AND r.category_id = ${q.category_id}::uuid` : Prisma.empty}
      ${q.sub_category_id ? Prisma.sql`AND r.sub_category_id = ${q.sub_category_id}::uuid` : Prisma.empty}
      ${q.product_item_group_id ? Prisma.sql`AND r.product_item_group_id = ${q.product_item_group_id}::uuid` : Prisma.empty}
      ${q.movement ? Prisma.sql`AND r.movement::text = ${q.movement}` : Prisma.empty}
      ${q.adjustment_type_id ? Prisma.sql`AND r.adjustment_type_id = ${q.adjustment_type_id}::uuid` : Prisma.empty}
      ${like ? Prisma.sql`AND (r.resolved_account ILIKE ${like}
            OR EXISTS (SELECT 1 FROM ${this.t('tb_location')} x WHERE x.id = r.location_id AND (x.code ILIKE ${like} OR x.name ILIKE ${like}))
            OR EXISTS (SELECT 1 FROM ${this.t('tb_product_item_group')} x WHERE x.id = r.product_item_group_id AND (x.code ILIKE ${like} OR x.name ILIKE ${like})))`
        : Prisma.empty}`;
    const cte = this.statusCte(q.mapping_type);

    const [ids, totals, counts] = await Promise.all([
      this.prismaService.$queryRaw<{ id: string }[]>`
        ${cte} SELECT r.id FROM r WHERE true ${filters} ${this.statusWhere(q.status)}
        ORDER BY r.location_id, r.product_item_group_id, r.movement, r.adjustment_type_id NULLS FIRST
        LIMIT ${perpage} OFFSET ${(page - 1) * perpage}`,
      this.prismaService.$queryRaw<{ total: bigint }[]>`
        ${cte} SELECT count(*) AS total FROM r WHERE true ${filters} ${this.statusWhere(q.status)}`,
      // นับแยก status จากชุดที่ผ่านตัวกรองอื่นแล้ว (ไม่รวม status) เพื่อโชว์บน chip
      this.prismaService.$queryRaw<Record<Status, bigint>[]>`
        ${cte} SELECT
          count(*) FILTER (WHERE r.resolved_account IS NULL OR r.resolved_cost_center IS NULL) AS incomplete,
          count(*) FILTER (WHERE r.account_code IS NOT NULL OR r.cost_center_id IS NOT NULL)   AS overridden,
          count(*) FILTER (WHERE r.account_code IS NULL AND r.cost_center_id IS NULL)          AS "default",
          count(*) FILTER (WHERE r.is_reviewed = false)                                        AS unreviewed
        FROM r WHERE true ${filters}`,
    ]);

    const data = await this.hydrate(ids.map((x) => x.id));
    const total = Number(totals[0]?.total ?? 0);
    const c = counts[0];
    return Result.ok({
      paginate: { total, page, perpage, pages: Math.ceil(total / perpage) },
      data,
      meta: { counts: Object.fromEntries(STATUS.map((s) => [s, Number(c?.[s] ?? 0)])) },
    });
  }
```

ก่อนใช้ ต้องเปิด `Result.ok` / `handlePaginatedResult` ใน `BaseMicroserviceController` ดูว่าส่ง field `meta` ผ่านไปถึง gateway ได้หรือไม่ ถ้าระบบส่งต่อเฉพาะ `paginate` + `data` ให้ย้าย `counts` ไปไว้ใน `paginate.counts` แทน แล้วใช้ชื่อนั้นชื่อเดียวทั้ง Task B5 และ F1

- [ ] **Step 4: service — `hydrate` (resolve ชุดต่อหน้าด้วย resolver ใน TS)**

```ts
  /** โหลด master ของ id ที่ได้ทั้งหน้า (query ละ 1 ครั้ง) แล้ว resolve ใน TS — ลำดับผลลัพธ์ตาม ids */
  private async hydrate(ids: string[]) {
    if (!ids.length) return [];
    const p = this.prismaService;
    const rows = await p.tb_account_mapping.findMany({
      where: { id: { in: ids } },
      include: {
        tb_location: { select: { id: true, code: true, name: true, location_type: true, cost_center_id: true } },
        tb_adjustment_type: { select: { id: true, code: true, name: true, type: true } },
        tb_product_item_group: {
          select: {
            id: true, code: true, name: true,
            tb_product_sub_category: {
              select: { id: true, code: true, name: true, tb_product_category: { select: { id: true, code: true, name: true } } },
            },
          },
        },
      },
    });
    const igIds = rows.map((r) => r.product_item_group_id);
    const scIds = rows.map((r) => r.tb_product_item_group.tb_product_sub_category.id);
    const cIds = rows.map((r) => r.tb_product_item_group.tb_product_sub_category.tb_product_category.id);
    const codes = await p.tb_product_account_code_mapping.findMany({
      where: {
        account_type: { in: ['inventory', 'direct'] },
        OR: [
          { product_item_group_id: { in: igIds } },
          { product_sub_category_id: { in: scIds } },
          { product_category_id: { in: cIds } },
        ],
      },
      select: { account_type: true, account_code: true, product_item_group_id: true, product_sub_category_id: true, product_category_id: true },
    });
    const byOwner = (owner: 'product_item_group_id' | 'product_sub_category_id' | 'product_category_id', id: string) => ({
      inventory: codes.find((c) => c[owner] === id && c.account_type === 'inventory')?.account_code ?? null,
      direct: codes.find((c) => c[owner] === id && c.account_type === 'direct')?.account_code ?? null,
    });

    const resolved = rows.map((r) => {
      const sc = r.tb_product_item_group.tb_product_sub_category;
      const input: ResolveInput = {
        location_type: r.tb_location.location_type,
        override_account_code: r.account_code,
        override_cost_center_id: r.cost_center_id,
        location_cost_center_id: r.tb_location.cost_center_id,
        item_group: byOwner('product_item_group_id', r.product_item_group_id),
        sub_category: byOwner('product_sub_category_id', sc.id),
        category: byOwner('product_category_id', sc.tb_product_category.id),
      };
      return { r, sc, out: resolveAccountMapping(input) };
    });

    const accountCodes = [...new Set(resolved.map((x) => x.out.account.code).filter((c): c is string => !!c))];
    const ccIds = [...new Set(resolved.map((x) => x.out.cost_center.id).filter((c): c is string => !!c))];
    const [coa, ccs] = await Promise.all([
      p.tb_chart_of_accounts.findMany({ where: { code: { in: accountCodes } }, select: { code: true, description_1: true } }),
      p.tb_cost_center.findMany({ where: { id: { in: ccIds } }, select: { id: true, code: true, name: true } }),
    ]);

    const byId = new Map(resolved.map((x) => [x.r.id, x]));
    return ids.map((id) => byId.get(id)!).filter(Boolean).map(({ r, sc, out }) => {
      const coaRow = out.account.code ? coa.find((a) => a.code === out.account.code) : undefined;
      const cc = out.cost_center.id ? ccs.find((c) => c.id === out.cost_center.id) : undefined;
      return {
        id: r.id,
        doc_version: r.doc_version,
        mapping_type: r.mapping_type,
        movement: r.movement,
        origin: r.origin,
        is_reviewed: r.is_reviewed,
        location: { id: r.tb_location.id, code: r.tb_location.code, name: r.tb_location.name, location_type: r.tb_location.location_type },
        category: { id: sc.tb_product_category.id, code: sc.tb_product_category.code, name: sc.tb_product_category.name },
        sub_category: { id: sc.id, code: sc.code, name: sc.name },
        item_group: { id: r.tb_product_item_group.id, code: r.tb_product_item_group.code, name: r.tb_product_item_group.name },
        adjustment_type: r.tb_adjustment_type ?? null,
        account: {
          code: out.account.code,
          name: coaRow?.description_1 ?? null,
          source: out.account.source,
          issue: out.account.code && !coaRow ? 'account_not_in_coa' : out.account.issue,
        },
        cost_center: { id: out.cost_center.id, code: cc?.code ?? null, name: cc?.name ?? null, source: out.cost_center.source, issue: out.cost_center.issue },
        audit: { created_at: r.created_at, created_by_id: r.created_by_id, updated_at: r.updated_at, updated_by_id: r.updated_by_id },
      };
    });
  }
```

- [ ] **Step 5: service — `update`, `review`**

```ts
  @TryCatch
  async update(data: { id: string; account_code?: string | null; cost_center_id?: string | null; doc_version: number }) {
    const p = this.prismaService;
    if (typeof data.doc_version !== 'number') return Result.errorFromCatalog(ERROR_CATALOG.COMMON_DOC_VERSION_REQUIRED);
    const exists = await p.tb_account_mapping.findFirst({ where: { id: data.id }, select: { id: true } });
    if (!exists) return Result.errorFromCatalog(ERROR_CATALOG.ACCOUNT_MAPPING_NOT_FOUND);
    if (data.account_code) {
      const coa = await p.tb_chart_of_accounts.findFirst({ where: { code: data.account_code, is_active: true }, select: { id: true } });
      if (!coa) return Result.errorFromCatalog(ERROR_CATALOG.ACCOUNT_MAPPING_ACCOUNT_INVALID);
    }
    if (data.cost_center_id) {
      const cc = await p.tb_cost_center.findFirst({ where: { id: data.cost_center_id, is_active: true }, select: { id: true } });
      if (!cc) return Result.errorFromCatalog(ERROR_CATALOG.ACCOUNT_MAPPING_COST_CENTER_INVALID);
    }
    // where.doc_version → Prisma extension ตรวจ+บวกเวอร์ชันให้ และโยน OptimisticLockError (→ 409 ผ่าน @TryCatch)
    await p.tb_account_mapping.update({
      where: { id: data.id, doc_version: data.doc_version },
      data: {
        ...(data.account_code !== undefined ? { account_code: data.account_code } : {}),
        ...(data.cost_center_id !== undefined ? { cost_center_id: data.cost_center_id } : {}),
        is_reviewed: true,
        updated_by_id: this.userId,
        updated_at: new Date(),
      },
    });
    const [row] = await this.hydrate([data.id]);
    return Result.ok(row);
  }

  @TryCatch
  async review(data: { ids: string[] }) {
    const res = await this.prismaService.tb_account_mapping.updateMany({
      where: { id: { in: data.ids }, is_reviewed: false },
      data: { is_reviewed: true, updated_by_id: this.userId, updated_at: new Date() },
    });
    return Result.ok({ updated: res.count });
  }
```

ข้อควรตรวจ: `tb_chart_of_accounts` ใช้ `is_active` หรือไม่ ให้เปิด schema ที่ ~L3057 แล้วใช้ชื่อ field จริง ทำแบบเดียวกับ `tb_cost_center.is_active` (Boolean?)

- [ ] **Step 6: service — `generate`**

```ts
  @TryCatch
  async generate(data: { mapping_type?: 'AP' | 'GL'; mode: 'all' | 'used' }) {
    const types = data.mapping_type ? [data.mapping_type] : (['AP', 'GL'] as const);
    const created: Record<string, number> = { AP: 0, GL: 0 };
    const existing: Record<string, number> = { AP: 0, GL: 0 };
    for (const type of types) {
      const n = await this.prismaService.$executeRaw`
        WITH pairs AS (${this.pairsSql(data.mode)}),
        mv AS (${this.movementsSql(type)})
        INSERT INTO ${this.t('tb_account_mapping')}
          (mapping_type, location_id, product_item_group_id, movement, adjustment_type_id, origin, is_reviewed, created_by_id, updated_by_id)
        SELECT ${type}::"enum_account_mapping_type", pairs.location_id, pairs.product_item_group_id,
               mv.movement::"enum_account_mapping_movement", mv.adjustment_type_id,
               ${data.mode === 'all' ? 'generated_all' : 'generated_used'}::"enum_account_mapping_origin", true,
               ${this.userId}::uuid, ${this.userId}::uuid
          FROM pairs CROSS JOIN mv
        ON CONFLICT (mapping_type, location_id, product_item_group_id, movement,
                     COALESCE(adjustment_type_id, '00000000-0000-0000-0000-000000000000'::uuid))
          WHERE deleted_at IS NULL
        DO NOTHING`;
      const total = await this.prismaService.tb_account_mapping.count({ where: { mapping_type: type } });
      created[type] = n;
      existing[type] = total - n;
    }
    return Result.ok({ created, existing });
  }

  /** คู่ (location, item group) — ตัด consignment และของที่ถูกลบ/ปิดเสมอ */
  private pairsSql(mode: 'all' | 'used'): Prisma.Sql {
    const loc = this.t('tb_location');
    const ig = this.t('tb_product_item_group');
    const prod = this.t('tb_product');
    const liveLoc = Prisma.sql`l.deleted_at IS NULL AND COALESCE(l.is_active, true) AND l.location_type <> 'consignment'`;
    if (mode === 'all') {
      return Prisma.sql`
        SELECT l.id AS location_id, g.id AS product_item_group_id
          FROM ${loc} l CROSS JOIN ${ig} g
         WHERE ${liveLoc} AND g.deleted_at IS NULL AND COALESCE(g.is_active, true)`;
    }
    // used = สินค้าที่ผูก location ∪ บรรทัดธุรกรรม (GRN, CN, stock in/out, SR ทั้งต้นทางและปลายทาง)
    return Prisma.sql`
      SELECT DISTINCT u.location_id, p.product_item_group_id
        FROM (
          SELECT location_id, product_id FROM ${this.t('tb_product_location')} WHERE deleted_at IS NULL
          UNION SELECT location_id, product_id FROM ${this.t('tb_good_received_note_detail')} WHERE deleted_at IS NULL
          UNION SELECT location_id, product_id FROM ${this.t('tb_credit_note_detail')} WHERE deleted_at IS NULL
          UNION SELECT h.location_id, d.product_id FROM ${this.t('tb_stock_in_detail')} d JOIN ${this.t('tb_stock_in')} h ON h.id = d.stock_in_id WHERE d.deleted_at IS NULL AND h.deleted_at IS NULL
          UNION SELECT h.location_id, d.product_id FROM ${this.t('tb_stock_out_detail')} d JOIN ${this.t('tb_stock_out')} h ON h.id = d.stock_out_id WHERE d.deleted_at IS NULL AND h.deleted_at IS NULL
          UNION SELECT h.from_location_id, d.product_id FROM ${this.t('tb_store_requisition_detail')} d JOIN ${this.t('tb_store_requisition')} h ON h.id = d.store_requisition_id WHERE d.deleted_at IS NULL AND h.deleted_at IS NULL
          UNION SELECT h.to_location_id, d.product_id FROM ${this.t('tb_store_requisition_detail')} d JOIN ${this.t('tb_store_requisition')} h ON h.id = d.store_requisition_id WHERE d.deleted_at IS NULL AND h.deleted_at IS NULL
        ) u
        JOIN ${prod} p ON p.id = u.product_id AND p.product_item_group_id IS NOT NULL
        JOIN ${loc} l ON l.id = u.location_id
       WHERE ${liveLoc}`;
  }

  private movementsSql(type: 'AP' | 'GL'): Prisma.Sql {
    if (type === 'AP') {
      return Prisma.sql`SELECT unnest(ARRAY['grn','cn']) AS movement, NULL::uuid AS adjustment_type_id`;
    }
    return Prisma.sql`
      SELECT 'sr_in' AS movement, NULL::uuid AS adjustment_type_id
      UNION ALL SELECT 'sr_out', NULL::uuid
      UNION ALL SELECT 'adjustment', a.id FROM ${this.t('tb_adjustment_type')} a
                 WHERE a.deleted_at IS NULL AND COALESCE(a.is_active, true)`;
  }
```

ข้อควรตรวจก่อนรัน: แต่ละตาราง detail มีคอลัมน์ `deleted_at` จริงหรือไม่ (`grep -n "^model tb_credit_note_detail" -A60 schema.prisma | grep deleted_at` และทำแบบเดียวกันกับ stock_in/stock_out/store_requisition detail) ตารางไหนไม่มีให้ตัดเงื่อนไข `deleted_at` ของตารางนั้นออก ส่วน `AP_MOVEMENTS` ที่ประกาศไว้ใน Step 2 ถ้าไม่ได้ใช้ให้ลบทิ้งเพื่อให้ lint ผ่าน

- [ ] **Step 7: service — `resolve` + `resolveForPosting`**

```ts
  /** read-only — ไม่สร้างแถว (spec §5.5) */
  @TryCatch
  async resolve(data: { lines: MappingKey[] }) {
    return Result.ok({ results: await this.resolveKeys(data.lines) });
  }

  /**
   * สำหรับ spec posting (ยังไม่มีผู้เรียก): key ที่ยังไม่มีแถว → insert origin=auto_posting, is_reviewed=false
   * ใน transaction ของผู้เรียก แล้ว resolve
   */
  async resolveForPosting(tx: Prisma.TransactionClient, lines: MappingKey[]) {
    for (const k of lines) {
      await tx.$executeRaw`
        INSERT INTO ${this.t('tb_account_mapping')}
          (mapping_type, location_id, product_item_group_id, movement, adjustment_type_id, origin, is_reviewed, created_by_id)
        SELECT ${k.mapping_type}::"enum_account_mapping_type", ${k.location_id}::uuid, ${k.product_item_group_id}::uuid,
               ${k.movement}::"enum_account_mapping_movement", ${k.adjustment_type_id ?? null}::uuid,
               'auto_posting'::"enum_account_mapping_origin", false, ${this.userId}::uuid
          FROM ${this.t('tb_location')} l WHERE l.id = ${k.location_id}::uuid AND l.location_type <> 'consignment'
        ON CONFLICT (mapping_type, location_id, product_item_group_id, movement,
                     COALESCE(adjustment_type_id, '00000000-0000-0000-0000-000000000000'::uuid))
          WHERE deleted_at IS NULL
        DO NOTHING`;
    }
    return this.resolveKeys(lines);
  }

  private async resolveKeys(lines: MappingKey[]) {
    const p = this.prismaService;
    const rows = await p.tb_account_mapping.findMany({
      where: {
        OR: lines.map((k) => ({
          mapping_type: k.mapping_type, location_id: k.location_id, product_item_group_id: k.product_item_group_id,
          movement: k.movement, adjustment_type_id: k.adjustment_type_id ?? null,
        })),
      },
      select: { id: true, mapping_type: true, location_id: true, product_item_group_id: true, movement: true, adjustment_type_id: true },
    });
    const hydrated = await this.hydrate(rows.map((r) => r.id));
    // key ที่ยังไม่มีแถว: resolve จาก master ล้วน ผ่าน hydrateVirtual
    return Promise.all(lines.map(async (k) => {
      const row = rows.find((r) => r.mapping_type === k.mapping_type && r.location_id === k.location_id
        && r.product_item_group_id === k.product_item_group_id && r.movement === k.movement
        && (r.adjustment_type_id ?? null) === (k.adjustment_type_id ?? null));
      const h = row ? hydrated.find((x) => x.id === row.id) : await this.hydrateVirtual(k);
      return { key: k, skip: h ? false : true, account: h?.account ?? null, cost_center: h?.cost_center ?? null };
    }));
  }

  /** resolve key ที่ไม่มีแถว — override เป็น null ทั้งคู่; consignment หรือไม่พบ location/item group → null (= skip) */
  private async hydrateVirtual(k: MappingKey) {
    const p = this.prismaService;
    const [loc, ig] = await Promise.all([
      p.tb_location.findFirst({ where: { id: k.location_id }, select: { location_type: true, cost_center_id: true } }),
      p.tb_product_item_group.findFirst({
        where: { id: k.product_item_group_id },
        select: { id: true, tb_product_sub_category: { select: { id: true, product_category_id: true } } },
      }),
    ]);
    if (!loc || !ig) return null;
    const codes = await p.tb_product_account_code_mapping.findMany({
      where: {
        account_type: { in: ['inventory', 'direct'] },
        OR: [
          { product_item_group_id: ig.id },
          { product_sub_category_id: ig.tb_product_sub_category.id },
          { product_category_id: ig.tb_product_sub_category.product_category_id },
        ],
      },
      select: { account_type: true, account_code: true, product_item_group_id: true, product_sub_category_id: true, product_category_id: true },
    });
    const pick = (owner: 'product_item_group_id' | 'product_sub_category_id' | 'product_category_id', id: string) => ({
      inventory: codes.find((c) => c[owner] === id && c.account_type === 'inventory')?.account_code ?? null,
      direct: codes.find((c) => c[owner] === id && c.account_type === 'direct')?.account_code ?? null,
    });
    const out = resolveAccountMapping({
      location_type: loc.location_type,
      override_account_code: null,
      override_cost_center_id: null,
      location_cost_center_id: loc.cost_center_id,
      item_group: pick('product_item_group_id', ig.id),
      sub_category: pick('product_sub_category_id', ig.tb_product_sub_category.id),
      category: pick('product_category_id', ig.tb_product_sub_category.product_category_id),
    });
    if (out.skip) return null;
    return { account: { ...out.account, name: null }, cost_center: { ...out.cost_center, code: null, name: null } };
  }
```

`hydrateVirtual` ทำงานทีละ key ซึ่งรับได้ เพราะ `/resolve` จำกัดไว้ 500 บรรทัด และ key ที่ไม่มีแถวคาดว่าจะมีน้อย ถ้า reviewer ขอให้รวมเป็นชุด ให้ย้าย `codes` ไปโหลดครั้งเดียวด้วยรูปแบบเดียวกับ `hydrate`

- [ ] **Step 8: controller + module + contract**

controller ใช้รูปแบบเดียวกับ `cost-center.controller.ts` ในขั้นแรกให้ใส่ pattern เป็น object literal ชั่วคราว (เปิด `packages/rpc-contract/src` ดูรูปของ `CostCenter.findAll` แล้วใช้รูปเดียวกัน) จากนั้นรัน `bun run gen:rpc-contract` แล้วแทนที่ด้วย `AccountMapping.x.pattern`:

```ts
@Controller()
export class AccountMappingController extends BaseMicroserviceController {
  constructor(private readonly service: AccountMappingService, private readonly ctx: TenantContextRunner) { super(); }

  @MessagePattern(AccountMapping.findAll.pattern)
  async findAll(@Payload() payload: MicroservicePayload): Promise<MicroserviceResponse> {
    return this.handlePaginatedResult(await this.ctx.run(payload, () => this.service.findAll(payload.data)));
  }

  @MessagePattern(AccountMapping.update.pattern)
  async update(@Payload() payload: MicroservicePayload): Promise<MicroserviceResponse> {
    return this.handleResult(await this.ctx.run(payload, () => this.service.update(AccountMappingUpdateSchema.parse(payload.data))));
  }

  @MessagePattern(AccountMapping.review.pattern)
  async review(@Payload() payload: MicroservicePayload): Promise<MicroserviceResponse> {
    return this.handleResult(await this.ctx.run(payload, () => this.service.review(AccountMappingReviewSchema.parse(payload.data))));
  }

  @MessagePattern(AccountMapping.generate.pattern)
  async generate(@Payload() payload: MicroservicePayload): Promise<MicroserviceResponse> {
    return this.handleResult(
      await this.ctx.run(payload, () => this.service.generate(AccountMappingGenerateSchema.parse(payload.data))),
      HttpStatus.CREATED,
    );
  }

  @MessagePattern(AccountMapping.resolve.pattern)
  async resolve(@Payload() payload: MicroservicePayload): Promise<MicroserviceResponse> {
    return this.handleResult(await this.ctx.run(payload, () => this.service.resolve(AccountMappingResolveSchema.parse(payload.data))));
  }
}
```

`findAll` รับ `payload.data` เป็น `AccountMappingListQuery` ที่ gateway แปลงมาแล้ว (Task B5) ไม่ได้ใช้ `payload.paginate` เพราะมีตัวกรองเฉพาะที่ `IPaginate` ไม่มี ส่วน module ใช้ `imports: [TenantModule, CommonModule]`, `controllers: [AccountMappingController]`, `providers: [AccountMappingService]`, `exports: [AccountMappingService]` แล้วเพิ่มเข้า `app.module.ts`

- [ ] **Step 9: typecheck + jest เดิม + ตรวจด้วยมือ (Review Focus 1–5)**

```bash
cd apps/micro-business && npx tsc --noEmit -p tsconfig.json && npx jest && cd ../.. && bun run audit:raw-sql
```

ตรวจด้วยมือหลังทำ Task B5 เสร็จ เพราะต้องยิงผ่าน gateway โดยใช้ env/token ของ dev ตาม memory `local-backend-test-accounts` เก็บ token ไว้ในตัวแปร shell `$TOKEN` ห้ามใส่ token ในไฟล์ แล้วให้ `$BU` เป็นรหัส BU ทดสอบ **ก่อนเริ่มต้อง backup ตาราง `tb_account_mapping` และ `tb_location` ของ BU นั้น**

```bash
H=(-H "Authorization: Bearer $TOKEN" -H "x-app-id: $APP_ID" -H 'content-type: application/json')
B=http://localhost:4000/api/$BU/account-mapping
curl -s "${H[@]}" -X POST $B/generate -d '{"mode":"used"}' | jq .data          # created > 0
curl -s "${H[@]}" -X POST $B/generate -d '{"mode":"used"}' | jq .data          # (RF1) created = 0 ทั้ง AP/GL
curl -s "${H[@]}" -X POST $B/generate -d '{"mode":"all"}'  | jq .data          # created เพิ่ม, ไม่มี 42P10
curl -s "${H[@]}" "$B?mapping_type=GL&perpage=500" | jq '.paginate.perpage'    # 100
curl -s "${H[@]}" "$B?mapping_type=AP&status=incomplete&perpage=100" \
  | jq '[.data[] | select(.account.code != null and .cost_center.id != null)] | length'   # (RF2) 0
ID=$(curl -s "${H[@]}" "$B?mapping_type=AP&perpage=1" | jq -r '.data[0].id'); V=$(curl -s "${H[@]}" "$B?mapping_type=AP&perpage=1" | jq '.data[0].doc_version')
curl -s -o /dev/null -w '%{http_code}\n' "${H[@]}" -X PATCH $B/$ID -d "{\"account_code\":\"NOPE-999\",\"doc_version\":$V}"   # (RF4) 422
curl -s -o /dev/null -w '%{http_code}\n' "${H[@]}" -X PATCH $B/$ID -d "{\"cost_center_id\":null,\"doc_version\":$V}"         # 200
curl -s -o /dev/null -w '%{http_code}\n' "${H[@]}" -X PATCH $B/$ID -d "{\"cost_center_id\":null,\"doc_version\":$V}"         # (RF5) 409
```

**(RF3)** เปลี่ยน location ทดสอบหนึ่งตัวให้เป็น consignment ผ่าน PATCH location แล้วยืนยันว่า list ไม่มีแถวของ location นั้น และ `POST $B/resolve` ด้วย key ของมันคืน `skip: true` เสร็จแล้วเปลี่ยนกลับ

ถ้าทุกข้อผ่านตามที่ระบุ ให้คืนข้อมูลจาก backup ถ้าไม่ต้องการเก็บแถวทดสอบไว้

- [ ] **Step 10: Commit**

```bash
git add apps/micro-business/src/master/account-mapping apps/micro-business/src/app.module.ts packages/error-catalog packages/rpc-contract
git commit -m "feat(account-mapping): micro-business list/patch/review/generate/resolve + resolveForPosting"
```

---

### Task B5: gateway — endpoint, สิทธิ์, allowlist

**Files:**
- Create: `apps/backend-gateway/src/application/account-mapping/account-mapping.controller.ts`
- Create: `apps/backend-gateway/src/application/account-mapping/account-mapping.service.ts`
- Create: `apps/backend-gateway/src/application/account-mapping/account-mapping.module.ts`
- Create: `apps/backend-gateway/src/application/account-mapping/swagger/request.ts`, `swagger/response.ts`
- Create: `apps/backend-gateway/src/common/dto/account-mapping/account-mapping.dto.ts`, `account-mapping.serializer.ts` (+ export ใน `common/dto/index.ts`)
- Modify: `apps/backend-gateway/src/application/route-application.ts` (ข้าง `GlJvTemplatesModule` L9/L124)
- Modify: `packages/prisma-shared-schema-platform/prisma/seed.permission.data.ts` (resource ใหม่)
- Modify: `permission.route-map.ts` (`ROUTE_RESOURCE_MAP`, `SUB_PATH_ACTION_OVERRIDES`, ถอดออกจาก `LICENSE_ONLY_RESOURCES` L431-433) ให้หา path ด้วย `grep -rln "LICENSE_ONLY_RESOURCES" packages apps --include=*.ts | grep -v dist`
- Regenerate: `apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts`

**Interfaces:**
- Consumes: contract `AccountMapping.*` (Task B4)
- Produces (สิ่งที่ FE ใช้):
  - `GET /api/:bu_code/account-mapping?mapping_type&page&perpage&search&location_id&location_type&category_id&sub_category_id&product_item_group_id&movement&adjustment_type_id&status` → `{ data: AccountMappingRow[], paginate: {total,page,perpage,pages}, meta: { counts } }` (หรือ `paginate.counts` ตามที่ตัดสินใน B4 Step 3)
  - `PATCH /api/:bu_code/account-mapping/:id` body `{account_code?, cost_center_id?, doc_version}` → `{ data: AccountMappingRow }`
  - `POST /api/:bu_code/account-mapping/review` `{ids}` → `{ data: {updated} }`
  - `POST /api/:bu_code/account-mapping/generate` `{mapping_type?, mode}` → 201 `{ data: {created:{AP,GL}, existing:{AP,GL}} }`
  - `POST /api/:bu_code/account-mapping/resolve` `{lines}` → `{ data: {results} }`
  - api_name: `account-mapping.findAll`, `account-mapping.update`, `account-mapping.review`, `account-mapping.generate`, `account-mapping.resolve`

- [ ] **Step 1: DTO + serializer (Zod)**

`common/dto/account-mapping/account-mapping.dto.ts` ใช้ schema ชุดเดียวกับ micro (Task B4) ยกเว้น update ที่ตัด `id` ออกเพราะ `id` มาจาก path แล้วห่อด้วย `class X extends createZodDto(Schema)` ตามแบบ `cost-center.dto.ts`

`account-mapping.serializer.ts`:

```ts
const Ref = z.object({ id: z.string(), code: z.string(), name: z.string() });
export const AccountMappingRowSchema = z.object({
  id: z.string(), doc_version: z.number(), mapping_type: z.enum(['AP', 'GL']),
  movement: z.enum(['grn', 'cn', 'adjustment', 'sr_in', 'sr_out']),
  origin: z.enum(['generated_all', 'generated_used', 'auto_posting']), is_reviewed: z.boolean(),
  location: Ref.extend({ location_type: z.enum(['inventory', 'direct', 'consignment']) }),
  category: Ref, sub_category: Ref, item_group: Ref,
  adjustment_type: Ref.extend({ type: z.string() }).nullable(),
  account: z.object({ code: z.string().nullable(), name: z.string().nullable(),
    source: z.enum(['override', 'item_group', 'sub_category', 'category']).nullable(),
    issue: z.enum(['missing_inventory_account', 'missing_direct_account', 'account_not_in_coa']).nullable() }),
  cost_center: z.object({ id: z.string().nullable(), code: z.string().nullable(), name: z.string().nullable(),
    source: z.enum(['override', 'location']).nullable(), issue: z.enum(['missing_cost_center']).nullable() }),
  audit: z.record(z.any()).optional(),
});
```

**ข้อควรระวัง:** `@Serialize` จะตัด field ที่ไม่ได้ประกาศทิ้ง (memory `backend-add-field-serializer-gotcha`) จึงต้องประกาศ field ให้ครบตามข้างบน

- [ ] **Step 2: controller**

```ts
const RESOURCE = 'configuration.chart_of_account_mapping';

@Controller('api/:bu_code/account-mapping')
@ApiTags('Config: Chart of Account Mapping')
@ApiHeaderRequiredXAppId()
@UseGuards(KeycloakGuard, PermissionGuard)
@ApiBearerAuth()
export class AccountMappingController extends BaseHttpController {
  constructor(private readonly svc: AccountMappingGatewayService) { super(); }

  @Get()
  @UseGuards(new AppIdGuard('account-mapping.findAll'))
  @Permission({ [RESOURCE]: ['view'] })
  @Serialize(AccountMappingRowSchema)
  async findAll(@Req() req, @Res() res, @Param('bu_code') bu_code: string, @Query() query: Record<string, string>,
    @Query('version') version = 'latest') {
    const { user_id } = ExtractRequestHeader(req);
    this.respond(res, await this.svc.findAll(user_id, bu_code, AccountMappingListQuerySchema.parse(query), version));
  }

  @Patch(':id')
  @UseGuards(new AppIdGuard('account-mapping.update'))
  @Permission({ [RESOURCE]: ['update'] })
  @Serialize(AccountMappingRowSchema)
  async update(@Req() req, @Res() res, @Param('bu_code') bu_code: string, @Param('id') id: string,
    @Body() body: AccountMappingUpdateDto, @Query('version') version = 'latest') {
    const { user_id } = ExtractRequestHeader(req);
    this.respond(res, await this.svc.update(user_id, bu_code, { id, ...body }, version));
  }

  @Post('review')
  @UseGuards(new AppIdGuard('account-mapping.review'))
  @Permission({ [RESOURCE]: ['update'] })
  async review(@Req() req, @Res() res, @Param('bu_code') bu_code: string, @Body() body: AccountMappingReviewDto,
    @Query('version') version = 'latest') {
    const { user_id } = ExtractRequestHeader(req);
    this.respond(res, await this.svc.review(user_id, bu_code, body, version));
  }

  @Post('generate')
  @UseGuards(new AppIdGuard('account-mapping.generate'))
  @Permission({ [RESOURCE]: ['create'] })
  async generate(@Req() req, @Res() res, @Param('bu_code') bu_code: string, @Body() body: AccountMappingGenerateDto,
    @Query('version') version = 'latest') {
    const { user_id } = ExtractRequestHeader(req);
    this.respond(res, await this.svc.generate(user_id, bu_code, body, version), HttpStatus.CREATED);
  }

  @Post('resolve')
  @UseGuards(new AppIdGuard('account-mapping.resolve'))
  @Permission({ [RESOURCE]: ['view'] })
  async resolve(@Req() req, @Res() res, @Param('bu_code') bu_code: string, @Body() body: AccountMappingResolveDto,
    @Query('version') version = 'latest') {
    const { user_id } = ExtractRequestHeader(req);
    this.respond(res, await this.svc.resolve(user_id, bu_code, body, version));
  }
}
```

`AccountMappingListQuerySchema` (ใน dto) ใช้ coerce `page` / `perpage` เป็นตัวเลข โดย `perpage: z.coerce.number().int().min(1).transform(n => Math.min(n, 100)).default(10)` และ `mapping_type` บังคับ ส่วนที่เหลือ optional ทั้งหมด (uuid หรือ enum ตาม spec §5.1) จากนั้นเพิ่ม `@ApiQuery` / `@ApiBody` / `@ApiStdResponse` ตามแบบ `gl-jv-templates.controller.ts`

- [ ] **Step 3: service (gateway)**

```ts
async findAll(user_id: string, bu_code: string, query: AccountMappingListQuery, version: string) {
  const response = await this.rpc.send(AccountMapping.findAll, { user_id, bu_code, version, data: query });
  if (response.response.status !== HttpStatus.OK) return Result.fromMicroserviceError(response);
  return Result.ok({ data: response.data, paginate: response.paginate, meta: response.meta });
}
// update / review / resolve: rpc.call(...) (200, ไม่แบ่งหน้า) — ดูแบบ findOne ใน config_cost-centers.service.ts
// generate: rpc.send(...) แล้วเช็ก HttpStatus.CREATED แบบ create ใน config_cost-centers.service.ts
```

ถ้า `StdResponse.fromResult` ไม่ส่ง `meta` ต่อ ให้ใช้ชื่อ `paginate.counts` ตามที่ตัดสินใน Task B4 Step 3 จากนั้นลงทะเบียน module ใน `route-application.ts`

- [ ] **Step 4: สิทธิ์**

ใน `seed.permission.data.ts` ต่อจากบล็อก `configuration.cost_center` (~L1005-1020) เพิ่มตามรูปแบบเดิม:

```ts
  { resource: 'configuration.chart_of_account_mapping', action: 'view', description: 'View chart of account mapping' },
  { resource: 'configuration.chart_of_account_mapping', action: 'update', description: 'Override / review account mapping rows' },
  { resource: 'configuration.chart_of_account_mapping', action: 'create', description: 'Generate account mapping rows' },
```

ใน `permission.route-map.ts`:
- ถอด `['configuration.chart_of_account_mapping', 'Chart of account mapping']` ออกจาก `LICENSE_ONLY_RESOURCES` พร้อมแก้ comment ที่บอกว่าเป็น mock
- `ROUTE_RESOURCE_MAP`: เพิ่ม `'app:account-mapping': 'configuration.chart_of_account_mapping',`
- `SUB_PATH_ACTION_OVERRIDES`: เพิ่ม `'app:account-mapping:review': 'update', 'app:account-mapping:generate': 'create', 'app:account-mapping:resolve': 'view',`

(ให้ดูรูปแบบ key จริงจาก `'app:gl-jv-templates:generate'` ถ้าใช้ prefix อื่นให้ทำตามนั้น)

- [ ] **Step 5: regenerate catalog + gate ทั้งหมด**

```bash
bun run scripts/generate-app-api-catalog/run.ts
bun run audit:app-api-catalog-drift
cd packages/prisma-shared-schema-platform && npx tsx prisma/check.endpoint-permission-coverage.ts; npx tsx prisma/check.permission-drift.ts; cd ../..
cd apps/backend-gateway && npx tsc --noEmit -p tsconfig.json && npx jest && cd ../..
```

ชื่อคำสั่ง check อาจต่างจากนี้ ให้หาด้วย `grep -n "permission-coverage\|permission-drift" package.json packages/*/package.json` แล้วใช้สคริปต์ที่ประกาศไว้จริง Expected: ทุกตัวผ่าน และ catalog ต้องมี 5 ชื่อใหม่

- [ ] **Step 6: Commit**

```bash
git add apps/backend-gateway packages/prisma-shared-schema-platform
git commit -m "feat(gateway): endpoint account-mapping 5 เส้น + permission configuration.chart_of_account_mapping + app-api catalog"
```

- [ ] **Step 7: ตรวจด้วยมือของ Task B4 Step 9** (รันตอนนี้เพราะ gateway พร้อมแล้ว) แล้วเปิด PR backend (PR เป็นภาษาอังกฤษ):

```bash
git push -u origin feature/gl-ap-account-mapping
gh pr create --title "feat: GL/AP account mapping (table, resolver, 5 endpoints)" --body "Implements docs/superpowers/specs/2026-10-14-gl-ap-account-mapping-design.md (FE repo). Deploy order: migrations per BU → BE → seed permission → grant roles → FE."
```

---

# ส่วน Frontend (`carmen-inventory-frontend-react`, branch `feature/gl-ap-account-mapping`)

### Task F1: types, endpoint, data hook

**Files:**
- Modify (เขียนใหม่ทั้งไฟล์): `types/chart-of-account-mapping.ts`
- Modify: `constant/api-endpoints.ts` (ก่อน `ACTIVITY_LOG_DETAIL` ~L35)
- Modify: `constant/query-keys.ts` (`ACCOUNT_MAPPING`)
- Modify: `constant/list-page-keys.ts` (`CHART_OF_ACCOUNT_MAPPING: "chart_of_account_mapping"` ในหมวด config)
- Create: `routes/config/chart-of-account-mapping/use-account-mapping.ts`

**Interfaces:**
- Consumes: response shape ของ Task B5
- Produces:

```ts
// types/chart-of-account-mapping.ts
export type MappingType = "AP" | "GL";
export type MappingMovement = "grn" | "cn" | "adjustment" | "sr_in" | "sr_out";
export type MappingStatus = "incomplete" | "overridden" | "default" | "unreviewed";
export type Ref = { id: string; code: string; name: string };
export interface AccountMappingRow {
  id: string; doc_version: number; mapping_type: MappingType; movement: MappingMovement;
  origin: "generated_all" | "generated_used" | "auto_posting"; is_reviewed: boolean;
  location: Ref & { location_type: "inventory" | "direct" | "consignment" };
  category: Ref; sub_category: Ref; item_group: Ref;
  adjustment_type: (Ref & { type: string }) | null;
  account: { code: string | null; name: string | null;
    source: "override" | "item_group" | "sub_category" | "category" | null;
    issue: "missing_inventory_account" | "missing_direct_account" | "account_not_in_coa" | null };
  cost_center: { id: string | null; code: string | null; name: string | null;
    source: "override" | "location" | null; issue: "missing_cost_center" | null };
}
export type MappingCounts = Record<MappingStatus, number>;
export interface AccountMappingListResponse {
  data: AccountMappingRow[];
  paginate: { total: number; page: number; perpage: number; pages: number };
  counts: MappingCounts;
}
// hooks (use-account-mapping.ts)
export function useAccountMappingList(params: AccountMappingListParams): UseQueryResult<AccountMappingListResponse>;
export function useUpdateAccountMapping(): UseMutationResult<AccountMappingRow, ApiError, { id: string; doc_version: number; account_code?: string | null; cost_center_id?: string | null }>;
export function useReviewAccountMapping(): UseMutationResult<{ updated: number }, ApiError, { ids: string[] }>;
export function useGenerateAccountMapping(): UseMutationResult<{ created: Record<MappingType, number>; existing: Record<MappingType, number> }, ApiError, { mapping_type?: MappingType; mode: "all" | "used" }>;
```

- [ ] **Step 1: เขียน types ใหม่ตามข้างบน** (ลบ `business_unit` / `store_location` / `department` / `is_mapped` / `last_scanned_at` เดิมออกให้หมด)

- [ ] **Step 2: endpoint + keys**

```ts
  ACCOUNT_MAPPING: (buCode: string) => `/api/proxy/api/${buCode}/account-mapping`,
```

`constant/query-keys.ts`: `ACCOUNT_MAPPING: "account-mapping",` · `constant/list-page-keys.ts`: `CHART_OF_ACCOUNT_MAPPING: "chart_of_account_mapping",` (ห้ามเปลี่ยนค่าที่ shipped ไปแล้ว ส่วนนี้เป็นคีย์ใหม่)

- [ ] **Step 3: data hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { ApiError } from "@/lib/api-error";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import type {
  AccountMappingListResponse, AccountMappingRow, MappingCounts, MappingMovement, MappingStatus, MappingType,
} from "@/types/chart-of-account-mapping";

export interface AccountMappingListParams {
  mapping_type: MappingType;
  page?: number; perpage?: number; search?: string;
  location_id?: string; location_type?: "inventory" | "direct";
  category_id?: string; sub_category_id?: string; product_item_group_id?: string;
  movement?: MappingMovement; adjustment_type_id?: string; status?: MappingStatus;
}

const EMPTY_COUNTS: MappingCounts = { incomplete: 0, overridden: 0, default: 0, unreviewed: 0 };

export function useAccountMappingList(params: AccountMappingListParams) {
  const buCode = useBuCode();
  return useQuery({
    queryKey: [QUERY_KEYS.ACCOUNT_MAPPING, buCode, params],
    queryFn: async (): Promise<AccountMappingListResponse> => {
      const res = await httpClient.get(buildUrl(API_ENDPOINTS.ACCOUNT_MAPPING(buCode!), params));
      if (!res.ok) throw await ApiError.from(res, "Failed to fetch account mapping");
      const json = await res.json();
      return {
        data: json.data ?? [],
        paginate: json.paginate,
        counts: json.meta?.counts ?? json.paginate?.counts ?? EMPTY_COUNTS,
      };
    },
    ...CACHE_DYNAMIC,
    enabled: !!buCode,
  });
}

const invalidateKeys = [[QUERY_KEYS.ACCOUNT_MAPPING]];

export function useUpdateAccountMapping() {
  return useApiMutation<
    { id: string; doc_version: number; account_code?: string | null; cost_center_id?: string | null },
    AccountMappingRow
  >({
    mutationFn: ({ id, ...body }, buCode) =>
      httpClient.patch(`${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/${id}`, body),
    invalidateKeys,
    errorMessage: "Failed to update account mapping",
    meta: { skipGlobalErrorToast: true }, // sheet แสดง 409/422 เอง
  });
}

export function useReviewAccountMapping() {
  return useApiMutation<{ ids: string[] }, { updated: number }>({
    mutationFn: (body, buCode) => httpClient.post(`${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/review`, body),
    invalidateKeys,
    errorMessage: "Failed to review account mapping",
  });
}

export function useGenerateAccountMapping() {
  return useApiMutation<
    { mapping_type?: MappingType; mode: "all" | "used" },
    { created: Record<MappingType, number>; existing: Record<MappingType, number> }
  >({
    mutationFn: (body, buCode) => httpClient.post(`${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/generate`, body),
    invalidateKeys,
    errorMessage: "Failed to generate account mapping",
  });
}
```

ชื่อ import ของ `useBuCode`, signature ของ `httpClient.patch/post`, และรูปของ `invalidateKeys` ต้องตรวจกับของจริงที่ `hooks/use-api-mutation.ts:81` กับ `routes/inventory-management/inventory-adjustment/use-inventory-adjustment.ts` แล้วปรับให้ตรง โดยไม่เปลี่ยนชื่อ export ที่กำหนดไว้ใน Interfaces

- [ ] **Step 4: typecheck + lint + commit**

```bash
bun run typecheck && bunx eslint types/chart-of-account-mapping.ts constant routes/config/chart-of-account-mapping/use-account-mapping.ts
git add types/chart-of-account-mapping.ts constant routes/config/chart-of-account-mapping/use-account-mapping.ts
git commit -m "feat(coam): type + endpoint + data hook ของ account mapping"
```

(`coam-component.tsx` / `use-coam-table.tsx` เดิมจะพังเพราะ type เปลี่ยน ถ้า typecheck แดงเฉพาะสองไฟล์นี้ยอมรับได้ใน task นี้ เพราะ Task F3 จะเขียนใหม่ทั้งคู่ ให้บันทึกไว้ใน commit message ว่า "หน้า list จะแก้ใน commit ถัดไป" หรือจะรวม F1 กับ F3 เป็น commit เดียวก็ได้)

---

### Task F2: `LookupCostCenter` (shared)

**Files:**
- Create: `components/lookup/lookup-cost-center.tsx`

**Interfaces:**
- Consumes: `useCostCenter` (`hooks/use-cost-center.ts`), `LookupCombobox` (`components/lookup/lookup-combobox.tsx`)
- Produces: `export function LookupCostCenter(props: { value: string | null; onValueChange: (id: string | null, item?: CostCenter) => void; defaultLabel?: string; disabled?: boolean; error?: string; size?: "xs" | "sm" | "default"; modal?: boolean; allowDeselect?: boolean })`

- [ ] **Step 1: เขียน component**

```tsx
import { useState } from "react";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { useCostCenter } from "@/hooks/use-cost-center";
import type { CostCenter } from "@/types/cost-center";

interface Props {
  value: string | null;
  onValueChange: (id: string | null, item?: CostCenter) => void;
  defaultLabel?: string;
  disabled?: boolean;
  error?: string;
  size?: "xs" | "sm" | "default";
  modal?: boolean;
  allowDeselect?: boolean;
}

/** cost center (GL master) — ใช้ใน location form และ sheet แก้ mapping; lazy: โหลดเมื่อเปิดหรือมีค่า */
export function LookupCostCenter({ value, onValueChange, defaultLabel, disabled, error, size, modal, allowDeselect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCostCenter(
    { perpage: 100, search: search || undefined, filter: "is_active|bool:true" },
    { enabled: open || !!value },
  );
  const items = data?.data ?? [];
  return (
    <LookupCombobox<CostCenter>
      value={value ?? ""}
      onValueChange={(id, item) => onValueChange(id || null, item)}
      items={items}
      getId={(c) => c.id}
      getLabel={(c) => `${c.code} · ${c.name}`}
      getSearchValue={(c) => `${c.code} ${c.name}`}
      defaultLabel={defaultLabel}
      isLoading={isLoading}
      onOpenChange={setOpen}
      onSearchChange={setSearch}
      serverSideSearch
      readOnly={disabled}
      error={error}
      size={size}
      modal={modal}
      allowDeselect={allowDeselect}
    />
  );
}
```

ตรวจ signature ของ `useCostCenter(params, options)` กับ `createConfigCrud` ก่อน (ใน `hooks/use-config-crud.ts`) ว่ารับ `enabled` อย่างไร และรูปของ filter is_active ที่ใช้กันในรีโปเป็นแบบใด เช่น `routes/config/location/location-filter-fields.ts` แล้วปรับให้ตรง

- [ ] **Step 2: typecheck + lint + commit**

```bash
bun run typecheck && bunx eslint components/lookup/lookup-cost-center.tsx
git add components/lookup/lookup-cost-center.tsx
git commit -m "feat(lookup): LookupCostCenter สำหรับ location และ account mapping"
```

---

### Task F3: หน้า list ใหม่ (แท็บ, ตัวกรอง, ตาราง) + ลบ mock

**Files:**
- Modify (เขียนใหม่): `routes/config/chart-of-account-mapping/coam-component.tsx`
- Modify (เขียนใหม่): `routes/config/chart-of-account-mapping/use-coam-table.tsx`
- Create: `routes/config/chart-of-account-mapping/coam-filter-fields.ts`
- Create: `routes/config/chart-of-account-mapping/coam-cells.tsx` (cell ของ account / cost center / status ใช้ร่วมกันระหว่างตารางกับ sheet)
- Delete: `routes/config/chart-of-account-mapping/coam-mock.ts`
- Modify: `messages/en.json`, `messages/th.json` (`config.chartOfAccountMapping` L1645-1657)
- Modify: `constant/module-list.ts:660-668` (แก้ comment ที่บอกว่าเป็น mock)

**Interfaces:**
- Consumes: `useAccountMappingList`, types (F1)
- Produces: `CoamComponent` (default export เดิม) · `useCoamTable({ data, totalRecords, params, tableConfig, tab, onOpen })` · `AccountCell`, `CostCenterCell`, `StatusCell` จาก `coam-cells.tsx` · prop `onOpen(row)` ที่ Task F4 นำไปเปิด sheet

- [ ] **Step 1: i18n**

แทนที่บล็อก `config.chartOfAccountMapping` ทั้งก้อน (en):

```json
"chartOfAccountMapping": {
  "title": "Chart of Account Mapping",
  "desc": "Account code and cost center posted for each location × item group × movement",
  "tabAp": "Post to AP",
  "tabGl": "Post to GL",
  "locationType": "Location type",
  "movement": "Movement",
  "adjustmentType": "Adjustment type",
  "account": "Account",
  "costCenter": "Cost center",
  "status": "Status",
  "movementGrn": "Goods receive",
  "movementCn": "Credit note",
  "movementAdjustment": "Adjustment",
  "movementSrIn": "SR in (destination)",
  "movementSrOut": "SR out (source)",
  "statusIncomplete": "Incomplete",
  "statusOverridden": "Overridden",
  "statusDefault": "Default",
  "statusUnreviewed": "Unreviewed",
  "sourceOverride": "Overridden",
  "sourceItemGroup": "Default · item group",
  "sourceSubCategory": "Default · sub-category",
  "sourceCategory": "Default · category",
  "sourceLocation": "Default · location",
  "issueMissingInventoryAccount": "No inventory account on item group / sub-category / category",
  "issueMissingDirectAccount": "No direct account on item group / sub-category / category",
  "issueAccountNotInCoa": "Account code is not in the chart of accounts",
  "issueMissingCostCenter": "Location has no cost center",
  "markReviewed": "Mark as reviewed",
  "markReviewedDone": "Marked {count} rows as reviewed",
  "generate": "Generate mapping rows",
  "generateTitle": "Generate mapping rows",
  "generateDesc": "Adds rows that are missing. Existing rows and overrides are never changed or removed.",
  "modeUsed": "Only what is used (products assigned to locations + existing transactions)",
  "modeAll": "Everything in advance (every location × every item group)",
  "generateType": "Mapping type",
  "generateBoth": "AP and GL",
  "generateDone": "Created {created} rows",
  "editTitle": "Edit mapping",
  "resetToDefault": "Use default",
  "defaultValue": "Default: {value}",
  "noDefault": "No default",
  "conflict": "This row was changed by someone else. The latest values have been loaded."
}
```

th:

```json
"chartOfAccountMapping": {
  "title": "การผูกผังบัญชี",
  "desc": "รหัสบัญชีและ cost center ที่ใช้ลงบัญชีของแต่ละ location × item group × ประเภทรายการ",
  "tabAp": "Post to AP",
  "tabGl": "Post to GL",
  "locationType": "ประเภท location",
  "movement": "ประเภทรายการ",
  "adjustmentType": "ประเภทการปรับปรุง",
  "account": "รหัสบัญชี",
  "costCenter": "Cost center",
  "status": "สถานะ",
  "movementGrn": "รับสินค้า",
  "movementCn": "ใบลดหนี้",
  "movementAdjustment": "ปรับปรุงสต็อก",
  "movementSrIn": "SR in (ปลายทาง)",
  "movementSrOut": "SR out (ต้นทาง)",
  "statusIncomplete": "ยังไม่ครบ",
  "statusOverridden": "แก้ทับ",
  "statusDefault": "ค่าเริ่มต้น",
  "statusUnreviewed": "ยังไม่ตรวจ",
  "sourceOverride": "แก้ทับ",
  "sourceItemGroup": "ค่าเริ่มต้น · item group",
  "sourceSubCategory": "ค่าเริ่มต้น · sub-category",
  "sourceCategory": "ค่าเริ่มต้น · category",
  "sourceLocation": "ค่าเริ่มต้น · location",
  "issueMissingInventoryAccount": "item group / sub-category / category ยังไม่มี inventory account",
  "issueMissingDirectAccount": "item group / sub-category / category ยังไม่มี direct account",
  "issueAccountNotInCoa": "รหัสบัญชีนี้ไม่มีในผังบัญชี",
  "issueMissingCostCenter": "location ยังไม่ได้ผูก cost center",
  "markReviewed": "ยืนยันว่าตรวจแล้ว",
  "markReviewedDone": "ยืนยันแล้ว {count} แถว",
  "generate": "สร้างแถว mapping",
  "generateTitle": "สร้างแถว mapping",
  "generateDesc": "เพิ่มเฉพาะแถวที่ยังไม่มี แถวเดิมและค่าที่แก้ทับไว้จะไม่ถูกแก้หรือลบ",
  "modeUsed": "เฉพาะที่ใช้ (สินค้าที่ผูกกับ location + ธุรกรรมที่เกิดขึ้นแล้ว)",
  "modeAll": "ทั้งหมดล่วงหน้า (ทุก location × ทุก item group)",
  "generateType": "ประเภท mapping",
  "generateBoth": "ทั้ง AP และ GL",
  "generateDone": "สร้าง {created} แถว",
  "editTitle": "แก้ไข mapping",
  "resetToDefault": "ใช้ค่าเริ่มต้น",
  "defaultValue": "ค่าเริ่มต้น: {value}",
  "noDefault": "ไม่มีค่าเริ่มต้น",
  "conflict": "แถวนี้ถูกแก้โดยคนอื่น โหลดค่าล่าสุดให้แล้ว"
}
```

ตรวจด้วย `grep -n '{{' messages/en.json messages/th.json` ต้องไม่เจอ ถ้า namespace `field.*` ยังไม่มี `locationType` ให้ใช้คีย์ข้างบนแทน

- [ ] **Step 2: `coam-cells.tsx`**

```tsx
import { useTranslations } from "use-intl";
import { NameWithSubtext } from "@/components/share/name-with-subtext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";

const ACCOUNT_SOURCE_KEY = {
  override: "sourceOverride", item_group: "sourceItemGroup", sub_category: "sourceSubCategory", category: "sourceCategory",
} as const;
const ISSUE_KEY = {
  missing_inventory_account: "issueMissingInventoryAccount", missing_direct_account: "issueMissingDirectAccount",
  account_not_in_coa: "issueAccountNotInCoa", missing_cost_center: "issueMissingCostCenter",
} as const;

export function SourceBadge({ source }: { source: keyof typeof ACCOUNT_SOURCE_KEY | "location" | null }) {
  const t = useTranslations("config.chartOfAccountMapping");
  if (!source) return null;
  const override = source === "override";
  return (
    <Badge variant={override ? "default" : "outline"} className={cn(!override && "text-muted-foreground")}>
      {t(source === "location" ? "sourceLocation" : ACCOUNT_SOURCE_KEY[source])}
    </Badge>
  );
}

function IssueText({ issue }: { issue: keyof typeof ISSUE_KEY }) {
  const t = useTranslations("config.chartOfAccountMapping");
  return <span className="text-warning-ink">{t(ISSUE_KEY[issue])}</span>;
}

export function AccountCell({ row }: { row: AccountMappingRow }) {
  const a = row.account;
  if (!a.code) return a.issue ? <IssueText issue={a.issue} /> : null;
  return (
    <div className="flex flex-col gap-1">
      <NameWithSubtext name={a.code} subtext={a.name ?? undefined} />
      {a.issue ? <IssueText issue={a.issue} /> : <SourceBadge source={a.source} />}
    </div>
  );
}

export function CostCenterCell({ row }: { row: AccountMappingRow }) {
  const c = row.cost_center;
  if (!c.id) return c.issue ? <IssueText issue={c.issue} /> : null;
  return (
    <div className="flex flex-col gap-1">
      <NameWithSubtext name={c.code ?? c.id} subtext={c.name ?? undefined} />
      <SourceBadge source={c.source} />
    </div>
  );
}
```

**ทางลัดไปแก้ต้นทาง (spec §6.1):** ห่อ `SourceBadge` ด้วย `<Link>` ของ `react-router` เมื่อมีปลายทาง โดย `item_group` / `sub_category` / `category` → `/product-management/category` และ `location` → `/config/location/${row.location.id}` ส่วน `override` ไม่มีลิงก์ ทำได้โดยเพิ่ม prop `href?: string` ให้ `SourceBadge` แล้วให้ `AccountCell` / `CostCenterCell` คำนวณ href จาก `row`

ตรวจ path/props ของ `NameWithSubtext` และ `Badge` (variant ที่มีจริง) จาก `use-coam-table.tsx` เดิมที่ L18-23 และจาก `components/ui/badge.tsx` ห้ามตั้งขนาดหรือสีใหม่เอง ให้ใช้ของใน design system เท่านั้น

- [ ] **Step 3: `use-coam-table.tsx`**

```tsx
"use no memo";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { CellAction } from "@/components/ui/data-grid/cell-action";
import { NameWithSubtext } from "@/components/share/name-with-subtext";
import type { AccountMappingRow, MappingType } from "@/types/chart-of-account-mapping";
import type { ParamsDto } from "@/types/params";
import { AccountCell, CostCenterCell } from "./coam-cells";

const MOVEMENT_KEY = {
  grn: "movementGrn", cn: "movementCn", adjustment: "movementAdjustment", sr_in: "movementSrIn", sr_out: "movementSrOut",
} as const;

const ref = (v: { code: string; name: string } | null) => (v ? <NameWithSubtext name={v.code} subtext={v.name} /> : "—");

export function useCoamTable({ data, totalRecords, params, tableConfig, tab, onOpen }: {
  data: AccountMappingRow[]; totalRecords: number; params: ParamsDto; tableConfig: unknown;
  tab: MappingType; onOpen: (row: AccountMappingRow) => void;
}) {
  "use no memo";
  const t = useTranslations("config.chartOfAccountMapping");
  const tfl = useTranslations("field");
  const columns: ColumnDef<AccountMappingRow>[] = [
    { id: "location", header: tfl("location"), size: 180,
      cell: ({ row }) => <CellAction onClick={() => onOpen(row.original)}>{ref(row.original.location)}</CellAction> },
    { id: "location_type", header: t("locationType"), size: 110, cell: ({ row }) => row.original.location.location_type },
    { id: "category", header: tfl("category"), size: 140, cell: ({ row }) => ref(row.original.category) },
    { id: "sub_category", header: tfl("subCategory"), size: 140, cell: ({ row }) => ref(row.original.sub_category) },
    { id: "item_group", header: tfl("itemGroup"), size: 160, cell: ({ row }) => ref(row.original.item_group) },
    { id: "movement", header: t("movement"), size: 140, cell: ({ row }) => t(MOVEMENT_KEY[row.original.movement]) },
    ...(tab === "GL"
      ? [{ id: "adjustment_type", header: t("adjustmentType"), size: 160,
          cell: ({ row }) => ref(row.original.adjustment_type) } as ColumnDef<AccountMappingRow>]
      : []),
    { id: "account", header: t("account"), size: 240, cell: ({ row }) => <AccountCell row={row.original} /> },
    { id: "cost_center", header: t("costCenter"), size: 200, cell: ({ row }) => <CostCenterCell row={row.original} /> },
  ];
  return useConfigTable({ data, columns, totalRecords, params, tableConfig, hideStatus: true, enableRowSelection: true });
}
```

ตรวจ options ที่ `useConfigTable` รับจริง (`components/ui/data-grid/use-config-table.ts:18-35`) ถ้าไม่มี `enableRowSelection` ให้ดูว่าหน้าไหนมี select-all แล้วใช้กลไกเดียวกัน (memory: DataGrid select-all ถูกแก้แล้วใน PR ช่วง 2026-06) หรือเพิ่ม column `select` ตามแบบหน้านั้น ส่วน `CellAction` ให้ใช้ props ตามของจริงในไฟล์เดิม

- [ ] **Step 4: `coam-filter-fields.ts`**

```ts
import type { FilterFieldDef } from "@/types/list-filter";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useLocation as useLocationList } from "@/hooks/use-location";
import { useCategory } from "@/hooks/use-category";
import { useSubCategory } from "@/hooks/use-sub-category";
import { useItemGroup } from "@/hooks/use-item-group";
import { useAdjustmentType } from "@/hooks/use-adjustment-type";

export function coamFilterFields(t: (k: string) => string, tfl: (k: string) => string, tab: "AP" | "GL"): FilterFieldDef[] {
  return [
    { key: "status", label: t("status"), control: "status",
      options: [
        { value: "incomplete", label: t("statusIncomplete") },
        { value: "overridden", label: t("statusOverridden") },
        { value: "default", label: t("statusDefault") },
        { value: "unreviewed", label: t("statusUnreviewed") },
      ] },
    { key: "location_type", label: t("locationType"), control: "multi-select",
      options: [{ value: "inventory", label: "Inventory" }, { value: "direct", label: "Direct" }] },
    { key: "location_id", label: tfl("location"), control: "entity",
      source: defineEntitySource({ fieldKey: "location_id", useListHook: useLocationList, getLabel: (l) => `${l.code} · ${l.name}`, serverFilter: null }) },
    { key: "category_id", label: tfl("category"), control: "entity",
      source: defineEntitySource({ fieldKey: "category_id", useListHook: useCategory, getLabel: (c) => `${c.code} · ${c.name}`, serverFilter: null }) },
    { key: "sub_category_id", label: tfl("subCategory"), control: "entity",
      source: defineEntitySource({ fieldKey: "sub_category_id", useListHook: useSubCategory, getLabel: (c) => `${c.code} · ${c.name}`, serverFilter: null }) },
    { key: "product_item_group_id", label: tfl("itemGroup"), control: "entity",
      source: defineEntitySource({ fieldKey: "product_item_group_id", useListHook: useItemGroup, getLabel: (c) => `${c.code} · ${c.name}`, serverFilter: null }) },
    { key: "movement", label: t("movement"), control: "multi-select",
      options: tab === "AP"
        ? [{ value: "grn", label: t("movementGrn") }, { value: "cn", label: t("movementCn") }]
        : [{ value: "adjustment", label: t("movementAdjustment") }, { value: "sr_in", label: t("movementSrIn") }, { value: "sr_out", label: t("movementSrOut") }] },
    ...(tab === "GL"
      ? [{ key: "adjustment_type_id", label: t("adjustmentType"), control: "entity" as const,
          source: defineEntitySource({ fieldKey: "adjustment_type_id", useListHook: useAdjustmentType, getLabel: (a) => `${a.code} · ${a.name}`, serverFilter: null }) }]
      : []),
  ];
}
```

รูปของ `FilterFieldDef` (ชื่อ field `key` / `control` / `options` / `source`) ต้องเทียบกับ `types/list-filter.ts:50-77` และ `ia-component.tsx:96-144` แล้วปรับให้ตรง **endpoint นี้ไม่ได้ใช้ `filter=` แบบ `k:v;…`** แต่รับ query param แยกกัน ดังนั้นใน Step 5 ต้องแปลง `lf.activeFilters` เป็น params แต่ละตัว (multi-select ที่เลือกได้ค่าเดียวให้ส่งค่านั้น ถ้าเลือกมากกว่าหนึ่งค่าให้ส่งแค่ค่าแรก เพราะ backend รับค่าเดียว)

- [ ] **Step 5: `coam-component.tsx`**

```tsx
"use no memo";
import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { ListPageShell } from "@/components/share/list-page-shell";
import { ListToolbar } from "@/components/share/list-toolbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataGrid, DataGridContainer, DataGridScrollArea, DataGridTable } from "@/components/ui/data-grid";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { ErrorState } from "@/components/share/error-state";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useURL } from "@/hooks/use-url";
import type { AccountMappingRow, MappingType } from "@/types/chart-of-account-mapping";
import { useAccountMappingList, useReviewAccountMapping, type AccountMappingListParams } from "./use-account-mapping";
import { useCoamTable } from "./use-coam-table";
import { coamFilterFields } from "./coam-filter-fields";

export default function CoamComponent() {
  "use no memo";
  const t = useTranslations("config.chartOfAccountMapping");
  const tfl = useTranslations("field");
  const [tabParam, setTab] = useURL("tab");
  const tab: MappingType = tabParam === "GL" ? "GL" : "AP";
  const [editing, setEditing] = useState<AccountMappingRow | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const { params, tableConfig, search, setSearch } = useDataGridState({ defaultPerpage: 20 });
  const fields = useMemo(() => coamFilterFields(t, tfl, tab), [t, tfl, tab]);
  const lf = useListFilters({ pageKey: LIST_PAGE_KEYS.CHART_OF_ACCOUNT_MAPPING, fields });

  const query: AccountMappingListParams = {
    mapping_type: tab,
    page: params.page,
    perpage: params.perpage,
    search: params.search || undefined,
    ...lf.toQueryParams(), // แปลง activeFilters → { status, location_type, location_id, ... } (ดู Step 4)
  };
  const { data, isLoading, error, refetch } = useAccountMappingList(query);
  const review = useReviewAccountMapping();

  const table = useCoamTable({
    data: data?.data ?? [], totalRecords: data?.paginate.total ?? 0, params, tableConfig, tab, onOpen: setEditing,
  });
  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id);

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      actions={
        <>
          {selectedIds.length > 0 && (
            <Button variant="outline" onClick={() => review.mutate({ ids: selectedIds }, { onSuccess: () => table.resetRowSelection() })}>
              {t("markReviewed")} ({selectedIds.length})
            </Button>
          )}
          <Button onClick={() => setGenerateOpen(true)}>{t("generate")}</Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <TabsList variant="line">
          <TabsTrigger value="AP">{t("tabAp")}{tab === "AP" && data ? <Badge className="ml-2">{data.counts.incomplete}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="GL">{t("tabGl")}{tab === "GL" && data ? <Badge className="ml-2">{data.counts.incomplete}</Badge> : null}</TabsTrigger>
        </TabsList>
      </Tabs>
      <ListToolbar search={search} onSearch={setSearch} lf={lf} fields={fields} table={table} />
      <DataGrid table={table} recordCount={data?.paginate.total ?? 0} isLoading={isLoading} tableLayout={{ headerSticky: true }}>
        <DataGridContainer className="flex flex-col">
          <DataGridScrollArea><DataGridTable /></DataGridScrollArea>
        </DataGridContainer>
        <DataGridPagination sizes={[10, 20, 50, 100]} />
      </DataGrid>
      {/* Task F4: <CoamEditSheet row={editing} onClose={() => setEditing(null)} /> และ <CoamGenerateDialog … /> */}
    </ListPageShell>
  );
}
```

ทุก import path และ props ของ `ListPageShell` / `ListToolbar` / `DataGrid*` / `useURL` ต้องคัดลอกจาก `routes/inventory-management/inventory-adjustment/ia-component.tsx` (L146-149, L376-409) ส่วน `lf.toQueryParams()` เป็นชื่อสมมติ ถ้า `useListFilters` ไม่มีฟังก์ชันนี้ ให้เขียน helper ชื่อ `filtersToParams(lf.activeFilters)` ไว้ใน `coam-filter-fields.ts` แล้ว export ออกไปใช้ ห้ามใส่ setter ของ `useURL` ไว้ใน deps ของ `useMemo` (memory `list-filter-saved-views-prs`) ส่วนการนับ chip ให้ใช้ `data.counts` ที่ได้จาก backend

- [ ] **Step 6: ลบ mock + แก้ comment ใน module-list**

```bash
git rm routes/config/chart-of-account-mapping/coam-mock.ts
```

ใน `constant/module-list.ts:660-663` แก้ comment เป็น: `// คีย์ license นี้ผูกกับ endpoint จริงแล้ว (api/:bu_code/account-mapping) — LicenseInterceptor + permission configuration.chart_of_account_mapping`

- [ ] **Step 7: typecheck + lint + เทสต์เดิม + commit**

```bash
bun run typecheck && bun run lint && bun run test:run
git add -A routes/config/chart-of-account-mapping messages constant/module-list.ts
git commit -m "feat(coam): หน้า Chart of Account Mapping อ่าน API จริง — แท็บ AP/GL, ตัวกรอง, status chips, แบ่งหน้า 10–100"
```

Expected: เขียว รวมถึง `type-ladder.test.ts` และ `module-list.license-feature.test.ts` ถ้าเทสต์ของ module-list แดงเพราะ comment หรือข้อความที่อ้างถึง mock ให้แก้ข้อความในเทสต์ให้ตรงกับความจริง ห้ามแก้ logic ของเทสต์

---

### Task F4: Sheet แก้ไข + dialog generate

**Files:**
- Create: `routes/config/chart-of-account-mapping/coam-edit-sheet.tsx`
- Create: `routes/config/chart-of-account-mapping/coam-generate-dialog.tsx`
- Modify: `routes/config/chart-of-account-mapping/coam-component.tsx` (mount ทั้งสอง)

**Interfaces:**
- Consumes: `useUpdateAccountMapping`, `useGenerateAccountMapping` (F1), `LookupCostCenter` (F2), `LookupChartOfAccount` (`components/lookup/lookup-chart-of-account.tsx`, value = `code`), `SourceBadge` (F3)
- Produces: `CoamEditSheet({ row: AccountMappingRow | null; onClose(): void })`, `CoamGenerateDialog({ open: boolean; onOpenChange(v: boolean): void; defaultType: MappingType })`

- [ ] **Step 1: `coam-edit-sheet.tsx`**

```tsx
"use no memo";
import { useState, useEffect } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { ApiError } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";
import { useUpdateAccountMapping } from "./use-account-mapping";
import { SourceBadge } from "./coam-cells";

export function CoamEditSheet({ row, onClose }: { row: AccountMappingRow | null; onClose: () => void }) {
  const t = useTranslations("config.chartOfAccountMapping");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const errorToast = useErrorToast();
  const update = useUpdateAccountMapping();
  // undefined = ไม่แตะ, null = กลับไปใช้ default, string = แก้ทับ
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [costCenter, setCostCenter] = useState<string | null | undefined>(undefined);
  useEffect(() => { setAccount(undefined); setCostCenter(undefined); }, [row?.id]);
  if (!row) return null;

  const accountOverridden = row.account.source === "override";
  const ccOverridden = row.cost_center.source === "override";
  const shownAccount = account === undefined ? (accountOverridden ? row.account.code : null) : account;
  const shownCc = costCenter === undefined ? (ccOverridden ? row.cost_center.id : null) : costCenter;

  const save = () => {
    update.mutate(
      { id: row.id, doc_version: row.doc_version,
        ...(account !== undefined ? { account_code: account } : {}),
        ...(costCenter !== undefined ? { cost_center_id: costCenter } : {}) },
      {
        onSuccess: () => { toast.success(tt("updateSuccess", { entity: t("title") })); onClose(); },
        onError: (err) => {
          if (err instanceof ApiError && err.statusCode === 409 && !err.appCode) {
            toast.error(t("conflict")); // list ถูก invalidate แล้ว → แถวใหม่จะถูกโหลด
            onClose();
            return;
          }
          errorToast(err); // 422: ข้อความจาก error catalog
        },
      },
    );
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("editTitle")}</SheetTitle>
          <SheetDescription>
            {row.location.code} · {row.item_group.code} · {row.movement}
            {row.adjustment_type ? ` · ${row.adjustment_type.code}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <Field>
            <FieldLabel>{t("account")}</FieldLabel>
            <LookupChartOfAccount value={shownAccount ?? ""} onValueChange={(code) => setAccount(code || null)} />
            <p className="text-muted-foreground">
              {!accountOverridden && row.account.code
                ? t("defaultValue", { value: `${row.account.code} ${row.account.name ?? ""}` })
                : !accountOverridden ? t("noDefault") : null}
            </p>
            <div className="flex items-center gap-2">
              <SourceBadge source={account === undefined ? row.account.source : account === null ? null : "override"} />
              {(accountOverridden || account) && (
                <Button variant="ghost" size="sm" onClick={() => setAccount(null)}>{t("resetToDefault")}</Button>
              )}
            </div>
          </Field>
          <Field>
            <FieldLabel>{t("costCenter")}</FieldLabel>
            <LookupCostCenter value={shownCc} onValueChange={(id) => setCostCenter(id)} modal allowDeselect />
            <p className="text-muted-foreground">
              {!ccOverridden && row.cost_center.id
                ? t("defaultValue", { value: `${row.cost_center.code ?? ""} ${row.cost_center.name ?? ""}` })
                : !ccOverridden ? t("noDefault") : null}
            </p>
            {(ccOverridden || costCenter) && (
              <Button variant="ghost" size="sm" onClick={() => setCostCenter(null)}>{t("resetToDefault")}</Button>
            )}
          </Field>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button onClick={save} disabled={update.isPending || (account === undefined && costCenter === undefined)}>
            {tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

ช่อง lookup แสดง**เฉพาะค่าที่แก้ทับ** ส่วนค่า default แสดงเป็นข้อความใต้ช่อง ทำให้ "ว่าง = ใช้ default" ตรงกับความหมายใน DB ให้ตรวจชื่อคีย์ `common.cancel` / `common.save` / `toast.updateSuccess` ว่ามีอยู่จริง และ path ของ `Field` / `FieldLabel` จาก `routes/config/location/location-form.tsx`

- [ ] **Step 2: `coam-generate-dialog.tsx`**

```tsx
import { useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { MappingType } from "@/types/chart-of-account-mapping";
import { useGenerateAccountMapping } from "./use-account-mapping";

export function CoamGenerateDialog({ open, onOpenChange, defaultType }: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultType: MappingType;
}) {
  const t = useTranslations("config.chartOfAccountMapping");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<"used" | "all">("used");
  const [type, setType] = useState<MappingType | "both">(defaultType);
  const generate = useGenerateAccountMapping();
  const submit = () =>
    generate.mutate(
      { mode, ...(type === "both" ? {} : { mapping_type: type }) },
      {
        onSuccess: (res) => {
          toast.success(t("generateDone", { created: res.created.AP + res.created.GL }));
          onOpenChange(false);
        },
      },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>{t("generateDesc")}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "used" | "all")}>
          <Label className="flex items-center gap-2"><RadioGroupItem value="used" />{t("modeUsed")}</Label>
          <Label className="flex items-center gap-2"><RadioGroupItem value="all" />{t("modeAll")}</Label>
        </RadioGroup>
        <p className="font-medium">{t("generateType")}</p>
        <RadioGroup value={type} onValueChange={(v) => setType(v as MappingType | "both")}>
          <Label className="flex items-center gap-2"><RadioGroupItem value="AP" />{t("tabAp")}</Label>
          <Label className="flex items-center gap-2"><RadioGroupItem value="GL" />{t("tabGl")}</Label>
          <Label className="flex items-center gap-2"><RadioGroupItem value="both" />{t("generateBoth")}</Label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={generate.isPending}>{t("generate")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

ถ้ารีโปไม่มี `components/ui/radio-group` ให้ใช้ `Select` แทนแบบเดียวกับฟอร์มอื่น โดยดู primitive ที่มีจริงได้ที่ `/design-system`

- [ ] **Step 3: mount ใน `coam-component.tsx`** (แทน comment ใน F3 Step 5)

```tsx
      <CoamEditSheet row={editing} onClose={() => setEditing(null)} />
      <CoamGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} defaultType={tab} />
```

- [ ] **Step 4: typecheck + lint + ตรวจในเบราว์เซอร์ (RF4, RF5) + commit**

```bash
bun run typecheck && bun run lint
VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev
```

ในเบราว์เซอร์ที่ `/config/chart-of-account-mapping` (backup dev DB แล้ว):
1. กด "สร้างแถว mapping" เลือก "เฉพาะที่ใช้" จะเห็น toast และตารางมีข้อมูล จากนั้นกดซ้ำต้องได้ toast "สร้าง 0 แถว"
2. เปิด sheet เลือกบัญชีใหม่แล้วบันทึก แถวต้องขึ้นป้าย "แก้ทับ" จากนั้นเปิดใหม่ กด "ใช้ค่าเริ่มต้น" แล้วบันทึก ป้ายต้องกลับเป็น "ค่าเริ่มต้น · …"
3. **(RF5)** เปิดแถวเดียวกันใน 2 แท็บ บันทึกแท็บแรกก่อน แล้วบันทึกแท็บที่สอง แท็บที่สองต้องขึ้นข้อความ conflict และค่าต้องไม่ถูกเขียนทับ
4. **(RF4)** ถ้า COA ของ BU ว่างจนเห็นรายการ mock ใน lookup ให้เลือกรหัส mock แล้วบันทึก ต้องขึ้น error 422 และแถวต้องไม่เปลี่ยน
5. เลือก 2 แถว "ยังไม่ตรวจ" (สร้างโดยตั้ง `is_reviewed=false` ตรงใน DB ที่ backup แล้ว) กด "ยืนยันว่าตรวจแล้ว" แล้ว chip ยังไม่ตรวจต้องลดลง 2
6. แท็บ GL ต้องมีคอลัมน์ Adjustment type ส่วนแท็บ AP ไม่มี เปลี่ยนขนาดหน้าเป็น 100 แล้วกด back ตัวกรองต้องยังอยู่

```bash
git add routes/config/chart-of-account-mapping
git commit -m "feat(coam): sheet แก้ทับ/คืนค่า default (409/422) + dialog สร้างแถว 2 โหมด"
```

---

### Task F5: Location form — ช่อง Cost center

**Files:**
- Modify: `types/location.ts` (L47-62 `Location`, L64-76 `CreateLocationDto`)
- Modify: `routes/config/location/location-form-schema.ts` (L7-26, `EMPTY_FORM` L34-45, `getDefaultValues` L47-61)
- Modify: `routes/config/location/location-form.tsx` (section general ~L272, payload L177-193)

**Interfaces:**
- Consumes: `LookupCostCenter` (F2), location API `cost_center_id` (B2)

- [ ] **Step 1: type + schema**

`types/location.ts`: ใน `Location` เพิ่ม `cost_center_id?: string | null;` และใน `CreateLocationDto` เพิ่ม `cost_center_id?: string | null;`

`location-form-schema.ts`: เพิ่ม `cost_center_id: z.string().uuid().nullable().optional(),` ในส่วน schema, ใน `EMPTY_FORM` เพิ่ม `cost_center_id: null,` และใน `getDefaultValues` เพิ่ม `cost_center_id: location?.cost_center_id ?? null,`

- [ ] **Step 2: ฟิลด์ในฟอร์ม** (วางต่อจาก delivery point ~L399 ด้วยรูปแบบเดียวกัน)

```tsx
<Field className="sm:col-span-2">
  <FieldLabel>{tfl("costCenter")}</FieldLabel>
  {isView ? (
    <FieldPlainText>{location?.cost_center_id ? costCenterLabel : "—"}</FieldPlainText>
  ) : (
    <Controller control={form.control} name="cost_center_id" render={({ field }) => (
      <LookupCostCenter value={field.value ?? null} onValueChange={(id) => field.onChange(id)}
        disabled={isDisabled} allowDeselect />
    )} />
  )}
</Field>
```

`costCenterLabel` ใช้ `useCostCenterById(location?.cost_center_id)` จาก `hooks/use-cost-center.ts` แล้วแสดงเป็น `` `${data.code} · ${data.name}` `` (โหลดเฉพาะเมื่อมี id)

- [ ] **Step 3: payload** (L177-193) เพิ่ม `cost_center_id: values.cost_center_id ?? null,`

- [ ] **Step 4: typecheck + lint + เทสต์เดิมของ location + commit**

```bash
bun run typecheck && bunx eslint routes/config/location types/location.ts && bun test:run routes/config/location
git add types/location.ts routes/config/location
git commit -m "feat(location): ผูก cost center ที่ location (ค่าเริ่มต้นของ account mapping)"
```

ถ้า `location-form.characterization.test.tsx` แดงเพราะ payload มี key ใหม่ ให้อัปเดต expected payload ให้มี `cost_center_id: null` ห้ามแก้อย่างอื่นในเทสต์

---

### Task F6: Category / Sub-cat / Item group — Inventory + Direct account

**Files:**
- Modify: `types/category.ts` (DTO L13-33, 35-49, 51-71, 73-91, 93+ และ `CategoryNode`)
- Modify: `routes/product-management/category/use-category-tree.ts:33-110` (ทั้ง 3 mapper)
- Modify: `routes/product-management/category/category-form-schema.ts`
- Modify: `routes/product-management/category/category-form.tsx` (section ใหม่หลัง Tax profile ~L205)
- Modify: `routes/product-management/category/category-component.tsx:139-204` (`handleFormSubmit`)
- Modify: `messages/en.json`, `messages/th.json` (คีย์ใน namespace ของ category form)

**Interfaces:**
- Consumes: `LookupChartOfAccount` · backend payload `account_codes: { add?: {account_type, account_code, account_name?}[]; update?: {id, account_code?, account_name?}[]; remove?: {id}[] }` (มีอยู่แล้ว) และ `account_type: "direct"` (B1)
- Produces: `CategoryNode.account_codes: { id: string; account_type: string; account_code: string; account_name: string | null }[]` · helper `buildAccountCodesPayload(existing, next)`

- [ ] **Step 1: ยืนยันรูปข้อมูลจริงก่อนเขียนโค้ด**

```bash
curl -s "${H[@]}" "http://localhost:4000/api/config/$BU/product-item-groups?perpage=1" | jq '.data[0] | keys'
curl -s "${H[@]}" "http://localhost:4000/api/config/$BU/product-category?perpage=1" | jq '.data[0] | keys'
```

ให้ใช้ path จริงตาม `API_ENDPOINTS.PRODUCT_ITEM_GROUPS` / `PRODUCT_CATEGORIES` ถ้าใน response **มี** `account_codes` (หรือชื่อใกล้เคียง) ให้จดชื่อ field และรูปของ element แล้วทำ Step 2 ต่อ แต่ถ้า**ไม่มี** ให้หยุด task นี้แล้วรายงานผู้ใช้ เพราะต้องเพิ่ม `account_codes` ใน serializer ของ backend ทั้ง micro และ gateway ก่อน (memory `backend-add-field-serializer-gotcha`) ซึ่งเป็นงาน backend ที่ไม่อยู่ใน plan นี้

- [ ] **Step 2: types + tree mappers**

ใน `types/category.ts` เพิ่ม:

```ts
export interface AccountCodeEntry { id: string; account_type: string; account_code: string; account_name: string | null }
export interface AccountCodesPayload {
  add?: { account_type: "inventory" | "direct"; account_code: string; account_name?: string | null }[];
  update?: { id: string; account_code: string; account_name?: string | null }[];
  remove?: { id: string }[];
}
```

เพิ่ม `account_codes?: AccountCodeEntry[]` ใน DTO ฝั่งอ่านทั้ง 3 ระดับ และใน `CategoryNode` เพิ่ม `account_codes?: AccountCodesPayload` ใน DTO ฝั่ง create/update ทั้ง 3 ระดับ แล้วในทั้ง 3 mapper ของ `use-category-tree.ts` เพิ่ม `account_codes: dto.account_codes ?? [],`

- [ ] **Step 3: schema + helper**

ใน `category-form-schema.ts`:

```ts
  inventory_account_code: z.string().nullable().optional(),
  direct_account_code: z.string().nullable().optional(),
```

แล้วเพิ่ม helper (export) ในไฟล์เดียวกัน:

```ts
import type { AccountCodeEntry, AccountCodesPayload } from "@/types/category";

/** แปลงค่าในฟอร์ม → add/update/remove เทียบกับของเดิม เฉพาะ inventory/direct (ชนิดอื่นไม่แตะ) */
export function buildAccountCodesPayload(
  existing: AccountCodeEntry[],
  next: { inventory: string | null | undefined; direct: string | null | undefined },
): AccountCodesPayload | undefined {
  const out: Required<AccountCodesPayload> = { add: [], update: [], remove: [] };
  for (const type of ["inventory", "direct"] as const) {
    const cur = existing.find((e) => e.account_type === type);
    const val = next[type] || null;
    if (!cur && val) out.add.push({ account_type: type, account_code: val });
    else if (cur && !val) out.remove.push({ id: cur.id });
    else if (cur && val && cur.account_code !== val) out.update.push({ id: cur.id, account_code: val });
  }
  return out.add.length || out.update.length || out.remove.length ? out : undefined;
}
```

ใน `defaultValues` ของ `category-form.tsx` (L65-97) ให้เติม:

```ts
    inventory_account_code: node?.account_codes?.find((a) => a.account_type === "inventory")?.account_code ?? null,
    direct_account_code: node?.account_codes?.find((a) => a.account_type === "direct")?.account_code ?? null,
```

(ใช้ตัวแปร node ที่ form ใช้อยู่จริงในโหมด edit ส่วนโหมด add ให้เป็น null)

- [ ] **Step 4: section "บัญชี" ในฟอร์ม** (หลัง Tax profile ~L205)

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <Field>
    <FieldLabel>{t("inventoryAccount")}</FieldLabel>
    <Controller control={form.control} name="inventory_account_code" render={({ field }) => (
      <LookupChartOfAccount value={field.value ?? ""} onValueChange={(code) => field.onChange(code || null)}
        placeholder={inheritedPlaceholder("inventory")} disabled={isDisabled} />
    )} />
  </Field>
  <Field>
    <FieldLabel>{t("directAccount")}</FieldLabel>
    <Controller control={form.control} name="direct_account_code" render={({ field }) => (
      <LookupChartOfAccount value={field.value ?? ""} onValueChange={(code) => field.onChange(code || null)}
        placeholder={inheritedPlaceholder("direct")} disabled={isDisabled} />
    )} />
  </Field>
</div>
```

`inheritedPlaceholder(type)` จะเดิน `parentNode` ขึ้นไปทีละระดับ (item group → sub-cat → category) แล้วหา `account_codes` ชนิดนั้นตัวแรกที่เจอ ถ้าเจอคืน `t("inheritedFrom", { level, code })` ถ้าไม่เจอคืน `undefined` ถ้า `parentNode` ไม่มี reference ไปถึงชั้นปู่ ให้ส่ง prop `ancestors: CategoryNode[]` จาก `category-component.tsx` (หาได้จาก tree ที่ component นั้นถืออยู่) ส่วน `isDisabled` ให้ใช้ชื่อตัวแปรที่ฟอร์มนี้ใช้จริง

i18n (ใช้ namespace ที่ `category-form.tsx` เรียก `t` อยู่):
- en: `"inventoryAccount": "Inventory account"`, `"directAccount": "Direct account"`, `"inheritedFrom": "Inherited from {level}: {code}"`
- th: `"inventoryAccount": "บัญชี Inventory"`, `"directAccount": "บัญชี Direct"`, `"inheritedFrom": "สืบทอดจาก {level}: {code}"`

- [ ] **Step 5: submit** (`category-component.tsx:139-204`)

ก่อนส่งในทุก branch (edit / add child / add root):

```ts
const { inventory_account_code, direct_account_code, ...rest } = data;
const account_codes = buildAccountCodesPayload(
  mode === "edit" ? (selectedNode?.account_codes ?? []) : [],
  { inventory: inventory_account_code, direct: direct_account_code },
);
const payload = { ...rest, ...(account_codes ? { account_codes } : {}) };
```

จากนั้นส่ง `payload` แทน `data` ในทุก mutate เดิม (`updateCategory` / `updateSubCategory` / `updateItemGroup` / `create*`)

- [ ] **Step 6: typecheck + lint + เทสต์เดิม + ตรวจด้วยมือ + commit**

```bash
bun run typecheck && bunx eslint routes/product-management/category types/category.ts && bun test:run routes/product-management/category
```

ตรวจด้วยมือ:
1. ตั้ง Inventory account ที่ sub-cat แล้วเปิดหน้า mapping แถวของ item group ใต้ sub-cat นั้นที่ไม่ได้แก้ทับต้องเปลี่ยนเป็นรหัสใหม่ พร้อมป้าย "ค่าเริ่มต้น · sub-category"
2. ตั้ง Direct account ที่ category แล้วแถวของ location direct ต้องได้รหัสนั้น
3. ลบค่าที่ตั้งไว้ แล้วแถวต้องกลับไปเป็น "ยังไม่ครบ"

ถ้าเทสต์ form/schema เดิมแดงเพราะ defaultValues มี key ใหม่ ให้อัปเดตเฉพาะ expected values

```bash
git add types/category.ts routes/product-management/category messages
git commit -m "feat(category): ตั้ง Inventory/Direct account ที่ category / sub-cat / item group (สืบทอดลงล่าง)"
```

---

## Rollout (หลังทั้งสอง PR ผ่าน review)

1. merge BE → deploy BE (`Deploy Dev` ตอนนี้ไม่รันเพราะติด billing ต้อง SSH :2206 ให้ผู้ใช้รันเอง)
2. รัน tenant migration ทีละ BU ผ่าน `POST /api-system/tenant/migrations/:bu_id/deploy` (ทำหลัง deploy app เสมอ)
3. `cd packages/prisma-shared-schema-platform && bun run db:seed.permission` แล้ว**ให้ role ที่ต้องใช้หน้านี้ได้สิทธิ์ `configuration.chart_of_account_mapping`** ไม่อย่างนั้นผู้ใช้ที่ไม่ใช่ admin จะได้ 403 (admin bypass จึงไม่มีใครเห็นปัญหา)
4. app ที่ไม่ได้ `allow_all` ยังไม่ต้องได้ api_name ใหม่ในรอบนี้ ส่วนระบบส่งออกภายนอกที่จะใช้ `/resolve` ให้เพิ่มใน `seed.application-api.data.ts` ตอนทำ spec posting
5. ต้องเห็น `curl` ยิง GET list บนแต่ละ env ได้ 200 ก่อน แล้วจึง merge FE และ `vercel --prod`
6. FE ต้องขึ้นหลัง BE เสมอ (ไม่มี mock สำรองแล้ว) ส่วน rollback FE ทำได้อิสระ
