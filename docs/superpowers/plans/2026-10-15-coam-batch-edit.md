# Chart of Account Mapping Batch Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ติ๊กหลายแถวในหน้า `/config/chart-of-account-mapping` แล้วตั้ง / คืนค่าเริ่มต้นของ account และ/หรือ cost center ให้ทุกแถวในครั้งเดียว

**Architecture:** endpoint ใหม่ `POST /api/:bu_code/account-mapping/batch-update` (gateway → RPC → micro-business)
ตรวจค่าเป้าหมายครั้งเดียว แล้ว update ทีละแถวด้วย `doc_version` ของแถวนั้น (บันทึกเท่าที่ได้) ตอบ
`{ updated, conflicts, not_found }` ฝั่ง FE เพิ่มปุ่มในแถบแถวที่เลือก + sheet ใหม่ที่ให้แต่ละช่องเลือก
ไม่เปลี่ยน / ตั้งเป็น / คืนค่าเริ่มต้น

**Tech Stack:** BE — NestJS + Zod (`nestjs-zod`) + Prisma (tenant client มี optimistic-lock extension) + `@repo/rpc-contract`
· FE — React 19 + TanStack Query/Table + `use-intl` + shadcn/radix

**Spec:** `docs/superpowers/specs/2026-10-15-coam-batch-edit-design.md` (FE repo)

**Repos / branch:** ทั้งสองรีโปอยู่บน branch `feature/coam-column-sort` อยู่แล้ว (มี commit งาน sort ก่อนหน้า) — ทำต่อบน branch นี้
- BE: `/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2`
- FE: `/Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react`

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (ความต้องการของ user): ข้ามขั้น "write failing test / run test" ทั้งหมด ห้ามสร้าง `*.spec.ts` / `*.test.ts` — แต่ **typecheck + lint ต้องรันทุก task** และ suite เดิมต้องไม่แดงเพิ่ม การตรวจจริงคือ curl + เบราว์เซอร์ใน Task 5
- commit message เป็น **ภาษาไทย** รูปแบบ conventional (`feat(account-mapping): …` ฝั่ง BE, `feat(config): …` ฝั่ง FE) ห้าม squash
- FE ห้ามแตะ `.claude/*`, `.mcp.json`, `package.json` (แก้ค้างอยู่ ไม่ใช่ของงานนี้) — `git add` ระบุไฟล์ทีละไฟล์เสมอ
- `items` 1–100 รายการ, id ห้ามซ้ำ; ต้องมี `account_code` หรือ `cost_center_id` อย่างน้อยหนึ่ง; "ไม่ส่ง" = ไม่เปลี่ยน, `null` = คืนค่าเริ่มต้น
- 422 ทั้งก้อนก่อนแตะแถวใด ๆ: `ACCOUNT_MAPPING_ACCOUNT_INVALID` / `ACCOUNT_MAPPING_COST_CENTER_INVALID`
- ทุกแถวที่บันทึกสำเร็จตั้ง `is_reviewed: true`, `updated_by_id`, `updated_at` (เหมือน `update()`)
- api_name ใหม่ = `account-mapping.batchUpdate` · permission = `configuration.chart_of_account_mapping` : `update`
- ข้อความแปลห้ามมี `{{` / `}}` (ICU จะพังทั้งหน้า) · สีข้อความเตือนใช้ `text-warning-ink` ไม่ใช่ `text-warning`
- local backend `:4000` ต่อ **DB dev ที่ใช้ร่วมกัน** — ทดสอบเฉพาะแถวที่เป็น default แล้วคืนค่าทุกครั้ง ห้ามเขียน allowlist ลง DB เองโดยไม่ถาม user

## Review Focus

1. **api_name ใหม่ยังไม่อยู่ใน allowlist** — คาดหวัง: รู้ก่อน deploy; ความจริง: gateway ตอบ 401 แล้ว FE ล้าง token เด้ง user ไป `/login` (ไม่ใช่แค่ปุ่มไม่ทำงาน) → Task 5 Step 1 ยิงก่อนเติมเพื่อดูว่า env ตั้ง `allow_all` ไหม
2. **แถวที่ติ๊กถูกคนอื่นแก้ระหว่างเปิด sheet** — คาดหวัง: แถวอื่นบันทึก แถวนั้นยังติ๊กค้าง + toast บอกจำนวน → Task 5 Step 4 (doc_version เก่า)
3. **รหัสบัญชีไม่อยู่ในผังบัญชี / cost center ถูกปิด** — คาดหวัง: 422 ข้อความจาก catalog และไม่มีแถวไหนเปลี่ยน sheet ไม่ปิด → Task 5 Step 5
4. **กดบันทึกโดยทุกช่องเป็น "ไม่เปลี่ยน" หรือเลือก "ตั้งเป็น" แต่ยังไม่เลือกค่า** — คาดหวัง: ปุ่มบันทึก disable (FE) และ 400 ถ้ายิงตรง (BE) → Task 4 Step 2 (`canSave`), Task 5 Step 6
5. **เปลี่ยนหน้า / แท็บ / ตัวกรองหลังบันทึกที่มีแถวค้าง** — คาดหวัง: การเลือกถูกล้างตาม `scopeKey` เดิม ไม่มีแถวผีติดไปหน้าอื่น → Task 5 Step 8

---

### Task 1: micro-business — `batchUpdate` (schema + service + RPC handler + contract)

