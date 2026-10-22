# POS Sale — แผน D: ดึงไฟล์ Simphony ทาง SFTP + cronjob

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทุกชั่วโมง `micro-cronjobs` สั่ง BE ต่อ BU; BE ตัดสินว่า BU ถึง `schedule_time` แล้วและวันนี้ยังดึงไม่สำเร็จ แล้วต่อ SFTP ดึงไฟล์ตาม `file_pattern` ที่ยังไม่เคยนำเข้า ส่งเข้า `importSimphony` เดิมทีละไฟล์ (`ingest_method: sftp`) — **นำเข้าเท่านั้น ไม่ยืนยันตัดสต็อก**

**Architecture:** gateway เพิ่ม `POST /api/internal/pos/simphony/pull` หลัง `InternalJobGuard` (แบบ `gl-jv-internal.controller.ts`) ตรวจ license brand แล้ว RPC ไป micro-business ซึ่ง **จองรอบ (claim) แล้วตอบทันที** และทำงาน SFTP ต่อเบื้องหลังใน tenant context เดิม — เพราะ retry ตาม spec (30 วิ × 4 ครั้ง + เว้น 60 วิ × 3) ยาวเกิน `RPC_TIMEOUT_MS` 30 วิของ RPC ผลแต่ละรอบเก็บในตารางใหม่ `tb_pos_sftp_pull_run` (เป็นทั้งตัวกัน "ดึงซ้ำวันนี้" และ log) ล้มเหลวแล้วแจ้งเตือนในแอปผ่าน `Notifications.create` ฝั่ง Go เพิ่ม executor `pos_simphony_pull` ที่ลอก `gl_run_due.go`

**Tech Stack:** NestJS, Prisma (tenant), `ssh2-sftp-client` (ใหม่), `@repo/secret-crypto`, `@repo/rpc-contract` · Go 1.24 (micro-cronjobs) · Vite/React (FE task เล็ก)

**Spec:** `docs/superpowers/specs/2026-10-22-pos-sale-interface-design.md` (§2 ห้ามเกิด, §3 Cron, §4.2 SFTP schedule, §4.3 retry, §5.1 config, §5.4, §7 ข้อ 6, §8) · แผน A `2026-10-22-pos-sale-a-backend-core.md` · แผน B `2026-10-22-pos-sale-b-frontend.md`

**รีโป:** BE worktree `../carmen-turborepo-backend-v2-pos-sale` (branch `feature/pos-sale-interface` เดิมของแผน A) · `../micro-cronjobs` — **แตก branch ใหม่ `feature/pos-sale-interface` จาก `main`** (รีโปนี้มีแค่ `main` + `prod` ห้ามแตะ `prod`) · FE checkout หลัก branch `feature/pos-sale-interface`

## Global Constraints

- **ไม่เขียน test ใหม่** (ความต้องการของ user) — ทุก task จบด้วย static check + commit; test เดิมต้องยังผ่าน (`go test ./...` ใน micro-cronjobs, `bun test:run` FE)
- BE ตามแผน A ทุกข้อ: `bun run check-types --filter=micro-business --filter=backend-gateway`, `npx eslint --no-fix <ไฟล์>` (ห้าม `bun run lint`), JSDoc สองภาษา, one export per file, method ≤ 20 statements, logic ห้าม throw (คืน `Result`), RPC contract-first (`gen:rpc-contract` + `audit:tcp-drift`, revert drift ที่ไม่เกี่ยวใน `business.ts`/`pricelists.ts`)
- ค่าที่ spec ตรึง: connect timeout **30 วิ**, retry **3 ครั้ง เว้น 60 วิ** (= สูงสุด 4 ครั้งต่อรอบ), cron **ทุกชั่วโมง**, `schedule_time` รูป `HH:mm` เทียบกับนาฬิกาของ BU (`tb_business_unit.timezone`, ค่าเริ่มต้น `Asia/Bangkok`)
- **ไม่มีทางไหนในแผนนี้แตะ `stock_out_id` หรือเรียก confirm** — ไฟล์ที่ดึงมาอยู่สถานะ "รอยืนยัน" เสมอ (§2)
- รหัส SFTP: ถอดรหัสด้วย `decryptSecret` ใน micro-business เท่านั้น ห้าม log, ห้ามใส่ใน error_message/ตาราง/RPC response; GET ใด ๆ ไม่คืนรหัส
- ไฟล์หนึ่งพังไม่หยุดไฟล์อื่น: try/catch ต่อไฟล์ แต่ละไฟล์นำเข้าใน transaction ของ `importSimphony` เอง
- **ห้ามรันอะไรกับ DB ที่ใช้ร่วม** (`:4000` local = dev DB) — ขั้นที่เขียน tenant DB ทำได้กับ DB ทิ้งได้เท่านั้น ไม่มีให้หยุดถาม user
- micro-cronjobs: `go build ./... && go vet ./...` + `go test ./...` (ของเดิม) ผ่าน; commit ภาษาไทย

