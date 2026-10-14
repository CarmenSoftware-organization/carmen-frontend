# MCP tokens section (profile settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม section "MCP tokens" ในหน้า `profile/setting` ให้ผู้ใช้สร้าง/ดู/เพิกถอนโทเค็น MCP ของตัวเอง และหลังสร้างแสดงโทเค็นดิบ + snippet `.mcp.json` ครั้งเดียว

**Architecture:** feature-local ทั้งหมดใน `routes/profile/` (hook, dialog, panel, section) ตามกฎ "hook ที่ใช้ feature เดียวอยู่ใน route ของมัน" ของ `AGENTS.md`; เรียก backend ผ่าน `httpClient` + `useQuery`/`useMutation` แบบเดียวกับ `hooks/use-profile.ts`; error toast มาจาก `MutationCache` กลางอยู่แล้ว ไม่ toast ซ้ำ; โทเค็นดิบอยู่ใน state ของ dialog เท่านั้นและถูกล้างเมื่อปิด

**Tech Stack:** React 19 + react-router 7, `@tanstack/react-query` v5, react-hook-form + Zod 4, shadcn/radix (`Dialog`, `ConfirmDialog`, `Badge`, `Button`, `Field*`, `Input`), `use-intl`, `sonner`, Tailwind 4