**Files:**
- Modify: `apps/micro-business/src/master/account-mapping/dto/account-mapping.dto.ts` (ต่อท้าย `AccountMappingReviewSchema` ~บรรทัด 35)
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.service.ts` (`update()` ~บรรทัด 444, เพิ่ม `batchUpdate()` ต่อจาก `review()`)
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.controller.ts` (ต่อจาก handler `review` ~บรรทัด 61)
- Modify (generated): `packages/rpc-contract/src/contracts/account-mapping.ts`

**Interfaces:**
- Produces: RPC `AccountMapping.batchUpdate` (cmd `account-mapping.batch-update`, service `micro-business`) รับ `payload.data`:
  `{ items: {id: string; doc_version: number}[]; account_code?: string | null; cost_center_id?: string | null }`
  ตอบ `Result.ok({ updated: {id: string; doc_version: number}[]; conflicts: string[]; not_found: string[] })`

- [ ] **Step 1: เพิ่ม schema** ใน `dto/account-mapping.dto.ts` ต่อจาก `export type AccountMappingReview …`

```ts
/**
 * Batch override payload — same value for every row; omitted = unchanged, null = back to default
 * payload แก้ทับหลายแถว — ค่าเดียวกันทุกแถว; ไม่ส่ง = ไม่เปลี่ยน, null = กลับไปใช้ค่าเริ่มต้น
 */
export const AccountMappingBatchUpdateSchema = z
  .object({
    items: z
      .array(z.object({ id: z.string().uuid(), doc_version: z.number().int() }))
      .min(1)
      .max(100),
    account_code: z.string().min(1).nullable().optional(),
    cost_center_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => new Set(v.items.map((i) => i.id)).size === v.items.length, {
    message: 'items must not contain duplicate id',
    path: ['items'],
  })
  .refine((v) => v.account_code !== undefined || v.cost_center_id !== undefined, {
    message: 'account_code or cost_center_id is required',
    path: ['account_code'],
  });
export type AccountMappingBatchUpdate = z.infer<typeof AccountMappingBatchUpdateSchema>;
```

- [ ] **Step 2: แยกการตรวจค่าเป้าหมายออกจาก `update()`** เพื่อใช้ร่วมกัน — ใน `account-mapping.service.ts`
  เพิ่ม method นี้ไว้เหนือ `update()` แล้วแทนบล็อก `const active = …` ถึง `if (!cc) return …` ใน `update()` ด้วย
  `const invalid = await this.invalidTarget(data.account_code, data.cost_center_id); if (invalid) return invalid;`

```ts
  /**
   * ตรวจว่ารหัสบัญชี / cost center ที่จะตั้งยังใช้ได้ (active = is_active true หรือ null)
   * ใช้ร่วมกันระหว่าง update() และ batchUpdate() — null / undefined (ล้างค่า / ไม่แตะ) ไม่ต้องตรวจ
   * @param account_code รหัสบัญชีที่จะตั้ง
   * @param cost_center_id cost center ที่จะตั้ง
   * @returns Result error จาก catalog ถ้าใช้ไม่ได้ · null ถ้าผ่าน
   */
  private async invalidTarget(
    account_code: string | null | undefined,
    cost_center_id: string | null | undefined,
  ): Promise<Result<unknown> | null> {
    const p = this.prismaService;
    const active = { OR: [{ is_active: true }, { is_active: null }] };
    if (account_code) {
      const coa = await p.tb_chart_of_accounts.findFirst({
        where: { code: account_code, ...active },
        select: { id: true },
      });
      if (!coa) return Result.errorFromCatalog(ERROR_CATALOG.ACCOUNT_MAPPING_ACCOUNT_INVALID);
    }
    if (cost_center_id) {
      const cc = await p.tb_cost_center.findFirst({
        where: { id: cost_center_id, ...active },
        select: { id: true },
      });
      if (!cc) return Result.errorFromCatalog(ERROR_CATALOG.ACCOUNT_MAPPING_COST_CENTER_INVALID);
    }
    return null;
  }
```

- [ ] **Step 3: เพิ่ม `batchUpdate()`** ต่อจาก `review()` และเพิ่ม import
  (`OptimisticLockError` จาก `'@repo/prisma-shared-schema-tenant'` — ต่อท้าย import `{ Prisma, tenantTableRef }` เดิม;
  `AccountMappingBatchUpdateSchema` จาก `'./dto/account-mapping.dto'`)