### ที่ผมตัดสินเอง (§8 และช่องว่างของ spec — แย้งได้)
1. **ไลบรารี** `ssh2-sftp-client` (promise API บน `ssh2`; มี `readyTimeout`, `hostVerifier`) — retry เขียนเองไม่ใช้ option `retries` ของไลบรารี เพื่อนับครั้ง/log ได้ตรง spec
2. **ไฟล์บน SFTP หลังดึง: ไม่ลบ ไม่ย้าย** — account ของลูกค้ามักเป็น read-only; กันซ้ำด้วยชื่อไฟล์ในตาราง import แทน
3. **"เคยนำเข้าแล้ว"** = มีแถว `tb_pos_sale_import` brand `simphony`, `ingest_method: sftp`, `file_name` ตรงกัน **ไม่ว่าสถานะใด (รวมที่ถูกปฏิเสธ/ยกเลิก)** — ไฟล์ผิดจะไม่ถูกดึงซ้ำทุกวัน; ยกเลิกแล้วอยากนำเข้าใหม่ = อัปโหลดเอง; ไฟล์ซ้ำร้าน+วันที่ชื่อต่างกัน ตกกติกา duplicate เดิมเป็น `rejected_duplicate`
4. **ช่วงไฟล์ที่ดู**: mtime ไม่เกิน **7 วัน** ย้อนหลัง และเก่ากว่า **5 นาที** (กันไฟล์ที่ POS ยังเขียนไม่เสร็จ), ชื่อตรง pattern แบบ glob (`*` `?`) **ไม่สนตัวพิมพ์**, เรียง mtime เก่า→ใหม่, ไม่เกิน **50 ไฟล์/รอบ**, ไฟล์ > **10 MB** (เพดานเดียวกับอัปโหลด) ไม่โหลด — เปิด SFTP ครั้งแรกจะไม่ลากประวัติทั้งโฟลเดอร์เข้ามา
5. **"ดึงแล้ววันนี้"** = มีรอบ `completed` ของ `run_date` (วันของ BU) นั้น — รอบที่ต่อไม่ได้ไม่นับ cron ชั่วโมงถัดไปจึงลองใหม่จนจบวัน; **แจ้งเตือนครั้งเดียวต่อวัน** (รอบแรกที่ล้ม) ส่วนรอบหลังจากนั้น log อย่างเดียว
6. **แจ้งเตือน** = notification ในแอป (`doc_type: system`) ถึง `user_id` ที่ ops ตั้งบน cron job (คนเดียวกับ actor ของการนำเข้า — แบบ `gl_run_due`) + `logger.error` (SigNoz) + สถานะรอบที่หน้า Simphony
7. **host key แบบ TOFU**: รอบแรกหลังบันทึกค่าตั้ง Simphony จำ SHA-256 ของ host key ไว้; รอบต่อมาไม่ตรง = ไม่ส่งรหัสผ่าน, สถานะ `host_key_mismatch` + แจ้งเตือน; ยืนยันกับ admin SFTP แล้ว **กด Save ค่าตั้งอีกครั้ง = เชื่อ key ใหม่** (pin นับเฉพาะรอบที่เริ่มหลัง `tb_application_config.updated_at`) — spec ไม่มีช่อง fingerprint จึงไม่เพิ่มฟิลด์ใน config
8. **license**: endpoint ภายในเรียก `assertBrandEntitled(bu_code, simphony)` ตัวเดิมของ gateway — BU ที่ไม่มี/หมดอายุ `interface.pos.simphony` ได้ `unlicensed` ไม่ต่อ SFTP
9. **ตาราง log ใหม่ใน migration ใหม่** `20261022140000_pos_sftp_pull` ไม่แก้ `20261022130000_pos_sale` in-place — แม้ยังไม่เคย apply แต่แผน C อาจแก้ไฟล์นั้นพร้อมกัน และ deploy ต่อ BU ก็เป็นคำสั่งเดียวกันอยู่แล้ว; ไม่เก็บ "ดึงล่าสุด" ใน app-config เพราะค่านั้นถูก PUT ทั้งก้อนจากฟอร์ม (บั๊กแบบ PR #319)
10. **cron job สร้างผ่าน API ตอน deploy** ไม่ seed ใน migration (แบบ `gl_run_due`) เพราะ `bu_codes`/`user_id` ต่างกันต่อ env

## Review Focus

1. **BU ที่เปิด Simphony แต่ใช้อัปโหลดเองอย่างเดียว (SFTP ว่าง)** — ต้องเงียบ: outcome `not_configured` ไม่สร้างรอบ ไม่แจ้งเตือนทุกชั่วโมง (Task 2 `readSimphonySftpConfig` + Task 7 ข้อ 2)
2. **cron สองตัว / ยิงมือซ้อนกับ cron / pod restart กลางรอบ** — ต้องมีรอบ `running` ได้หนึ่งเดียว ตัวที่สองได้ `running`; รอบที่ค้าง > 30 นาที (pod ตาย) ถูกปิดเป็น `abandoned` แล้วจองใหม่ได้ ไม่ติดตายถาวร (Task 1 partial unique + Task 3 claim + Task 7 ข้อ 4)
3. **ไฟล์ที่ POS กำลังเขียน / ชื่อซ้ำแต่ร้าน-วันซ้ำ / ไฟล์เดิมที่ถูกปฏิเสธ** — ไม่ดึงไฟล์อายุ < 5 นาที; ไฟล์ที่มีแถว import แล้วไม่ถูกดึงซ้ำ (Task 3 ขั้น filter + Task 7 ข้อ 5–6)
4. **ไฟล์หนึ่งในห้าพัง (binary/format ผิด/อ่านไม่ได้กลางทาง)** — อีกสี่ไฟล์ต้องนำเข้าครบ รอบจบ `completed` พร้อม `files_failed`/`files_rejected` ถูกต้อง (Task 3 `importOneFile` + Task 7 ข้อ 6)
5. **ต่อไม่ได้ (host ผิด, ไม่มีใครฟัง, รหัสผิด, ถอดรหัสไม่ได้เพราะไม่มี `SECRET_ENCRYPTION_KEY`)** — ครบ 4 ครั้งเว้น 60 วิ แล้ว `connect_failed`/`failed` + แจ้งเตือนครั้งเดียวต่อวัน, error_message ไม่มีรหัสผ่าน (Task 2 `openSftpSession` + Task 3 + Task 7 ข้อ 3, 7)

ทุกข้อพิสูจน์ด้วยการตรวจมือใน Task 7 (ไม่มี test อัตโนมัติตามความต้องการของ user)

---

### Task 1: BE — ตาราง `tb_pos_sftp_pull_run` + migration

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (ต่อท้ายบล็อก POS ~ln 8240)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261022140000_pos_sftp_pull/migration.sql`

**Interfaces:**
- Produces: `enum enum_pos_sftp_pull_status { running completed connect_failed host_key_mismatch failed abandoned }`
- Produces: `model tb_pos_sftp_pull_run` — `id Uuid @default(gen_random_uuid())`, `brand enum_pos_brand`, `run_date Date`, `status enum_pos_sftp_pull_status`, `started_at Timestamptz @default(now())`, `finished_at Timestamptz?`, `attempt_count Int @default(0)`, `host VarChar?`, `port Int?`, `host_key_sha256 VarChar?`, `files_found/files_imported/files_rejected/files_failed/files_skipped Int @default(0)`, `error_message String?`, `file_results Json @default("[]")`, `is_alert_sent Boolean @default(false)` + audit fields แบบ `tb_pos_sale_import` · `@@index([brand, run_date])`, `@@index([brand, started_at])`
- `file_results` แต่ละตัว: `{ file_name: string; outcome: 'imported' | 'rejected' | 'failed' | 'too_large'; import_id?: string; status?: enum_pos_sale_import_status; error?: string }`

- [ ] **Step 1:** เพิ่ม enum + model (คอมเมนต์ไทยว่าเป็นทั้ง log และตัวกัน "วันนี้ดึงแล้ว")
- [ ] **Step 2:** สร้าง migration แบบแผน A Task 1 Step 2 (`--create-only` + rename เป็น `20261022140000_pos_sftp_pull`, `IF NOT EXISTS`) แล้วเติม partial unique ที่ Prisma ประกาศไม่ได้ + คอมเมนต์ไทย:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "pos_sftp_pull_run_running_u"
    ON "tb_pos_sftp_pull_run" ("brand") WHERE "status" = 'running';
  ```
- [ ] **Step 3:** `bun run db:generate && bun run build:package` แล้ว `bun run check-types` — Expected: ผ่าน
- [ ] **Step 4: Commit** — `git commit -m "feat(pos-sale): ตารางบันทึกรอบดึงไฟล์ Simphony ทาง SFTP"`

### Task 2: BE — ชิ้นส่วน SFTP (อ่านค่าตั้ง, เวลาถึงรอบ, pattern, session + retry)

**Files:**
- Modify: `apps/micro-business/package.json` — dependencies `ssh2-sftp-client` (เวอร์ชันล่าสุดที่ออกมาแล้ว ≥ 2 สัปดาห์), devDependencies `@types/ssh2-sftp-client`; `bun install` · **ไม่เพิ่ม `ssh2`/`cpu-features` ใน `trustedDependencies`** (ไม่มี native build ก็ใช้ JS ล้วนได้)
- Create (ทั้งหมดใต้ `apps/micro-business/src/inventory/pos-sale/sftp/`, ไม่มี Nest DI): `sftp-pull-settings.ts`, `simphony-sftp-config.ts`, `read-simphony-sftp-config.ts`, `is-pull-due.ts`, `matches-file-pattern.ts`, `sftp-session.ts`, `open-sftp-session.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SFTP_PULL_SETTINGS = { connectTimeoutMs: 30_000, retryCount: 3, retryDelayMs: 60_000,
    lookbackDays: 7, settleMs: 5 * 60_000, maxFilesPerRun: 50, maxFileBytes: 10 * 1024 * 1024,
    staleRunMs: 30 * 60_000 } as const;           // type SftpPullSettings = typeof SFTP_PULL_SETTINGS (widened เป็น number)
  interface SimphonySftpConfig { host: string; port: number; username: string; password: string;
    remote_folder_path: string; file_pattern: string; schedule_time: string; config_updated_at: Date }
  export function readSimphonySftpConfig(prisma: PrismaClient): Promise<
    | { kind: 'disabled' } | { kind: 'not_configured' }
    | { kind: 'secret_unreadable'; schedule_time: string }
    | { kind: 'ok'; config: SimphonySftpConfig }>
  export function isPullDue(now: Date, scheduleTime: string, timezone: string): { run_date: string; is_due: boolean }
  export function matchesFilePattern(fileName: string, pattern: string): boolean
  interface RemoteFile { name: string; size: number; modified_at: Date }
  interface SftpSession { list(folder: string): Promise<RemoteFile[]>; read(folder: string, name: string): Promise<Buffer>; close(): Promise<void> }
  export function openSftpSession(config: SimphonySftpConfig, pinnedHostKey: string | null,
    settings: SftpPullSettings, onAttemptFailed?: (attempt: number, message: string) => void): Promise<
    | { is_ok: true; session: SftpSession; attempts: number; host_key_sha256: string }
    | { is_ok: false; reason: 'connect_failed' | 'host_key_mismatch'; attempts: number; error_message: string; host_key_sha256: string | null }>
  ```

- [ ] **Step 1: `readSimphonySftpConfig`** — อ่านแถว `interface_pos_simphony` (`deleted_at: null`, select `value, updated_at`) ตามรูป `fetchCarmenGlRows` (`master/carmen-gl-interface/carmen-gl-interface.ts:60-100`); ไม่มีแถว / `enabled !== true` → `disabled`; host, username, password, remote_folder_path, file_pattern ใดว่าง หรือ port/schedule_time ผิดรูป → `not_configured`; `decryptSecret` (ใช้ `isEncrypted` ก่อน — ค่าเก่าที่ยังไม่เข้ารหัสใช้ตรง ๆ) throw → `secret_unreadable` **ทิ้ง error object ห้าม log**
- [ ] **Step 2: `isPullDue`** — `run_date` = `businessDay(now, timezone)` (`common/business-timezone.ts`); เวลาท้องถิ่น `HH:mm` จาก `Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })`; `is_due = localHHmm >= scheduleTime` (เทียบสตริง zero-pad)
- [ ] **Step 3: `matchesFilePattern`** — escape อักขระ regex ทุกตัว แล้วแทน `*`→`.*`, `?`→`.`, anchor `^…$`, flag `i`; pattern ที่มี `/` ไม่ match อะไรเลย (pattern เป็นชื่อไฟล์ ไม่ใช่ path)
- [ ] **Step 4: `openSftpSession`** — วน `1 + retryCount` ครั้ง: `new Client().connect({ host, port, username, password, readyTimeout: connectTimeoutMs, hostVerifier })`; `hostVerifier(key: Buffer)` คำนวณ `sha256` base64 เก็บไว้ ถ้า `pinnedHostKey` ไม่ null และไม่ตรง → คืน false (ssh2 ตัดก่อนส่งรหัส) แล้ว **หยุดเลยไม่ retry** คืน `host_key_mismatch`; ล้มแบบอื่น → `onAttemptFailed` แล้ว `await sleep(retryDelayMs)` (ไม่รอหลังครั้งสุดท้าย); `error_message` = `err.message` ตัด 500 ตัว และ `.replaceAll(config.password, '***')` กันไว้อีกชั้น; `list` คืนเฉพาะ `type === '-'` แปลง `modifyTime` (ms) เป็น `Date`; `read` ใช้ `path.posix.join(folder, name)` + `client.get()` → `Buffer`; `close` = `client.end()` กลืน error
- [ ] **Step 5: ทดลองกับ SFTP container ทิ้งได้ (ไม่มี DB)** — `mkdir -p <scratchpad>/sftp/export && cp ../interface/POS/symphony/20260918/*.txt <scratchpad>/sftp/export/` แล้ว `docker run -d --rm --name pos-sftp -p 2222:22 -v <scratchpad>/sftp/export:/home/pos/export atmoz/sftp pos:pospass:1001`; เขียนสคริปต์ชั่วคราวใน scratchpad (ไม่ commit) เรียก `openSftpSession({host:'127.0.0.1',port:2222,username:'pos',password:'pospass',remote_folder_path:'/export',file_pattern:'*.txt',...}, null, {...SFTP_PULL_SETTINGS, retryDelayMs: 2000})` → `list('/export')` → `matchesFilePattern` → `read` แล้วพิมพ์ชื่อ/ขนาด/`host_key_sha256` (รันด้วย `bunx ts-node -r tsconfig-paths/register` ใน `apps/micro-business` ตามแผน A Task 4) — Expected: เห็นสองไฟล์, ขนาดตรง `ls -l`; รันซ้ำด้วย pin ผิด → `host_key_mismatch attempts: 1`; รหัสผิด → `connect_failed attempts: 4` ใช้เวลา ~6 วิ (delay 2 วิ); พิมพ์ `isPullDue(new Date(), '03:00', 'Asia/Bangkok')` เทียบนาฬิกา
- [ ] **Step 6:** check-types + eslint scoped — Expected: ผ่าน
- [ ] **Step 7: Commit** — `git commit -m "feat(pos-sale): ตัวเชื่อม SFTP ของ Simphony พร้อม retry และตรวจ host key"`

### Task 3: BE — `PosSaleSftpPullService` (จองรอบ → ดึงเบื้องหลัง → นำเข้า → แจ้งเตือน)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale-sftp-pull.service.ts`
- Create: `apps/micro-business/src/inventory/pos-sale/interface/pos-sale-sftp-pull.interface.ts`
- Modify: `pos-sale.controller.ts`, `pos-sale.module.ts` (provider ใหม่); regenerate rpc-contract

**Interfaces:**
- Consumes: Task 1 model; Task 2 ทั้งหมด; `PosSaleImportService.importSimphony({ file_base64, file_name, ingest_method })` (แผน A); `getBusinessTimezone()`; `RpcClient` + `Notifications.create` (`NotifyInput` ของ `@repo/notification-contract`)
- Produces:
  ```ts
  type SftpPullDueOutcome = 'disabled' | 'not_configured' | 'not_due' | 'already_pulled' | 'running' | 'started' | 'failed';
  interface SftpPullDueResult { outcome: SftpPullDueOutcome; run_id: string | null; run_date: string; schedule_time: string | null; timezone: string }
  interface SftpPullRunView { id; run_date: string; status: enum_pos_sftp_pull_status; started_at; finished_at; attempt_count;
    host_key_sha256: string | null; files_found; files_imported; files_rejected; files_failed; files_skipped; error_message: string | null }
  class PosSaleSftpPullService extends TenantScopedService {
    pullDue(input: { now?: string }): Promise<Result<SftpPullDueResult>>   // @TryCatch, ตอบภายในไม่กี่วินาทีเสมอ
    findLatestRun(): Promise<Result<SftpPullRunView | null>>              // @TryCatch, brand simphony ล่าสุดตาม started_at
  }
  ```
- RPC cmds: `pos-sale.sftp-pull-due` (payload: `bu_code`, `user_id`, `data: { now? }`), `pos-sale.find-latest-sftp-pull`

- [ ] **Step 1: `pullDue`** ตามลำดับ (แต่ละข้อเป็น private method เพื่อไม่เกิน 20 statements): `now = input.now ? new Date(input.now) : new Date()`, `timezone = getBusinessTimezone()` → `readSimphonySftpConfig` (`disabled`/`not_configured` คืนเลย ไม่สร้างแถว) → `isPullDue` ไม่ถึง → `not_due` → มีรอบ `completed` ของ `run_date` → `already_pulled` → ปิดรอบ `running` ที่ `started_at < now − staleRunMs` เป็น `abandoned` → `secret_unreadable` → สร้างรอบ `failed` พร้อม `error_message: 'SFTP password cannot be decrypted — check SECRET_ENCRYPTION_KEY'` + `alertOnce` → `failed` → **claim**: `create` รอบ `running` (`run_date`, host, port, `created_by_id: this.userId`) จับ `P2002` → `running` → หา pin (`findFirst` รอบ `completed` host+port เดียวกัน `host_key_sha256 != null` และ `started_at > config.config_updated_at` ล่าสุด) → `void this.runPull(run.id, config, pin, now).catch((e) => this.logger.error(...))` → `started`
  - คอมเมนต์ไทยที่ `void`: ทำไมไม่ await (RPC 30 วิ < retry ~5 นาที) และทำไม context ยังอยู่ (AsyncLocalStorage ของ `TenantContextRunner` ตามไปกับ promise)
- [ ] **Step 2: `runPull(runId, config, pin, now)`** (private) — `openSftpSession(config, pin, SFTP_PULL_SETTINGS, (n, msg) => this.logger.warn(...))`; ล้ม → `finishRun(runId, { status: reason, attempt_count, host_key_sha256, error_message })` + `alertOnce`; ต่อได้ → `try { list → selectCandidates → importOneFile ทีละไฟล์ } finally { session.close() }` → `finishRun(..., 'completed', counts, file_results)`; ถ้า `files_failed > 0` → `alertOnce`; list ล้ม/exception อื่นใด → `finishRun(..., 'failed')` + `alertOnce` — **ทุกทางต้องจบด้วย `finishRun`** (try/catch ครอบทั้งก้อน) ไม่งั้นรอบค้าง `running` 30 นาที
- [ ] **Step 3: `selectCandidates(files, config, now)`** (private) — กรอง `matchesFilePattern`, `modified_at ≥ now − lookbackDays` และ `≤ now − settleMs` → เรียง `modified_at` แล้ว `name` → query ชื่อที่เคยนำเข้า (`tb_pos_sale_import.findMany({ where: { brand: simphony, ingest_method: sftp, file_name: { in } }, select: { file_name } })`) ตัดออกนับเป็น `files_skipped` → ตัดที่ `maxFilesPerRun`; `files_found` = จำนวนที่ตรง pattern ในช่วงเวลา
- [ ] **Step 4: `importOneFile(session, folder, file)`** (private, คืน `file_results` หนึ่งตัว ไม่ throw) — `size > maxFileBytes` → `too_large` (ไม่โหลด); `read` → `importSimphony({ file_base64: buf.toString('base64'), file_name: file.name, ingest_method: enum_pos_ingest_method.sftp })`; `Result` ok + `status === success` → `imported` (+`import_id`), ok + สถานะอื่น → `rejected` (+`status`), Result error / exception → `failed` (+`error` ตัด 300 ตัว) — ไฟล์ `failed`/`too_large` ไม่มีแถว import จึงถูกลองใหม่รอบวันถัดไป (ถ้ายังอยู่ในช่วง 7 วัน)
- [ ] **Step 5: `alertOnce(runId, runDate, message)`** (private) — ถ้ามีรอบใน `run_date` เดียวกันที่ `is_alert_sent = true` แล้ว → ข้าม; ไม่งั้น `this.rpc.send(Notifications.create, { doc_type: 'system', event: 'info', title: 'Simphony SFTP pull failed / ดึงไฟล์ Simphony ไม่สำเร็จ', message, audience: { kind: 'users', user_ids: [this.userId] }, bu_code: this.bu_code, metadata: { pos_sftp_pull_run_id: runId } })` แล้วตั้ง `is_alert_sent = true`; ส่งไม่สำเร็จ = log warn ไม่ทำรอบล้ม · message บอกสถานะ + error_message + (กรณี `host_key_mismatch`) "ยืนยัน key กับผู้ดูแล SFTP แล้วกด Save ค่าตั้ง Simphony อีกครั้ง"
- [ ] **Step 6: handler** — `@MessagePattern` สองตัวตามรูป `importSimphony` handler (`ctx.run(payload, ...)`, `handleResult` 200) → `bun run gen:rpc-contract` → แทนด้วย `PosSale.sftpPullDue.pattern` / `PosSale.findLatestSftpPull.pattern` → `bun run audit:tcp-drift`
- [ ] **Step 7:** check-types + eslint scoped — Expected: ผ่าน
- [ ] **Step 8: Commit** — `git commit -m "feat(pos-sale): ดึงไฟล์ Simphony จาก SFTP ตามรอบเวลาของ BU แล้วนำเข้าแบบรอยืนยัน"`

### Task 4: BE — gateway: endpoint ภายในของ cron + endpoint สถานะรอบล่าสุด

**Files:**
- Create: `apps/backend-gateway/src/application/pos-sales/pos-sales-internal.controller.ts`
- Create: `apps/backend-gateway/src/common/dto/pos-sale/pos-sale-sftp-pull-internal.dto.ts`
- Modify: `pos-sales.module.ts` (controllers), `pos-sales.service.ts`, `pos-sales.controller.ts`, `swagger/response.ts`
- Regenerate: app-api catalog + platform seed `seed.application-api.data.ts` (แผน A Task 5 Step 6)

**Interfaces:**
- Consumes: Task 3 RPC cmds; `InternalJobGuard`; `assertBrandEntitled` (private เดิมใน `pos-sales.service.ts:39`)
- Produces:
  - `POST /api/internal/pos/simphony/pull` — `@ApiExcludeController()`, `@Controller('api/internal/pos')`, `@UseGuards(InternalJobGuard)`, `@HttpCode(200)`, body `PosSaleSftpPullInternalSchema = { bu_code: z.string().min(1), user_id: z.uuid({ version: 'v4' }), now: z.string().datetime().optional() }` (ลอก `gl-jv-run-due-internal.dto.ts`) → response `data: SftpPullDueResult` หรือ `{ outcome: 'unlicensed', run_id: null, ... }` · **ไม่มี AppIdGuard / ไม่มี api_name** (แบบ GL internal)
  - `PosSalesService.sftpPullDue(user_id: string, bu_code: string, now?: string): Promise<Result<unknown>>` — `assertBrandEntitled(bu_code, enum_pos_brand.simphony)` ไม่ผ่าน → `Result.ok({ outcome: 'unlicensed', run_id: null, run_date: '', schedule_time: null, timezone: '' })` ไม่ RPC; ผ่าน → `rpc.call(PosSale.sftpPullDue, { user_id, bu_code, version: 'latest', data: { now } })`
  - `GET /api/:bu_code/pos-sales/sftp-pulls/latest` — `new AppIdGuard('posSale.findLatestSftpPull')`, สิทธิ์/permission ชุดเดียวกับ `GET imports`, response `SftpPullRunView | null`, operationId `posSales_findLatestSftpPull`

- [ ] **Step 1:** controller ภายใน + DTO (JSDoc อธิบายแบบ `GlJvInternalController`: ทำไม guard นี้, actor มาจาก body, `now` ใช้เฉพาะตรวจรับ → `logger.warn` เมื่อมี `now`)
- [ ] **Step 2:** route `sftp-pulls/latest` + service + swagger response
- [ ] **Step 3:** `bun run scripts/generate-app-api-catalog/run.ts && bun run audit:app-api-catalog-drift` + เติม `posSale.findLatestSftpPull` ใน seed + `check.application-api-drift.ts` + `check.endpoint-permission-coverage.ts` — Expected: ผ่าน; route ภายในไม่โผล่ใน catalog (ถ้าโผล่ ดูว่า GL internal ถูกยกเว้นด้วยอะไรแล้วทำแบบเดียวกัน)
- [ ] **Step 4:** check-types ทั้งสองแอป + eslint scoped
- [ ] **Step 5: Commit** — `git commit -m "feat(pos-sale): endpoint ภายในให้ cron สั่งดึง SFTP และ endpoint สถานะรอบล่าสุด"`

### Task 5: micro-cronjobs — executor `pos_simphony_pull`

**Files (รีโป `../micro-cronjobs`):**
- Create: `internal/executor/pos_simphony_pull.go`
- Modify: `internal/model/cronjob.go` (ต่อจาก `GlRunDueJobConfig`), `internal/executor/executor.go` (field + `New` + `case`), `README.md` (ตาราง Job config by type)

**Interfaces:**
- Consumes: Task 4 `POST /api/internal/pos/simphony/pull`
- Produces: `type PosSimphonyPullJobConfig struct { BuCodes []string \`json:"bu_codes"\`; UserID string \`json:"user_id"\` }` · `type PosSimphonyPullExecutor struct` + `func NewPosSimphonyPullExecutor(baseURL, token string, httpClient *http.Client, logger *zap.Logger) *PosSimphonyPullExecutor` + `Execute(ctx, job model.CronJob) error` · job_type `"pos_simphony_pull"`

- [ ] **Step 1:** `git -C ../micro-cronjobs fetch && git -C ../micro-cronjobs checkout -b feature/pos-sale-interface origin/main`
- [ ] **Step 2:** executor ลอกโครง `gl_run_due.go` ทั้งตัว (ตรวจ baseURL/token/bu_codes/user_id, วน BU ทีละตัว, BU หนึ่งล้มไม่หยุดตัวอื่น, `errors.Join`) ต่างกันที่: path `/api/internal/pos/simphony/pull`, per-BU `httpClient.Timeout = 60 * time.Second` (BE ตอบหลัง claim ไม่รอ SFTP — คอมเมนต์อธิบาย), response `{ data: { outcome, run_id, run_date } }` → `logger.Info("pos simphony pull", cronjob_id, bu_code, outcome, run_id, run_date)`; `outcome == "failed"` นับเป็นความล้มเหลวของ BU นั้น (ให้ `lastError` ของ job เห็น) ส่วน outcome อื่นรวม `unlicensed` เป็นปกติ
- [ ] **Step 3:** ต่อสายใน `executor.go` + model + README แถวใหม่: config `{ bu_codes, user_id }`, cron แนะนำ `0 * * * *`, `max_retries: 0` (retry อยู่ที่ BE), `timeout_seconds ≥ len(bu_codes) × 60`, BE เป็นคนตัดสินเวลา/ซ้ำ ยิงทุกชั่วโมงได้ปลอดภัย
- [ ] **Step 4:** `go build ./... && go vet ./... && go test ./...` — Expected: ผ่าน (test เดิม)
- [ ] **Step 5: Commit** — `git commit -m "feat(pos): executor ดึงไฟล์ Simphony ทาง SFTP รายชั่วโมงต่อ BU"`

### Task 6: FE — สถานะรอบดึงล่าสุด + เอาข้อความ "รุ่นถัดไป" ออก

**Files:**
- Modify: `constant/api-endpoints.ts` (`POS_SALE_SFTP_PULL_LATEST: (buCode) => \`/api/proxy/api/${buCode}/pos-sales/sftp-pulls/latest\``), `constant/query-keys.ts` (`POS_SALE_SFTP_PULL_LATEST`), `routes/system-admin/interface/pos/pos-sale-types.ts` (`PosSftpPullRun` = `SftpPullRunView` ของ Task 3), `routes/system-admin/interface/pos/use-pos-sale.ts` (`usePosSftpLatestPull(enabled: boolean)`)
- Create: `routes/system-admin/interface/pos/pos-sftp-last-pull.tsx` (`PosSftpLastPull`)
- Modify: `routes/system-admin/interface/pos/pos-simphony-form.tsx` (วางใต้ `SettingSection` "pull" ~ln 150), `messages/en.json` + `messages/th.json`

- [ ] **Step 1:** แก้ `simphony.sftpDesc` / `simphony.pullDesc` ทั้งสองภาษาให้บอกว่าดึงอัตโนมัติวันละครั้งเมื่อถึงเวลาตามเขตเวลาของ BU (ตรวจทุกชั่วโมง) ไฟล์ที่ดึงมารอ Cost Controller ยืนยันเสมอ และนำเข้าเองยังทำได้ — ไม่มีคำว่า "รุ่นถัดไป"; เพิ่มคีย์ `simphony.lastPull.{title, never, status.{running,completed,connect_failed,host_key_mismatch,failed,abandoned}, summary, hostKey, hostKeyHint}` (`summary` ใช้ ICU param `{imported}` `{rejected}` `{failed}` `{skipped}` เท่านั้น, ห้าม `<คำ>`)
- [ ] **Step 2:** `PosSftpLastPull` — query เปิดเมื่อฟอร์มโหลดแล้วและ `enabled`; null → `never`; มีค่า → เวลาเริ่ม (formatter วันเวลาของแอป) · สถานะ (`completed` `text-success-ink`, `running`/`abandoned` `text-muted-foreground`, ที่เหลือ `text-destructive`) · `summary` · `error_message` เมื่อไม่ใช่ completed · `host_key_mismatch` แสดง `host_key_sha256` + `hostKeyHint` (กด Save อีกครั้ง = เชื่อ key ใหม่); ไม่มีปุ่ม (ไม่เพิ่มปุ่มหลัก); 403/404 → ซ่อนทั้งก้อน (BE ยังไม่ deploy)
- [ ] **Step 3:** `bun run typecheck && bunx eslint <ไฟล์ที่แตะ> && bun test:run lib/__tests__ messages` (i18n parity/ICU เดิม) — Expected: ผ่าน
- [ ] **Step 4: Commit** — `git commit -m "feat(pos): แสดงสถานะรอบดึงไฟล์ Simphony ล่าสุดในหน้าตั้งค่า"`

### Task 7: ตรวจมือครบวงจร (local เท่านั้น)

ต้องมี: SFTP container จาก Task 2 Step 5, micro-business + gateway local ที่ชี้ **tenant DB ทิ้งได้** ซึ่งลง migration ของแผน A + Task 1 แล้ว (ไม่มี = หยุดถาม user — ห้ามใช้ `:4000`/dev DB), gateway ตั้ง `INTERNAL_JOB_API_ENABLED=true` + `INTERNAL_JOB_TOKEN=<ค่าทดสอบ>` · ยิง `curl -s -X POST localhost:<gw>/api/internal/pos/simphony/pull -H 'x-internal-token: <ค่าทดสอบ>' -H 'content-type: application/json' -d '{"bu_code":"<bu>","user_id":"<uuid>","now":"<ISO>"}'` แล้วตาม `GET .../sftp-pulls/latest`

- [ ] **Step 1:** ไม่ส่ง token / token ผิด → 403 ข้อความเดียวกัน
- [ ] **Step 2:** Simphony `enabled: true` แต่ SFTP ว่าง → `not_configured`, ไม่มีแถวรอบ, ไม่มี notification (Review Focus #1); `enabled: false` → `disabled`
- [ ] **Step 3:** ตั้ง SFTP ชี้ container (`127.0.0.1:2222`, `/export`, `*.txt`, `03:00`) — `now` = 02:59 เวลาไทย → `not_due`; 03:00 → `started` แล้วรอบเป็น `completed`, `files_imported: 2`, ประวัติการนำเข้ามีสองแถว `ingest_method: sftp` สถานะ "รอยืนยัน" **ไม่มี Stock Out เกิด**; ยิงซ้ำ → `already_pulled`
- [ ] **Step 4:** ยิงสองคำสั่งพร้อมกัน (`&`) ด้วย `now` ของวันใหม่ → `started` หนึ่ง `running` หนึ่ง; `UPDATE` รอบ `running` ให้ `started_at` ถอย 31 นาที (DB ทิ้งได้เท่านั้น) แล้วยิง → รอบเก่าเป็น `abandoned` รอบใหม่ `started` (Review Focus #2)
- [ ] **Step 5:** วันใหม่: `touch` ไฟล์ใหม่ใน container (อายุ < 5 นาที) → ไม่ถูกดึง; ไฟล์เดิมทั้งสอง → `files_skipped: 2`; ก๊อปไฟล์เดิมเป็นชื่อใหม่ (`touch -d '-10 min'`) → `rejected` (`rejected_duplicate`) (Review Focus #3)
- [ ] **Step 6:** วางไฟล์ binary + ไฟล์ไม่มี GLID + ไฟล์ดีที่เปลี่ยน store/date (อายุ > 5 นาที) → รอบ `completed`, ไฟล์ดี `imported`, ไม่มี GLID `rejected`, binary `failed` (`POS_SALE_UNSUPPORTED_FILE`) + notification หนึ่งอัน (Review Focus #4)
- [ ] **Step 7:** `docker stop pos-sftp` → `started` แล้ว ~5 นาทีต่อมารอบเป็น `connect_failed`, `attempt_count: 4`, notification ถึง user หนึ่งอัน; ยิงอีกรอบ (วันเดียวกัน) → ล้มอีกแต่ **ไม่มี notification ที่สอง**; ตั้งรหัสผิด → `connect_failed` error_message ไม่มีรหัส; รัน micro-business โดยไม่ตั้ง `SECRET_ENCRYPTION_KEY` ที่ถอดค่าเดิมได้ → outcome `failed` (Review Focus #5)
- [ ] **Step 8:** สตาร์ท container ใหม่ (host key ใหม่) → `host_key_mismatch` + แสดง fingerprint ในหน้า Simphony; กด Save ค่าตั้ง → รอบถัดไป `completed`
- [ ] **Step 9:** micro-cronjobs local (`GATEWAY_URL`, `INTERNAL_JOB_TOKEN` ตรงกัน) สร้าง job `pos_simphony_pull` ผ่าน `POST /api/cronjobs` แล้ว `POST /api/cronjobs/:id/execute` → log `pos simphony pull` ต่อ BU พร้อม outcome; bu_code ที่ไม่มีจริงใน list → BU นั้นล้ม ตัวอื่นยังรัน
- [ ] **Step 10:** หน้า Simphony ใน FE (light + dark) แสดงสถานะรอบล่าสุดถูกตามข้างบน · รายงานผลแต่ละข้อ (ผ่าน/ไม่ผ่าน + response จริง) ให้ user; `docker rm -f pos-sftp`

## ลำดับ deploy (ต่อจากแผน A/B)

> **บล็อก deploy (อ่านก่อน — ลำดับนี้ห้ามสลับ)**
> 1. **migration ทุก BU** — tenant migration ของแผน A (`20261022130000_pos_sale`), C และ D (`20261022140000_pos_sftp_pull` รวมคอลัมน์ `presented_host_key_sha256`) รันครบทุก BU ก่อน BE ขึ้น
> 2. **BE deploy** พร้อม env:
>    - micro-business: `SECRET_ENCRYPTION_KEY` (ไม่มี = รอบ `failed` รหัส `secret_unreadable` ทุกชั่วโมง และ Save ค่าตั้งที่มีรหัสผ่าน 400) · `POS_SFTP_DENY_CIDRS` = วง VPC/Docker ของแพลตฟอร์ม คั่นด้วยจุลภาค (อ่านตอนบูต — **เปลี่ยนค่าต้อง restart** micro-business) · egress ไป port SFTP ของลูกค้าได้
>    - gateway: `INTERNAL_JOB_API_ENABLED=true` + `INTERNAL_JOB_TOKEN` (ค่าเดียวกับที่ micro-cronjobs ใช้)
> 3. **allowlist application-api ก่อน FE** — `posSale.findLatestSftpPull` และ `posSale.*` ตัวอื่นทั้งหมด ให้ทุกแอปที่ไม่ใช่ `allow_all` — FE ขึ้นก่อน = gateway ตอบ 401 แล้วผู้ใช้โดน logout ตอนเปิดหน้า Simphony
> 4. **สร้าง cron job ผ่าน API** (`POST /api/cronjobs` ของ micro-cronjobs) — `cron_expression: "0 * * * *"`, `max_retries: 0`, `timeout_seconds` = จำนวน BU × 60, `job_config.user_id` ต้องเป็น **สมาชิกของทุก BU ใน `bu_codes`** (BU ที่ไม่ได้เป็นสมาชิกล้มทุกชั่วโมง)
> 5. **FE**
>
> รอบถึงกำหนดนับเฉพาะ **ชั่วโมง**: ชั่วโมงท้องถิ่นของ BU ≥ ชั่วโมงของ `schedule_time` (ตั้ง 08:30 = ดึงตอน cron 08:00)

รายละเอียดเดิม:
1. tenant migration `20261022140000_pos_sftp_pull` ทุก BU (คำสั่งเดียวกับ migration ของแผน A — ไปพร้อมกันได้)
2. BE 3 แอปพร้อมกัน — gateway ต้องมี `INTERNAL_JOB_API_ENABLED=true` + `INTERNAL_JOB_TOKEN` (ชุดเดียวกับ GL), micro-business ต้องมี `SECRET_ENCRYPTION_KEY` และออก network ไป SFTP ของลูกค้าได้ (port ที่ลูกค้าเปิด — ตรวจ firewall egress ของ VM)
3. platform seed application-api (`posSale.findLatestSftpPull`) + allow ให้แอปที่ไม่ใช่ `allow_all` — ไม่งั้นผู้ใช้โดน logout ตอนเปิดหน้า Simphony
4. micro-cronjobs (merge `feature/pos-sale-interface` → `main` → `prod` ตาม flow ของรีโป) แล้วสร้าง job: `{"name":"POS Simphony SFTP pull","job_type":"pos_simphony_pull","cron_expression":"0 * * * *","is_active":true,"max_retries":0,"timeout_seconds":<len×60>,"job_config":{"bu_codes":[...],"user_id":"<ผู้ใช้ที่จะรับแจ้งเตือนและเป็นผู้นำเข้า>"}}`
5. FE (Task 6)