**Spec:** `../carmen-turborepo-backend-v2/docs/superpowers/specs/2026-10-14-mcp-token-ui-design.md` §4 (repo backend, branch `docs/mcp-token-ui-spec`) — backend API อยู่บน `main` ของ backend แล้ว (PR #806)

## Global Constraints

- **ไม่เขียน unit test ใหม่** (preference ของเจ้าของ) — gate คือ `bun run typecheck`, `bunx eslint <ไฟล์>` และ `bun test:run lib/__tests__/i18n-key-parity.test.ts` (ถือเป็น lint ของ i18n ไม่ใช่ unit test) **ห้าม `bun run build`** (มันบวก version ใน package.json)
- commit บน branch `feature/mcp-tokens` เท่านั้น ไม่ push; **stage เฉพาะไฟล์ของ task** — checkout นี้มี `.claude/*`, `.mcp.json`, `package.json` ที่เจ้าของแก้ค้างไว้ ห้ามแตะ ห้าม `git add -A`
- commit message: conventional prefix + ข้อความไทย (เช่น `feat(profile): …`) ตามกฎ repo
- กฎ module boundary (ESLint): `routes/profile/` import จาก `components/`, `hooks/`, `lib/`, `constant/`, `types/` ได้; ห้าม import ข้าม `routes/<อื่น>/`; ห้ามสร้าง `index.ts` barrel
- ห้าม hardcode URL backend — ใช้ `getRuntimeConfig().BACKEND_URL` (`lib/runtime-config.ts:80`, ไม่มี trailing slash)
- โทเค็นดิบ: อยู่ใน state ของ dialog เท่านั้น ห้ามใส่ query cache / localStorage / sessionStorage / console / telemetry; ล้างเมื่อปิด dialog
- ข้อความ UI ทุกคำต้องมีทั้ง `messages/en.json` และ `messages/th.json` (parity test บังคับ) ใต้ `profile.mcpTokens`
- design system: ใช้ class/variant ที่มีอยู่ (Badge `success-light`/`warning-light`/`destructive-light`), ห้ามตั้ง font size นอก ladder (`type-ladder.test.ts` จับ), ข้อความสีสถานะใช้ `text-*-ink`
- วันที่: `formatDate(iso, dateTimeFormat)` จาก `lib/date-utils.ts:49` + `dateTimeFormat` จาก `useProfile()`

## การเปลี่ยนแปลงจาก spec (ยืนยันจากโค้ดตอนวางแผน)

1. hook อยู่ที่ `routes/profile/use-mcp-tokens.ts` ไม่ใช่ `hooks/` (กฎ `AGENTS.md:49-56`)
2. query key เป็น string ใน `QUERY_KEYS` (`MCP_TOKENS: "mcp-tokens"`) แล้ว wrap เป็น array ใน hook แบบ `profileQueryKey`
3. หน้า setting **ไม่มี BU section** — section ลายเซ็นคือตัวสุดท้าย (บรรทัด 461-522) mount section ใหม่หลังบรรทัด 522 ก่อน `<ChangePasswordDialog` (524)
4. ไม่ใช้ `SettingSection` (heading คนละสไตล์กับหน้า) — ลอก markup grid 2 คอลัมน์ของ section ลายเซ็นแทน
5. ใช้ `ConfirmDialog` (`components/ui/confirm-dialog.tsx`) ไม่ใช่ `DeleteDialog` เพราะต้องใช้คำว่า "เพิกถอน" (`DeleteDialog` hardcode ปุ่ม "ลบ")
6. ไม่มี `Form`/`FormField`/`Table` ของ shadcn ใน repo — ฟอร์มใช้ `Field`/`FieldLabel`/`FieldError` + `form.register`, ตารางเป็น `<table>` ธรรมดาตามแบบ `routes/config/dimension/dimension-page.tsx:610`
7. error toast: ไม่ใส่ `toast.error` ใน `onError` (MutationCache กลางทำให้) แต่ตั้ง `meta: { preferServerMessage: true }` บน mutation สร้าง/เพิกถอน เพื่อให้ 409 แสดงข้อความจาก API แทนข้อความ 409 ทั่วไป
8. ฟอร์มสร้างไม่มี `expires_at` (ตาม spec) และฟิลด์ `name` ใช้ `Input` + `form.register("name")`

## Review Focus

1. **ปิด dialog เปิดเผยโทเค็นแล้วเปิดใหม่ ต้องไม่เห็นโทเค็นเดิม** — Task 3: `handleOpenChange(false)` ล้าง `created` และ `form.reset()` ทุกเส้นทาง (ปุ่ม Done, overlay, Esc)
2. **แถว Revoked/Expired ต้องไม่มีปุ่มเพิกถอน และปุ่มเพิกถอนส่ง `doc_version` ของแถวนั้น** — Task 4 (`getMcpTokenStatus` + `revokeTarget` เก็บทั้ง id และ doc_version)
3. **409 ตอนสร้าง (ครบ 10 ใบ) ต้องปิดฟอร์ม + refetch และ toast ข้อความจาก API** — Task 1 `meta.preferServerMessage` + Task 3 `onError` ปิด dialog
4. **snippet ต้องใช้ `BACKEND_URL` จาก runtime config ไม่ใช่ `window.location`** — Task 3 `buildMcpConfigSnippet(getRuntimeConfig().BACKEND_URL, token)`
5. **parity en/th ต้องผ่าน** — Task 2 เพิ่มคีย์ชุดเดียวกันสองไฟล์ แล้วรัน parity test

---

### Task 1: types, endpoints, query key, hook

**Files:**
- Create: `types/mcp-token.ts`
- Modify: `constant/api-endpoints.ts` (ใกล้บรรทัด 374 `PROFILE`)
- Modify: `constant/query-keys.ts` (เรียงตามตัวอักษรใกล้ `MCP…`/`NOTIFICATION…`)
- Create: `routes/profile/use-mcp-tokens.ts`

**Interfaces:**
- Produces: `McpToken`, `McpTokenCreated`, `McpTokenStatus` (types); `API_ENDPOINTS.MCP_TOKENS`, `API_ENDPOINTS.MCP_TOKEN_REVOKE(id, docVersion)`; `QUERY_KEYS.MCP_TOKENS`; `mcpTokensQueryKey`; `getMcpTokenStatus(token, now?)`; hooks `useMcpTokens()`, `useCreateMcpToken()`, `useRevokeMcpToken()`

- [ ] **Step 1: types** — `types/mcp-token.ts`

```ts
/** แถวโทเค็น MCP ตามที่ GET /api/user/mcp-tokens คืน — ไม่มีโทเค็นดิบ */
export interface McpToken {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  doc_version: number;
}

/** response ของ POST — `token` ปรากฏที่นี่ครั้งเดียว */
export interface McpTokenCreated {
  id: string;
  name: string;
  token_prefix: string;
  token: string;
  expires_at: string;
  doc_version: number;
}

export type McpTokenStatus = "active" | "expired" | "revoked";
```

- [ ] **Step 2: endpoints + query key**

ใน `constant/api-endpoints.ts` ต่อจากบรรทัด `PROFILE_UPDATE: "/api/proxy/api/user/profile",`:

```ts
  MCP_TOKENS: "/api/proxy/api/user/mcp-tokens",
  MCP_TOKEN_REVOKE: (id: string, docVersion: number) =>
    `/api/proxy/api/user/mcp-tokens/${toSafePathSegment(id)}?doc_version=${docVersion}`,
```

ใน `constant/query-keys.ts` เพิ่มในตำแหน่งเรียงตามตัวอักษร:

```ts
  MCP_TOKENS: "mcp-tokens",
```

- [ ] **Step 3: hook** — `routes/profile/use-mcp-tokens.ts`

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type {
  McpToken,
  McpTokenCreated,
  McpTokenStatus,
} from "@/types/mcp-token";

export const mcpTokensQueryKey = [QUERY_KEYS.MCP_TOKENS] as const;

/** สถานะคำนวณฝั่ง client — revoked ชนะ expired */
export function getMcpTokenStatus(
  token: McpToken,
  now: number = Date.now(),
): McpTokenStatus {
  if (token.revoked_at) return "revoked";
  if (new Date(token.expires_at).getTime() <= now) return "expired";
  return "active";
}

export function useMcpTokens() {
  return useQuery<McpToken[]>({
    queryKey: mcpTokensQueryKey,
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.MCP_TOKENS);
      if (!res.ok) throw await ApiError.from(res, "Failed to load MCP tokens");
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

export function useCreateMcpToken() {
  const queryClient = useQueryClient();
  return useMutation<McpTokenCreated, ApiError, { name: string }>({
    mutationFn: async (body) => {
      const res = await httpClient.post(API_ENDPOINTS.MCP_TOKENS, body);
      if (!res.ok) throw await ApiError.from(res, "Failed to create MCP token");
      const json = await res.json();
      return json.data;
    },
    // 409 (ครบ 10 ใบ) ต้องขึ้นข้อความจาก API ไม่ใช่ข้อความ 409 ทั่วไปของ api-error-handler
    meta: { preferServerMessage: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpTokensQueryKey });
    },
  });
}

export function useRevokeMcpToken() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { id: string; doc_version: number }>({
    mutationFn: async ({ id, doc_version }) => {
      const res = await httpClient.delete(
        API_ENDPOINTS.MCP_TOKEN_REVOKE(id, doc_version),
      );
      if (!res.ok) throw await ApiError.from(res, "Failed to revoke MCP token");
      return res.json().catch(() => ({}));
    },
    meta: { preferServerMessage: true },
    // สำเร็จหรือ 409 (doc_version ชน / เพิกถอนไปแล้ว) ก็ต้องโหลดรายการใหม่ทั้งคู่
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpTokensQueryKey });
    },
  });
}
```

- [ ] **Step 4: ตรวจ**

```bash
cd /Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react
bun run typecheck && bunx eslint types/mcp-token.ts constant/api-endpoints.ts constant/query-keys.ts routes/profile/use-mcp-tokens.ts
```

Expected: ทั้งสองเขียว (ถ้า `meta` ไม่ตรง type `ApiErrorMeta` ให้ `import type { ApiErrorMeta } from "@/lib/api-error-handler"` แล้วเขียน `meta: { preferServerMessage: true } satisfies ApiErrorMeta`)

- [ ] **Step 5: Commit**

```bash
git checkout -b feature/mcp-tokens
git add types/mcp-token.ts constant/api-endpoints.ts constant/query-keys.ts routes/profile/use-mcp-tokens.ts
git commit -m "feat(profile): hook และ endpoint สำหรับโทเค็น MCP ของผู้ใช้"
```

---

### Task 2: i18n keys (en + th)

**Files:**
- Modify: `messages/en.json` (ใน object `profile` บรรทัด 4741-4840)
- Modify: `messages/th.json` (ตำแหน่งเดียวกัน)

**Interfaces:**
- Produces: namespace `profile.mcpTokens.*` เรียกด้วย `useTranslations("profile.mcpTokens")`

- [ ] **Step 1: เพิ่ม object `mcpTokens` ใน `profile` ของ `messages/en.json`** — วางก่อนคีย์สุดท้าย `"cancel": "Cancel"` (บรรทัด 4839) ใส่คอมมาให้ถูก

```json
    "mcpTokens": {
      "title": "MCP tokens",
      "description": "Long-lived tokens that let an AI assistant (e.g. Claude Code) read your Carmen data on your behalf. Each token expires after 90 days. You can hold up to 10 active tokens.",
      "create": "Create token",
      "creating": "Creating…",
      "empty": "No MCP tokens yet",
      "emptyHint": "Create one and paste the generated config into your assistant.",
      "name": "Name",
      "namePlaceholder": "e.g. Claude Code — work laptop",
      "nameTooLong": "Name must be at most 100 characters",
      "tokenPrefix": "Token",
      "createdAt": "Created",
      "expiresAt": "Expires",
      "lastUsedAt": "Last used",
      "never": "Never",
      "status": "Status",
      "statusActive": "Active",
      "statusExpired": "Expired",
      "statusRevoked": "Revoked",
      "revoke": "Revoke",
      "revokeTitle": "Revoke this token?",
      "revokeConfirm": "\"{name}\" will stop working immediately. This cannot be undone.",
      "revoked": "Token revoked",
      "created": "Token created",
      "revealTitle": "Your new token",
      "revealWarning": "This token is shown only once. Copy it now — after you close this window it cannot be displayed again.",
      "tokenLabel": "Token",
      "snippetTitle": "Claude Code config",
      "snippetHint": "Paste into .mcp.json in your project (or ~/.claude.json), then run: claude mcp list",
      "copy": "Copy",
      "copied": "Copied",
      "copyFailed": "Could not copy — select the text and copy it manually",
      "done": "I have saved the token"
    },