```ts
  /**
   * แก้ทับหลายแถวด้วยค่าเดียวกัน — บันทึกเท่าที่ได้ (ไม่ห่อ transaction ใหญ่)
   * ตรวจค่าเป้าหมายครั้งเดียวก่อน (ผิด = 422 ทั้งก้อน ไม่แตะสักแถว) แล้วอ่าน doc_version ปัจจุบันครั้งเดียว
   * เพื่อแยก not_found / conflicts ก่อนเขียน; OptimisticLockError ระหว่างวน (ชนกันหลังอ่าน) นับเป็น conflicts
   * error อื่นโยนต่อ — แถวที่บันทึกไปแล้วค้างอยู่ ตามนโยบายบันทึกเท่าที่ได้
   * @param payload { items: [{ id, doc_version }], account_code?, cost_center_id? }
   * @returns { updated: [{ id, doc_version }], conflicts: id[], not_found: id[] }
   */
  @TryCatch
  async batchUpdate(payload: unknown): Promise<Result<unknown>> {
    this.logger.debug({ function: 'batchUpdate', payload }, AccountMappingService.name);
    const p = this.prismaService;
    const data = AccountMappingBatchUpdateSchema.parse(payload);
    const invalid = await this.invalidTarget(data.account_code, data.cost_center_id);
    if (invalid) return invalid;

    const current = await p.tb_account_mapping.findMany({
      where: { id: { in: data.items.map((i) => i.id) } },
      select: { id: true, doc_version: true },
    });
    const versionOf = new Map(current.map((r) => [r.id, r.doc_version]));

    const updated: { id: string; doc_version: number }[] = [];
    const conflicts: string[] = [];
    const not_found: string[] = [];
    for (const item of data.items) {
      const version = versionOf.get(item.id);
      if (version === undefined) {
        not_found.push(item.id);
        continue;
      }
      if (version !== item.doc_version) {
        conflicts.push(item.id);
        continue;
      }
      try {
        const row = await p.tb_account_mapping.update({
          where: { id: item.id, doc_version: item.doc_version },
          data: {
            ...(data.account_code !== undefined ? { account_code: data.account_code } : {}),
            ...(data.cost_center_id !== undefined ? { cost_center_id: data.cost_center_id } : {}),
            is_reviewed: true,
            updated_by_id: this.userId,
            updated_at: new Date(),
          },
          select: { id: true, doc_version: true },
        });
        updated.push(row);
      } catch (error) {
        if (error instanceof OptimisticLockError) {
          conflicts.push(item.id);
          continue;
        }
        if ((error as { code?: string })?.code === 'P2025') {
          not_found.push(item.id);
          continue;
        }
        throw error;
      }
    }
    return Result.ok({ updated, conflicts, not_found });
  }
```

- [ ] **Step 4: RPC handler แบบ literal ชั่วคราว** (ขั้นที่ 1 ของ 3 ตามหัวไฟล์ rpc-contract) — ใน controller ต่อจาก `review`

```ts
  /**
   * Override many rows with the same value (partial success)
   * แก้ทับหลายแถวด้วยค่าเดียวกัน (บันทึกเท่าที่ได้)
   * @param payload - RPC payload with `data` (`{ items, account_code?, cost_center_id? }`)
   * @returns Envelope / ซองคำตอบ
   */
  @MessagePattern({ cmd: 'account-mapping.batch-update', service: 'micro-business' })
  async batchUpdate(@Payload() payload: MicroservicePayload): Promise<MicroserviceResponse> {
    this.logger.debug({ function: 'batchUpdate', payload }, AccountMappingController.name);
    return this.handleResult(
      await this.ctx.run(payload, () => this.service.batchUpdate(payload.data)),
    );
  }
```

- [ ] **Step 5: generate contract แล้วแทน literal**

Run (ที่ root ของ BE): `bun run gen:rpc-contract`
Expected: `packages/rpc-contract/src/contracts/account-mapping.ts` มีบรรทัดใหม่สำหรับ `account-mapping.batch-update`
— ดูชื่อ key ที่ generator ตั้งให้ (คาดว่า `batchUpdate`) ถ้าได้ `.restTodo()` ให้แก้เป็น
`.rest('POST', '/account-mapping/batch-update')` ตามแบบ `review`
จากนั้นแทน decorator ใน controller เป็น `@MessagePattern(AccountMapping.batchUpdate.pattern)` (ใช้ชื่อ key ที่ได้จริง)

- [ ] **Step 6: typecheck + lint**

Run: `cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json; echo exit=$?` → Expected: `exit=0`
Run: `cd apps/micro-business && bunx eslint src/master/account-mapping --quiet; echo exit=$?` → Expected: `exit=0`
(jsdoc rule บังคับ `@param` ครบทุกตัว รวม destructured — ถ้าแดงให้เติม)
Run: `cd packages/rpc-contract && bunx tsc --noEmit; echo exit=$?` → Expected: `exit=0`
Run (suite เดิม): `cd apps/micro-business && bunx jest src/master/account-mapping` → Expected: PASS (ใช้ jest ห้าม `bun test`)

- [ ] **Step 7: Commit**

```bash
git add apps/micro-business/src/master/account-mapping packages/rpc-contract/src/contracts/account-mapping.ts
git commit -m "feat(account-mapping): batchUpdate แก้ทับหลายแถวในครั้งเดียว (micro-business)

- ตรวจรหัสบัญชี / cost center ครั้งเดียว ผิด = 422 ไม่แตะสักแถว (แยก invalidTarget() ใช้ร่วมกับ update)
- บันทึกเท่าที่ได้ ตอบ updated / conflicts (doc_version ไม่ตรง) / not_found"
```

---

### Task 2: gateway — `POST /account-mapping/batch-update`

**Files:**
- Modify: `apps/backend-gateway/src/common/dto/account-mapping/account-mapping.dto.ts` (ต่อจาก `AccountMappingReviewDto` ~บรรทัด 131)
- Modify: `apps/backend-gateway/src/application/account-mapping/swagger/request.ts`, `swagger/response.ts`
- Modify: `apps/backend-gateway/src/application/account-mapping/account-mapping.service.ts` (ต่อจาก `review` ~บรรทัด 95)
- Modify: `apps/backend-gateway/src/application/account-mapping/account-mapping.controller.ts` (ต่อจาก `review` handler)
- Modify (generated): `apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts`

**Interfaces:**
- Consumes: `AccountMapping.batchUpdate` จาก Task 1 (ใช้ชื่อ key ที่ generator ตั้งจริง)
- Produces: HTTP `POST /api/:bu_code/account-mapping/batch-update` → `200 { data: { updated, conflicts, not_found } }`

- [ ] **Step 1: schema + DTO** ต่อจาก `AccountMappingReviewDto`