```

- [ ] **Step 2: ใส่คีย์ชุดเดียวกันใน `messages/th.json`**

```json
    "mcpTokens": {
      "title": "โทเค็น MCP",
      "description": "โทเค็นอายุยาวสำหรับให้ผู้ช่วย AI (เช่น Claude Code) อ่านข้อมูล Carmen แทนคุณ โทเค็นแต่ละใบหมดอายุใน 90 วัน และถือได้สูงสุด 10 ใบที่ยังใช้งานได้",
      "create": "สร้างโทเค็น",
      "creating": "กำลังสร้าง…",
      "empty": "ยังไม่มีโทเค็น MCP",
      "emptyHint": "สร้างโทเค็นแล้วนำ config ที่ได้ไปวางในผู้ช่วย AI ของคุณ",
      "name": "ชื่อ",
      "namePlaceholder": "เช่น Claude Code — เครื่องที่ทำงาน",
      "nameTooLong": "ชื่อต้องไม่เกิน 100 ตัวอักษร",
      "tokenPrefix": "โทเค็น",
      "createdAt": "สร้างเมื่อ",
      "expiresAt": "หมดอายุ",
      "lastUsedAt": "ใช้ล่าสุด",
      "never": "ยังไม่เคย",
      "status": "สถานะ",
      "statusActive": "ใช้งานได้",
      "statusExpired": "หมดอายุ",
      "statusRevoked": "เพิกถอนแล้ว",
      "revoke": "เพิกถอน",
      "revokeTitle": "เพิกถอนโทเค็นนี้?",
      "revokeConfirm": "\"{name}\" จะใช้ไม่ได้ทันที และย้อนกลับไม่ได้",
      "revoked": "เพิกถอนโทเค็นแล้ว",
      "created": "สร้างโทเค็นแล้ว",
      "revealTitle": "โทเค็นใหม่ของคุณ",
      "revealWarning": "โทเค็นนี้แสดงครั้งเดียว คัดลอกตอนนี้ — ปิดหน้าต่างแล้วจะดูซ้ำไม่ได้",
      "tokenLabel": "โทเค็น",
      "snippetTitle": "config สำหรับ Claude Code",
      "snippetHint": "วางใน .mcp.json ของโปรเจกต์ (หรือ ~/.claude.json) แล้วรัน: claude mcp list",
      "copy": "คัดลอก",
      "copied": "คัดลอกแล้ว",
      "copyFailed": "คัดลอกไม่ได้ — เลือกข้อความแล้วคัดลอกเอง",
      "done": "ฉันเก็บโทเค็นแล้ว"
    },
```

- [ ] **Step 3: ตรวจ parity + JSON**

```bash
bun test:run lib/__tests__/i18n-key-parity.test.ts
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));JSON.parse(require('fs').readFileSync('messages/th.json','utf8'));console.log('json ok')"
```

Expected: parity 2/2 pass, `json ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/th.json
git commit -m "feat(profile): ข้อความ en/th ของ section โทเค็น MCP"
```

---

### Task 3: create dialog + reveal panel + snippet builder

**Files:**
- Create: `routes/profile/mcp-config-snippet.ts`
- Create: `routes/profile/mcp-token-form-schema.ts`
- Create: `routes/profile/mcp-token-reveal-panel.tsx`
- Create: `routes/profile/mcp-token-create-dialog.tsx`

**Interfaces:**
- Consumes: `useCreateMcpToken()`, `McpTokenCreated` (Task 1); คีย์ `profile.mcpTokens.*` (Task 2)
- Produces: `<McpTokenCreateDialog open onOpenChange />`; `buildMcpConfigSnippet(backendUrl, token): string`

- [ ] **Step 1: snippet builder** — `routes/profile/mcp-config-snippet.ts`

```ts
/**
 * สร้าง JSON สำหรับวางใน .mcp.json ของ Claude Code — backendUrl มาจาก runtime config (ไม่มี trailing slash)
 */