```ts
/**
 * Body of POST account-mapping/batch-update; same value for every row — omitted = unchanged, null = back to default
 * body ของ POST account-mapping/batch-update — ค่าเดียวกันทุกแถว; ไม่ส่ง = ไม่เปลี่ยน, null = กลับไปใช้ค่าเริ่มต้น
 */
export const AccountMappingBatchUpdateSchema = z
  .object({
    items: z
      .array(z.object({ id: z.string().uuid(), doc_version: z.number().int() }))
      .min(1)
      .max(100),
    account_code: z.string().min(1).nullable().optional(),
    cost_center_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => new Set(v.items.map((i) => i.id)).size === v.items.length, {
    message: 'items must not contain duplicate id',
    path: ['items'],
  })
  .refine((v) => v.account_code !== undefined || v.cost_center_id !== undefined, {
    message: 'account_code or cost_center_id is required',
    path: ['account_code'],
  });

export type IAccountMappingBatchUpdate = z.infer<typeof AccountMappingBatchUpdateSchema>;

/**
 * DTO class for the batch override
 * คลาส DTO สำหรับแก้ทับหลายแถว
 */
export class AccountMappingBatchUpdateDto extends createZodDto(AccountMappingBatchUpdateSchema) {}
```

schema ที่มี `.refine` ใช้กับ `createZodDto` ได้ — มีตัวอย่างในรีโปแล้วที่ `common/dto/auth/auth.dto.ts:26` และ
`common/dto/notification/notification.dto.ts:231`

- [ ] **Step 2: swagger** — `swagger/request.ts` ต่อจาก `AccountMappingReviewRequest`

```ts
/**
 * Request body for overriding many rows at once
 * เนื้อหาคำขอแก้ทับหลายแถวพร้อมกัน
 */
export class AccountMappingBatchUpdateRequest {
  @ApiProperty({
    description: 'Rows to change (1-100), each with the doc_version the client last saw',
    example: [{ id: '3f6c…', doc_version: 2 }],
  })
  items: { id: string; doc_version: number }[];

  @ApiPropertyOptional({ nullable: true, description: 'Omit = unchanged · null = back to default' })
  account_code?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Omit = unchanged · null = back to default' })
  cost_center_id?: string | null;
}
```

`swagger/response.ts` ต่อจาก `AccountMappingReviewResponseDto`

```ts
/**
 * Result of a batch override: saved rows, rows whose doc_version no longer matched, and missing rows
 * ผลของการแก้ทับหลายแถว: แถวที่บันทึก, แถวที่ doc_version ไม่ตรง และแถวที่หาไม่เจอ
 */
export class AccountMappingBatchUpdateResponseDto {
  @ApiProperty({ example: [{ id: '3f6c…', doc_version: 3 }] })
  updated: { id: string; doc_version: number }[];
  @ApiProperty({ type: [String] }) conflicts: string[];
  @ApiProperty({ type: [String] }) not_found: string[];
}
```

(ถ้า `ApiPropertyOptional` ยังไม่ถูก import ใน `request.ts` ให้เพิ่มจาก `@nestjs/swagger`)

- [ ] **Step 3: gateway service** ต่อจาก `review()` (เพิ่ม `IAccountMappingBatchUpdate` ใน import จาก dto)

```ts
  /**
   * Override many rows with the same value (partial success)
   * แก้ทับหลายแถวด้วยค่าเดียวกัน (บันทึกเท่าที่ได้)
   * @param user_id - Requesting user ID / รหัสผู้ใช้ที่ร้องขอ
   * @param bu_code - Business unit code / รหัสหน่วยธุรกิจ
   * @param data - Rows and target values / แถวและค่าที่จะตั้ง
   * @param version - API version / เวอร์ชัน API
   * @returns updated / conflicts / not_found or error / ผลแยกตามแถวหรือข้อผิดพลาด
   */
  async batchUpdate(
    user_id: string,
    bu_code: string,
    data: IAccountMappingBatchUpdate,
    version: string,
  ): Promise<Result<unknown>> {
    this.logger.debug({ function: 'batchUpdate', version }, AccountMappingGatewayService.name);
    return this.rpc.call(AccountMapping.batchUpdate, { user_id, bu_code, version, data });
  }
```

- [ ] **Step 4: controller** ต่อจาก `review` handler (เพิ่ม import `AccountMappingBatchUpdateRequest`,
  `AccountMappingBatchUpdateResponseDto`, `AccountMappingBatchUpdateDto`)

```ts
  /**
   * Overrides account and/or cost center of many rows at once
   * แก้ทับบัญชีและ/หรือ cost center หลายแถวพร้อมกัน
   * @param req - HTTP request / คำขอ HTTP
   * @param res - HTTP response / การตอบกลับ HTTP
   * @param bu_code - Business unit code / รหัสหน่วยธุรกิจ
   * @param body - Rows and target values / แถวและค่าที่จะตั้ง
   * @param version - API version / เวอร์ชัน API
   */
  @Post('batch-update')
  @UseGuards(new AppIdGuard('account-mapping.batchUpdate'))
  @Permission({ [RESOURCE]: ['update'] })
  @HttpCode(HttpStatus.OK)
  @ApiVersionMinRequest()
  @ApiOperation({
    summary: 'Override account / cost center of many rows',
    description:
      'Sets (or resets to default with null) the account and/or cost center of up to 100 rows. Partial success: rows whose doc_version no longer matches are returned in conflicts.\n\nแก้ทับ (หรือคืนค่าเริ่มต้นด้วย null) ได้สูงสุด 100 แถว — บันทึกเท่าที่ได้ แถวที่ doc_version ไม่ตรงอยู่ใน conflicts',
    operationId: 'accountMapping_batchUpdate',
  })
  @ApiParam(BU_CODE_PARAM)
  @ApiQuery(VERSION_QUERY)
  @ApiBody({ type: AccountMappingBatchUpdateRequest })
  @ApiStdResponse(AccountMappingBatchUpdateResponseDto, { description: 'Per-row outcome' })
  @ApiResponse({ status: 400, description: 'Invalid body (empty, >100, duplicate id, nothing to change)' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks configuration.chart_of_account_mapping:update',
  })
  @ApiResponse({ status: 422, description: 'account_code / cost_center_id invalid — no row changed' })
  async batchUpdate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('bu_code') bu_code: string,
    @Body() body: AccountMappingBatchUpdateDto,
    @Query('version') version: string = 'latest',
  ): Promise<void> {
    this.logger.debug({ function: 'batchUpdate', version }, AccountMappingController.name);
    const { user_id } = ExtractRequestHeader(req);
    this.respond(res, await this.svc.batchUpdate(user_id, bu_code, body, version));
  }
```