export function buildMcpConfigSnippet(backendUrl: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        carmen: {
          type: "http",
          url: `${backendUrl}/mcp`,
          headers: { "x-mcp-token": token },
        },
      },
    },
    null,
    2,
  );
}
```

- [ ] **Step 2: schema** — `routes/profile/mcp-token-form-schema.ts`

```ts
import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";

export function createMcpTokenSchema(tv: TranslationFn, tm: TranslationFn) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, tv("required", { field: tm("name") }))
      .max(100, tm("nameTooLong")),
  });
}

export type McpTokenFormValues = z.infer<ReturnType<typeof createMcpTokenSchema>>;

export const EMPTY_MCP_TOKEN_FORM: McpTokenFormValues = { name: "" };
```

(`tv` = `useTranslations("validation")` ที่มี `required` พร้อม `{field}` ตามที่ `credit-term-form-schema.ts` ใช้; `tm` = `useTranslations("profile.mcpTokens")`)

- [ ] **Step 3: reveal panel** — `routes/profile/mcp-token-reveal-panel.tsx`

```tsx
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { McpTokenCreated } from "@/types/mcp-token";
import { buildMcpConfigSnippet } from "./mcp-config-snippet";

type CopyTarget = "token" | "snippet";

interface McpTokenRevealPanelProps {
  readonly created: McpTokenCreated;
  readonly onDone: () => void;
}

/** แสดงโทเค็นดิบ + snippet ครั้งเดียว — ค่าอยู่ใน props/state ของ dialog เท่านั้น */
export function McpTokenRevealPanel({ created, onDone }: McpTokenRevealPanelProps) {
  const t = useTranslations("profile.mcpTokens");
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const snippet = buildMcpConfigSnippet(getRuntimeConfig().BACKEND_URL, created.token);

  const copy = async (target: CopyTarget, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setTimeout(() => setCopied((c) => (c === target ? null : c)), 1500);
    } catch {
      // clipboard ถูกบล็อก (เช่น http ไม่ใช่ https) — ให้ผู้ใช้เลือกข้อความเอง
      toast.error(t("copyFailed"));
    }
  };

  const copyButton = (target: CopyTarget, text: string) => (
    <Button type="button" variant="outline" size="sm" onClick={() => void copy(target, text)}>
      {copied === target ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied === target ? t("copied") : t("copy")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-warning/10 text-warning-ink flex items-start gap-2 rounded-md border p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{t("revealWarning")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">{t("tokenLabel")}</span>
          {copyButton("token", created.token)}
        </div>
        <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 text-xs break-all whitespace-pre-wrap select-all">
          <code className="font-mono">{created.token}</code>
        </pre>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">{t("snippetTitle")}</span>
          {copyButton("snippet", snippet)}
        </div>
        <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 text-xs select-all">
          <code className="font-mono">{snippet}</code>
        </pre>
        <p className="text-muted-foreground text-xs">{t("snippetHint")}</p>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    </div>
  );
}
```

ถ้า class `bg-warning/10` / `text-warning-ink` ไม่มีใน design tokens ของ repo ให้ดู `components/ui/badge.tsx` variant `warning-light` แล้วใช้ token ชุดเดียวกับมัน (ห้ามตั้งสีใหม่ที่ call site) และ `text-xs` อยู่ใน type ladder (ตรวจด้วย `components/ui/type-ladder.test.ts` ถ้า lint ไม่จับ)

- [ ] **Step 4: create dialog** — `routes/profile/mcp-token-create-dialog.tsx`

```tsx
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { McpTokenCreated } from "@/types/mcp-token";
import { useCreateMcpToken } from "./use-mcp-tokens";
import {
  EMPTY_MCP_TOKEN_FORM,
  createMcpTokenSchema,
  type McpTokenFormValues,
} from "./mcp-token-form-schema";
import { McpTokenRevealPanel } from "./mcp-token-reveal-panel";

interface McpTokenCreateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** ฟอร์มสร้างโทเค็น → เมื่อสำเร็จสลับเป็นหน้าจอเปิดเผยโทเค็นครั้งเดียว */
export function McpTokenCreateDialog({ open, onOpenChange }: McpTokenCreateDialogProps) {
  const t = useTranslations("profile.mcpTokens");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const createToken = useCreateMcpToken();
  const [created, setCreated] = useState<McpTokenCreated | null>(null);

  const form = useForm<McpTokenFormValues>({
    resolver: zodResolver(createMcpTokenSchema(tv, t)) as Resolver<McpTokenFormValues>,
    defaultValues: EMPTY_MCP_TOKEN_FORM,
  });

  useEffect(() => {
    if (open) {
      form.reset(EMPTY_MCP_TOKEN_FORM);
      setCreated(null);
    }
  }, [open, form]);

  // ปิดทางไหนก็ตาม (Done, overlay, Esc) ต้องล้างโทเค็นดิบออกจาก state เสมอ
  const handleOpenChange = (next: boolean) => {
    if (createToken.isPending) return;
    if (!next) {
      setCreated(null);
      form.reset(EMPTY_MCP_TOKEN_FORM);
    }
    onOpenChange(next);
  };

  const onSubmit = (values: McpTokenFormValues) => {
    createToken.mutate(values, {
      onSuccess: (data) => {
        toast.success(t("created"));
        setCreated(data);
      },
      // 409 ครบ 10 ใบ: toast มาจาก MutationCache กลาง (preferServerMessage) — ปิดฟอร์มให้ผู้ใช้ไปเพิกถอนใบเก่า
      onError: (error) => {
        if (error.statusCode === 409) handleOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="border-border/60 bg-background gap-6 rounded-xl border p-6 shadow-md sm:max-w-[520px] sm:rounded-2xl"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col">
            <DialogTitle className="text-foreground font-semibold tracking-tight">
              {created ? t("revealTitle") : t("create")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
              {created ? created.name : t("description")}
            </DialogDescription>
          </div>

          {created ? (
            <McpTokenRevealPanel created={created} onDone={() => handleOpenChange(false)} />
          ) : (
            <form id="mcp-token-create-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FieldGroup className="gap-4">
                <Field data-invalid={!!form.formState.errors.name}>
                  <FieldLabel htmlFor="mcp_token_name" required className="text-foreground/80 mb-1.5 font-medium">
                    {t("name")}
                  </FieldLabel>
                  <Input
                    id="mcp_token_name"
                    placeholder={t("namePlaceholder")}
                    maxLength={100}
                    autoFocus
                    disabled={createToken.isPending}
                    aria-invalid={!!form.formState.errors.name}
                    {...form.register("name")}
                  />
                  <FieldError className="mt-1">{form.formState.errors.name?.message}</FieldError>
                </Field>
              </FieldGroup>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createToken.isPending}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" form="mcp-token-create-form" disabled={createToken.isPending}>
                  {createToken.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      {t("creating")}
                    </>
                  ) : (
                    t("create")
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

ถ้า `ApiError` ไม่มี `statusCode` ให้ดู `lib/api-error.ts:124-156` ว่าใช้ชื่อฟิลด์อะไร (รายงานสำรวจบอกว่า `ApiError.from` ตั้ง `statusCode = res.status`)

- [ ] **Step 5: ตรวจ**

```bash
bun run typecheck && bunx eslint routes/profile/mcp-config-snippet.ts routes/profile/mcp-token-form-schema.ts routes/profile/mcp-token-reveal-panel.tsx routes/profile/mcp-token-create-dialog.tsx
```

- [ ] **Step 6: Commit**

```bash
git add routes/profile/mcp-config-snippet.ts routes/profile/mcp-token-form-schema.ts routes/profile/mcp-token-reveal-panel.tsx routes/profile/mcp-token-create-dialog.tsx
git commit -m "feat(profile): dialog สร้างโทเค็น MCP พร้อมแสดงโทเค็นและ snippet ครั้งเดียว"
```

---

### Task 4: section + mount ในหน้า setting

**Files:**
- Create: `routes/profile/mcp-tokens-section.tsx`
- Modify: `routes/profile/user-profile-setting.tsx` (import + mount หลังบรรทัด 522)

**Interfaces:**
- Consumes: `useMcpTokens`, `useRevokeMcpToken`, `getMcpTokenStatus` (Task 1); `McpTokenCreateDialog` (Task 3); `useProfile().dateTimeFormat`; `formatDate` (`lib/date-utils.ts:49`); `ConfirmDialog`; `Badge`
- Produces: `<McpTokensSection />`

- [ ] **Step 1: section** — `routes/profile/mcp-tokens-section.tsx`

```tsx
import { useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Ban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { McpToken, McpTokenStatus } from "@/types/mcp-token";
import { McpTokenCreateDialog } from "./mcp-token-create-dialog";
import { getMcpTokenStatus, useMcpTokens, useRevokeMcpToken } from "./use-mcp-tokens";

const STATUS_VARIANT: Record<McpTokenStatus, "success-light" | "warning-light" | "destructive-light"> = {
  active: "success-light",
  expired: "warning-light",
  revoked: "destructive-light",
};

/** section "MCP tokens" ของหน้า profile/setting — markup ตาม section ลายเซ็นในหน้าเดียวกัน */
export function McpTokensSection() {
  const t = useTranslations("profile.mcpTokens");
  const { dateTimeFormat } = useProfile();
  const tokens = useMcpTokens();
  const revoke = useRevokeMcpToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpToken | null>(null);

  const rows = tokens.data ?? [];
  const statusLabel: Record<McpTokenStatus, string> = {
    active: t("statusActive"),
    expired: t("statusExpired"),
    revoked: t("statusRevoked"),
  };

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;
    revoke.mutate(
      { id: revokeTarget.id, doc_version: revokeTarget.doc_version },
      {
        onSuccess: () => {
          toast.success(t("revoked"));
          setRevokeTarget(null);
        },
        // 409: toast กลางขึ้นเอง และ onSettled ของ hook โหลดรายการใหม่ — ปิด dialog ให้ผู้ใช้เห็นสถานะจริง
        onError: () => setRevokeTarget(null),
      },
    );
  };

  const fmt = (iso: string | null) => (iso ? formatDate(iso, dateTimeFormat) : t("never"));

  return (
    <div className="grid grid-cols-1 items-start gap-6 border-t pt-8 md:grid-cols-[220px_1fr] lg:gap-8">
      <div className="pt-2">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{t("title")}</h2>
        <p className="text-muted-foreground mt-2 text-xs">{t("description")}</p>
      </div>
      <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-muted/10 flex items-center justify-end border-b px-4 py-3">
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t("create")}
          </Button>
        </div>
        {rows.length === 0 ? (
          <div className="text-muted-foreground px-4 py-8 text-center text-sm">
            <p className="font-medium">{t("empty")}</p>
            <p className="mt-1 text-xs">{t("emptyHint")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2 text-left">{t("name")}</th>
                  <th className="p-2 text-left">{t("tokenPrefix")}</th>
                  <th className="p-2 text-left">{t("createdAt")}</th>
                  <th className="p-2 text-left">{t("expiresAt")}</th>
                  <th className="p-2 text-left">{t("lastUsedAt")}</th>
                  <th className="p-2 text-left">{t("status")}</th>
                  <th className="p-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const status = getMcpTokenStatus(row);
                  const muted = status !== "active";
                  return (
                    <tr key={row.id} className={muted ? "text-muted-foreground" : undefined}>
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2 font-mono">{row.token_prefix}…</td>
                      <td className="p-2">{fmt(row.created_at)}</td>
                      <td className="p-2">{fmt(row.expires_at)}</td>
                      <td className="p-2">{fmt(row.last_used_at)}</td>
                      <td className="p-2">
                        <Badge variant={STATUS_VARIANT[status]} size="xs">{statusLabel[status]}</Badge>
                      </td>
                      <td className="p-2 text-right">
                        {status === "active" && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRevokeTarget(row)}>
                            <Ban className="size-3.5" aria-hidden="true" />
                            {t("revoke")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <McpTokenCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        title={t("revokeTitle")}
        description={revokeTarget ? t("revokeConfirm", { name: revokeTarget.name }) : ""}
        confirmText={t("revoke")}
        confirmIcon={<Ban className="size-3.5" aria-hidden="true" />}
        variant="destructive"
        isPending={revoke.isPending}
        onConfirm={handleConfirmRevoke}
      />
    </div>
  );
}
```

ถ้า `Badge` ไม่รับ `size="xs"` ตามที่สำรวจไว้ให้ตัด prop ออก; ชื่อ variant ให้ยึดตาม `components/ui/badge.tsx:11-48`

- [ ] **Step 2: mount** — ใน `routes/profile/user-profile-setting.tsx` เพิ่ม import ใกล้ import อื่นของ `./`:

```tsx
import { McpTokensSection } from "./mcp-tokens-section";
```

และแทรกระหว่างบรรทัด 522 (`</div>` ปิดบล็อกลายเซ็น) กับ 524 (`<ChangePasswordDialog`):

```tsx
        <McpTokensSection />

```

- [ ] **Step 3: ตรวจ**

```bash
bun run typecheck && bunx eslint routes/profile/mcp-tokens-section.tsx routes/profile/user-profile-setting.tsx
bun test:run components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts
```

Expected: เขียว (สองเทสต์หลังเป็น design-system lint ของ repo ไม่ใช่ unit test ของฟีเจอร์)

- [ ] **Step 4: Commit**

```bash
git add routes/profile/mcp-tokens-section.tsx routes/profile/user-profile-setting.tsx
git commit -m "feat(profile): section จัดการโทเค็น MCP ในหน้าตั้งค่าโปรไฟล์"
```

---

### Task 5: ด่านสุดท้าย + ทดสอบด้วยมือ

- [ ] **Step 1: gates ทั้ง repo**

```bash
bun run typecheck && bun run lint
bun test:run lib/__tests__/i18n-key-parity.test.ts components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts
git status --short   # ต้องเหลือเฉพาะไฟล์ของเจ้าของ (.claude/*, .mcp.json, package.json)
```

- [ ] **Step 2: ทดสอบด้วยมือกับ dev gateway (`bun run dev` ของ repo นี้ + backend dev ที่รันอยู่)**

1. เปิด `/profile/setting` → section "MCP tokens" อยู่ท้ายสุด ว่างเปล่าแสดง empty state
2. Create token → ชื่อ "rt-ui" → dialog สลับเป็นหน้าจอเปิดเผย: โทเค็นขึ้นต้น `mcp_`, snippet มี `url: <BACKEND_URL>/mcp` และ header ถูกต้อง, ปุ่ม Copy ทั้งสองทำงาน
3. กด Done → รายการมีแถวใหม่สถานะ Active; เปิด Create อีกครั้งต้องเห็นฟอร์มเปล่า ไม่ใช่โทเค็นเดิม
4. เอาโทเค็นที่ copy ยิง `POST <BACKEND_URL>/mcp` (`initialize`) → 200
5. Revoke แถว → ConfirmDialog ปุ่มสีแดงคำว่า "เพิกถอน" → แถวกลายเป็น Revoked จาง ไม่มีปุ่ม → ยิง `/mcp` ซ้ำ → 401
6. สร้างจนครบ 10 ใบ → ใบที่ 11: toast ข้อความ "Active MCP token limit reached…" และ dialog ปิด
7. สลับภาษาเป็นไทย → ทุกข้อความแปล

- [ ] **Step 3: Commit (ถ้ามีแก้จาก gate)**

```bash
git add <ไฟล์ที่แก้>
git commit -m "fix(profile): แก้ตาม gate ของ section โทเค็น MCP"
```