- [ ] **Step 5: regenerate app-api catalog**

Run (ที่ root ของ BE): `bun run scripts/generate-app-api-catalog/run.ts && bun run audit:app-api-catalog-drift`
Expected: `app-api-catalog.generated.ts` มี `'account-mapping.batchUpdate'` ทั้งในรายการรวมและในแถว `{ module: 'account-mapping', … }`; audit ไม่รายงาน drift

- [ ] **Step 6: typecheck + lint**

Run: `cd apps/backend-gateway && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `1` — error เดิมที่ `src/swagger/verify-swagger.spec.ts` (rootDir) ซึ่งมีอยู่ก่อนงานนี้; ห้ามมี error อื่น
Run: `cd apps/backend-gateway && bunx eslint src/application/account-mapping src/common/dto/account-mapping --quiet; echo exit=$?` → Expected: `exit=0`

- [ ] **Step 7: Commit**

```bash
git add apps/backend-gateway/src/common/dto/account-mapping apps/backend-gateway/src/application/account-mapping apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts
git commit -m "feat(account-mapping): POST /account-mapping/batch-update (gateway)

- api_name ใหม่ account-mapping.batchUpdate — ต้องเติม app allowlist ก่อน deploy ไม่งั้น user ถูกเด้งออกหน้า login
- ใช้สิทธิ์ configuration.chart_of_account_mapping:update เดียวกับ PATCH / review"
```

---

### Task 3: FE — hook + i18n

**Files:**
- Modify: `routes/config/chart-of-account-mapping/use-account-mapping.ts` (ต่อจาก `useReviewAccountMapping`)
- Modify: `messages/en.json`, `messages/th.json` (ใต้ `config.chartOfAccountMapping` ต่อจาก `"conflict"`)
- Modify: `routes/config/chart-of-account-mapping/use-coam-table.tsx` (export `MOVEMENT_KEY`)

**Interfaces:**
- Produces:
  - `BatchUpdateAccountMappingVariables = { items: { id: string; doc_version: number }[]; account_code?: string | null; cost_center_id?: string | null }`
  - `BatchUpdateAccountMappingResult = { updated: { id: string; doc_version: number }[]; conflicts: string[]; not_found: string[] }`
  - `useBatchUpdateAccountMapping()` → TanStack mutation `<Variables, Result>` (error toast ปิดไว้ ให้ caller จัดการ)
  - `export const MOVEMENT_KEY` จาก `use-coam-table.tsx` (ไม่เปลี่ยนค่า แค่ export)
  - i18n keys: `editSelected`, `batchEditTitle`, `batchEditDesc`, `modeKeep`, `modeSet`, `batchEditDone`, `batchEditPartial`

- [ ] **Step 1: hook** ใน `use-account-mapping.ts` ต่อจาก `useReviewAccountMapping`

```ts
export interface BatchUpdateAccountMappingVariables {
  items: { id: string; doc_version: number }[];
  /** `null` = คืนค่าเริ่มต้น · ไม่ส่ง = ไม่แตะ */
  account_code?: string | null;
  cost_center_id?: string | null;
}

export interface BatchUpdateAccountMappingResult {
  updated: { id: string; doc_version: number }[];
  /** doc_version ไม่ตรง — มีคนแก้ไปก่อน */
  conflicts: string[];
  /** ถูกลบไปแล้ว */
  not_found: string[];
}

/** POST batch-update — บันทึกเท่าที่ได้; 422 (ค่าเป้าหมายใช้ไม่ได้) ให้ sheet แสดงเอง */
export function useBatchUpdateAccountMapping() {
  return useAccountMappingMutation<
    BatchUpdateAccountMappingVariables,
    BatchUpdateAccountMappingResult
  >(
    (body, buCode) =>
      httpClient.post(`${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/batch-update`, body),
    "Failed to batch update account mapping",
    { skipGlobalErrorToast: true },
  );
}
```

- [ ] **Step 2: export `MOVEMENT_KEY`** — ใน `use-coam-table.tsx` เปลี่ยน `const MOVEMENT_KEY = {` เป็น `export const MOVEMENT_KEY = {`

- [ ] **Step 3: i18n** — เพิ่มต่อจากบรรทัด `"conflict": …` ใน `config.chartOfAccountMapping` (ระวัง comma ของบรรทัดก่อนหน้า)

`messages/en.json`
```json
      "editSelected": "Edit",
      "batchEditTitle": "Edit {count} rows",
      "batchEditDesc": "Locations: {locations} · Movements: {movements}",
      "modeKeep": "Don't change",
      "modeSet": "Set to",
      "batchEditDone": "Saved {count} rows",
      "batchEditPartial": "Saved {saved} rows · {failed} rows were changed by someone else or no longer exist. They stay selected — check them and try again.",
```

`messages/th.json`
```json
      "editSelected": "แก้",
      "batchEditTitle": "แก้ {count} แถว",
      "batchEditDesc": "Location: {locations} · Movement: {movements}",
      "modeKeep": "ไม่เปลี่ยน",
      "modeSet": "ตั้งเป็น",
      "batchEditDone": "บันทึก {count} แถวแล้ว",
      "batchEditPartial": "บันทึก {saved} แถว · {failed} แถวถูกแก้โดยคนอื่นหรือถูกลบไปแล้ว ยังติ๊กค้างไว้ให้ ตรวจแล้วลองอีกครั้ง",
```

(ปุ่ม "คืนค่าเริ่มต้น" ใช้ key เดิม `resetToDefault`)

- [ ] **Step 4: ตรวจ**

Run: `bun run typecheck` → Expected: ไม่มี error
Run: `python3 -c "import json;[json.load(open(f'messages/{l}.json')) for l in ('en','th')];print('ok')"` → Expected: `ok`
Run: `bunx vitest run lib/error-message.test.ts routes/system-admin/role/permission-catalog.test.ts` → Expected: PASS (เทสต์ที่อ่านไฟล์แปล)

- [ ] **Step 5: Commit**

```bash
git add routes/config/chart-of-account-mapping/use-account-mapping.ts routes/config/chart-of-account-mapping/use-coam-table.tsx messages/en.json messages/th.json
git commit -m "feat(config): hook และข้อความสำหรับแก้หลายแถวในผังการผูกบัญชี"
```

---

### Task 4: FE — sheet แก้หลายแถว + ปุ่มในแถบแถวที่เลือก

**Files:**
- Create: `routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx`
- Modify: `routes/config/chart-of-account-mapping/coam-component.tsx` (state, ปุ่มใน `actions`, render sheet)

**Interfaces:**
- Consumes: `useBatchUpdateAccountMapping`, `BatchUpdateAccountMappingResult` (Task 3), `MOVEMENT_KEY` (Task 3), `LookupCostCenter`, `LookupChartOfAccount`, `RadioGroup`/`RadioGroupItem`, `useErrorToast`
- Produces: `CoamBatchEditSheet({ rows: AccountMappingRow[]; open: boolean; onClose(): void; onDone(result: BatchUpdateAccountMappingResult): void })`

- [ ] **Step 1: สร้าง `coam-batch-edit-sheet.tsx`**

```tsx
"use no memo";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";
import {
  useBatchUpdateAccountMapping,
  type BatchUpdateAccountMappingResult,
  type BatchUpdateAccountMappingVariables,
} from "./use-account-mapping";
import { MOVEMENT_KEY } from "./use-coam-table";

type Mode = "keep" | "set" | "reset";

interface CoamBatchEditSheetProps {
  readonly rows: AccountMappingRow[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (result: BatchUpdateAccountMappingResult) => void;
}

/** สรุป "A, B, C +2" — กันหัว sheet ยาวเกินเมื่อเลือกหลาย location */
const summarize = (values: string[]) => {
  const unique = [...new Set(values)];
  return unique.length > 3
    ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`
    : unique.join(", ");
};

/**
 * แก้ account / cost center ของหลายแถวด้วยค่าเดียวกัน — แต่ละช่องเลือก ไม่เปลี่ยน / ตั้งเป็น / คืนค่าเริ่มต้น
 * mount ใหม่ทุกครั้งที่เปิด (caller ใส่ key) ให้ state เริ่มที่ "ไม่เปลี่ยน" เสมอ
 */
export function CoamBatchEditSheet({
  rows,
  open,
  onClose,
  onDone,
}: CoamBatchEditSheetProps) {
  const t = useTranslations("config.chartOfAccountMapping");
  const tc = useTranslations("common");
  const errorToast = useErrorToast();
  const batch = useBatchUpdateAccountMapping();
  const [ccMode, setCcMode] = useState<Mode>("keep");
  const [cc, setCc] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<Mode>("keep");
  const [account, setAccount] = useState("");

  const ccReady = ccMode !== "set" || !!cc;
  const accountReady = accountMode !== "set" || !!account;
  const canSave =
    rows.length > 0 &&
    (ccMode !== "keep" || accountMode !== "keep") &&
    ccReady &&
    accountReady &&
    !batch.isPending;

  const save = () => {
    const body: BatchUpdateAccountMappingVariables = {
      items: rows.map((r) => ({ id: r.id, doc_version: r.doc_version })),
      ...(ccMode === "set" ? { cost_center_id: cc } : {}),
      ...(ccMode === "reset" ? { cost_center_id: null } : {}),
      ...(accountMode === "set" ? { account_code: account } : {}),
      ...(accountMode === "reset" ? { account_code: null } : {}),
    };
    batch.mutate(body, {
      onSuccess: (result) => onDone(result),
      onError: (err) => errorToast(err), // 422 ฯลฯ: ข้อความจาก error catalog — ไม่ปิด sheet
    });
  };

  const modeRadios = (
    value: Mode,
    onChange: (m: Mode) => void,
    name: string,
  ) => (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as Mode)}
      className="flex flex-wrap gap-4"
      aria-label={name}
    >
      {(["keep", "set", "reset"] as const).map((m) => (
        <Label key={m} className="flex items-center gap-2">
          <RadioGroupItem value={m} />
          {t(m === "keep" ? "modeKeep" : m === "set" ? "modeSet" : "resetToDefault")}
        </Label>
      ))}
    </RadioGroup>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("batchEditTitle", { count: rows.length })}</SheetTitle>
          <SheetDescription>
            {t("batchEditDesc", {
              locations: summarize(rows.map((r) => r.location.code)),
              movements: summarize(rows.map((r) => t(MOVEMENT_KEY[r.movement]))),
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <Field>
            <FieldLabel>{t("costCenter")}</FieldLabel>
            {modeRadios(ccMode, setCcMode, t("costCenter"))}
            {ccMode === "set" && (
              <LookupCostCenter
                value={cc}
                onValueChange={(id) => setCc(id)}
                modal
              />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("account")}</FieldLabel>
            {modeRadios(accountMode, setAccountMode, t("account"))}
            {accountMode === "set" && (
              <LookupChartOfAccount
                value={account}
                onValueChange={(code) => setAccount(code)}
              />
            )}
          </Field>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

ถ้า `@/components/ui/label` ไม่ใช่ path ที่ `coam-generate-dialog.tsx` ใช้ ให้ copy import ของ `Label` จากไฟล์นั้น

- [ ] **Step 2: ต่อเข้า `coam-component.tsx`**

เพิ่ม import:
```tsx
import { CheckCheck, Pencil, Sparkles } from "lucide-react";
import { CoamBatchEditSheet } from "./coam-batch-edit-sheet";
import type { BatchUpdateAccountMappingResult } from "./use-account-mapping";
```

เพิ่ม state ต่อจาก `const [generateSeq, …]`:
```tsx
  const [batchOpen, setBatchOpen] = useState(false);
  // mount sheet ใหม่ทุกครั้งที่เปิด ให้ทุกช่องเริ่มที่ "ไม่เปลี่ยน"
  const [batchSeq, setBatchSeq] = useState(0);
```

แทนบรรทัด `const selectedIds = table…rows.map((r) => r.original.id);` ด้วย:
```tsx
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedIds = selectedRows.map((r) => r.id);
```

เพิ่ม handler ต่อจาก `markReviewed`:
```tsx
  // แถวที่บันทึกไม่ได้ยังติ๊กค้างไว้ให้ลองใหม่ — refetch ไม่เปลี่ยน scopeKey จึงไม่ถูกล้าง
  const batchDone = (res: BatchUpdateAccountMappingResult) => {
    const failed = [...res.conflicts, ...res.not_found];
    table.setRowSelection(Object.fromEntries(failed.map((id) => [id, true])));
    setBatchOpen(false);
    if (failed.length === 0) {
      toast.success(t("batchEditDone", { count: res.updated.length }));
    } else {
      toast.warning(
        t("batchEditPartial", {
          saved: res.updated.length,
          failed: failed.length,
        }),
      );
    }
  };
```

ใน `actions` ใส่ปุ่มใหม่ **ก่อน** ปุ่ม markReviewed ภายใน `{selectedIds.length > 0 && (…)}` — เปลี่ยนเป็น fragment:
```tsx
          {selectedIds.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBatchSeq((n) => n + 1);
                  setBatchOpen(true);
                }}
              >
                <Pencil aria-hidden="true" />
                {t("editSelected")}
                <span className="tabular-nums">({selectedIds.length})</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={markReviewed}
                disabled={review.isPending}
              >
                <CheckCheck aria-hidden="true" />
                {t("markReviewed")}
                <span className="tabular-nums">({selectedIds.length})</span>
              </Button>
            </>
          )}
```

render sheet ข้าง ๆ `<CoamEditSheet … />` เดิม (หาด้วย `grep -n "CoamEditSheet" coam-component.tsx`):
```tsx
      <CoamBatchEditSheet
        key={batchSeq}
        rows={selectedRows}
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onDone={batchDone}
      />
```

- [ ] **Step 3: ตรวจ**

Run: `bunx prettier --write routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx routes/config/chart-of-account-mapping/coam-component.tsx`
Run: `bun run typecheck` → Expected: ไม่มี error
Run: `bunx eslint routes/config/chart-of-account-mapping --quiet; echo exit=$?` → Expected: `exit=0`
Run: `bunx vitest run components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx routes/config/chart-of-account-mapping/coam-component.tsx
git commit -m "feat(config): แก้ account / cost center หลายแถวพร้อมกันในผังการผูกบัญชี

- ปุ่ม แก้ (N) ในแถบแถวที่เลือก เปิด sheet ให้แต่ละช่องเลือก ไม่เปลี่ยน / ตั้งเป็น / คืนค่าเริ่มต้น
- บันทึกเท่าที่ได้ แถวที่ชนหรือถูกลบยังติ๊กค้าง toast บอกจำนวน
- ต้องใช้ backend ที่มี POST /account-mapping/batch-update และ allowlist account-mapping.batchUpdate"
```

---

### Task 5: ตรวจมือ (curl + เบราว์เซอร์)

ไม่มีไฟล์ — ต้องมี micro-business (watch) และ gateway ที่ build ใหม่รันจาก branch นี้ (`:6020`, `:4000`) และ FE `:3000`
ตั้งตัวแปรใน shell เดียวกัน (ห้ามพิมพ์ token ลง commit / ไฟล์):

```bash
cd /Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react
APPID=$(python3 -c "import json;print(json.load(open('public/config.local.json'))['X_APP_ID'])")
TOK=$(curl -s -X POST localhost:4000/api/auth/login -H "Content-Type: application/json" -H "x-app-id: $APPID" \
  -d '{"email":"admin@zebra.com","password":"12345678"}' | python3 -c "import sys,json;d=json.load(sys.stdin);d=d.get('data',d);print(d['access_token'])")
H=(-H "Authorization: Bearer $TOK" -H "x-app-id: $APPID" -H "Content-Type: application/json")
URL=localhost:4000/api/T02/account-mapping
```

- [ ] **Step 1: allowlist (ก่อนเติม)** — `curl -s -X POST $URL/batch-update "${H[@]}" -d '{"items":[]}' | head -c 300`
  - ได้ 400 (validation) → env นี้ `allow_all` หรือมี api_name แล้ว ไปต่อได้
  - ได้ 401 "not found or not allowed" → **หยุด แจ้ง user** ให้เติม `account-mapping.batchUpdate` ใน allowlist ของ application (เป็น DB ที่ใช้ร่วมกัน ห้ามเขียนเอง) แล้วค่อยทำต่อ
- [ ] **Step 2: เลือกแถวทดสอบ** — 3 แถวที่เป็น default ทั้งสองช่อง (ไม่มี override):
  `curl -s "$URL?mapping_type=AP&status=default&perpage=3&page=5" "${H[@]}" | python3 -c "import sys,json;[print(r['id'],r['doc_version'],r['account']['source'],r['cost_center']['source']) for r in json.load(sys.stdin)['data']]"`
  จดค่า `ID1 V1`, `ID2 V2`, `ID3 V3` และหา cost center ที่ active 1 ตัว (`CC`) จาก `GET /api/config/T02/cost-centers?perpage=1`
- [ ] **Step 3: สำเร็จทั้งชุด** — ตั้ง cost center ให้ 3 แถว
  `curl -s -X POST $URL/batch-update "${H[@]}" -d "{\"items\":[{\"id\":\"$ID1\",\"doc_version\":$V1},{\"id\":\"$ID2\",\"doc_version\":$V2},{\"id\":\"$ID3\",\"doc_version\":$V3}],\"cost_center_id\":\"$CC\"}"`
  Expected: 200, `updated` 3 แถว (doc_version +1), `conflicts` / `not_found` ว่าง; GET อีกครั้งแล้ว `cost_center.source == "override"`, `is_reviewed == true`
- [ ] **Step 4: ชนบางแถว** — คืนค่าเริ่มต้นโดยส่ง `doc_version` เก่า (`V1`) ให้แถวแรก และค่าปัจจุบัน (`V2+1`, `V3+1`) ให้อีกสองแถว พร้อม `"cost_center_id":null`
  Expected: 200, `conflicts == [ID1]`, `updated` 2 แถว แล้วยิงซ้ำด้วย `V1+1` ให้ ID1 → `updated` 1 แถว ตอนนี้ทั้ง 3 แถวกลับเป็น default
- [ ] **Step 5: 422 ไม่แตะสักแถว** — `"account_code":"NOPE-999"` กับ ID1 → 422 `ACCOUNT_MAPPING_ACCOUNT_INVALID`; GET ID1 แล้ว `doc_version` ไม่เปลี่ยน
- [ ] **Step 6: 400** — (ก) ไม่มีทั้งสองช่อง (ข) id ซ้ำ (ค) 101 รายการ (สร้างด้วย python) → ทั้งสามได้ 400
- [ ] **Step 7: not_found** — uuid สุ่ม `00000000-0000-4000-8000-000000000000` + `"cost_center_id":null` → 200, `not_found` มีค่านั้น
- [ ] **Step 8: เบราว์เซอร์** (`localhost:3000/config/chart-of-account-mapping`, user login เอง):
  ติ๊ก 3 แถว (default) → ปุ่ม "แก้ (3)" → Cost center: ตั้งเป็น [CC] → บันทึก → toast "บันทึก 3 แถวแล้ว", ทั้ง 3 แถวขึ้น Overridden, การเลือกหายหมด
  ติ๊ก 3 แถวเดิม → Cost center: คืนค่าเริ่มต้น → บันทึก → กลับเป็น Default
  เปิด sheet แล้วปุ่มบันทึกต้อง disable ตอนทั้งสองช่องเป็น "ไม่เปลี่ยน" และตอนเลือก "ตั้งเป็น" แต่ยังไม่เลือกค่า
  ติ๊กแถวแล้วเปลี่ยนหน้า → การเลือกถูกล้าง
  ถ่ายภาพหน้าจอหลังขั้นแรกไว้แนบ PR
- [ ] **Step 9: คืนสภาพ DB** — ยืนยันด้วย GET ว่า ID1–ID3 เป็น default ทั้งสองช่อง (ถ้ายังไม่ใช่ ให้ batch-update ด้วย `null` อีกรอบ) — `is_reviewed` ที่กลายเป็น true คืนไม่ได้ผ่าน API; แจ้ง user ใน PR ว่าแถวไหนถูกตั้ง reviewed ระหว่างทดสอบ

---

## Deploy (หลัง merge — ไม่อยู่ในขอบเขตการ implement)

1. เติม app allowlist `account-mapping.batchUpdate` ทุก env ที่ application ไม่ได้ `allow_all`
2. deploy BE (micro-business + gateway — rpc-contract ต้อง build ใหม่ด้วย)
3. deploy FE (`vercel --prod` จากเครื่อง)

งาน sort บน branch เดียวกันก็ต้อง BE ก่อน FE เช่นกัน — ลำดับเดียวกัน ไม่ขัดกัน
