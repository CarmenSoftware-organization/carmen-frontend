/**
 * สร้าง `docs/dashboard-widgets.md` — แคตตาล็อก dataset ของ dashboard + widget สำเร็จรูป
 * (dashboard templates ของ platform) จาก backend ที่ deploy อยู่จริง
 *
 * ความรู้ชุดนี้กระจายอยู่ 3 รีโป: dataset/params/supported_renders นิยามใน micro-data,
 * template อยู่ใน DB ของ platform (แก้ผ่าน carmen-platform ไม่มี commit), ชื่อไทยกับ
 * renderer อยู่ที่นี่ — เขียนมือจะค้างทันทีที่ใครเพิ่ม dataset จึงสร้างจากระบบเท่านั้น
 * ผลลัพธ์คือ **ภาพถ่าย** ของ env ที่เลือก ณ เวลาที่รัน (หัวไฟล์บอกทั้งสองอย่าง)
 *
 * ต้องใช้บัญชี platform ที่มีสิทธิ์ `dashboard_template.read` — บัญชี zebra ของ business
 * ได้ 403 (god mode ไม่ครอบ platform)
 *
 * ## วิธีใช้
 *     WIDGET_DOC_EMAIL=… WIDGET_DOC_PASSWORD=… bun run docs:widgets
 *     WIDGET_DOC_EMAIL=… WIDGET_DOC_PASSWORD=… bun run docs:widgets --env uat
 *
 * ค่าเริ่มต้นคือ `public/config.prod.json` ยิง GET อย่างเดียว (นอกจาก login) และถ้าขั้นไหน
 * พังหรือ catalog ว่าง จะ exit 1 โดยไม่แตะไฟล์ปลายทาง — เอกสารครึ่งเดียวที่ดูเหมือนจริง
 * แย่กว่าเอกสารเก่า
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { availableRenders } from "../components/dashboard-widget/render-support";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DOC = resolve(ROOT, "docs/dashboard-widgets.md");
const TH = resolve(ROOT, "messages/th.json");

/** ลำดับเมนูของ module dashboard — สำเนาของ `DASHBOARD_MODULES` ใน backend-gateway */
const MODULE_ORDER = [
  "procurement",
  "inventory",
  "product",
  "config",
  "vendor-management",
  "operation-plan",
  "store-operation",
];

/**
 * dataset ทดลองของ dashboard-lab — backend ส่งมาใน catalog เดียวกัน แต่ไม่ใช่ของที่
 * support จะตั้งให้ลูกค้า จึงไม่ลงเอกสาร
 */
const LAB_PREFIX = "lab.";

// ── types ───────────────────────────────────────────────────────────────────
interface CatalogParam {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string | number;
  options?: string[];
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  shape: string;
  category: string;
  unit?: string;
  params?: CatalogParam[] | null;
  supported_renders?: string[] | null;
}

export interface Template {
  kind: "system" | "bu_default";
  module: string | null;
  dataset_id: string;
  widget_type: string;
  title: string | null;
  title_i18n?: { en: string; th?: string } | null;
  order_index: number;
  params?: Record<string, string | number> | null;
  display?: Record<string, unknown> | null;
  allow_business_unit?: unknown;
  deny_business_unit?: unknown;
  is_active?: boolean;
}

export interface DocInput {
  backendUrl: string;
  generatedAt: string;
  catalog: CatalogItem[];
  system: Template[];
  buDefault: Template[];
  thNames: Record<string, string>;
}

// ── render ──────────────────────────────────────────────────────────────────
/** ข้อความลงเซลล์ตาราง markdown — `|` กับขึ้นบรรทัดใหม่ทำตารางแตก */
function cell(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function code(v: string): string {
  return "`" + v.replace(/`/g, "'") + "`";
}

/** anchor ของ dataset — GitHub ตัดจุดทิ้งจาก heading จึงตั้ง id เองให้ลิงก์ไม่เพี้ยน */
function anchor(id: string): string {
  return "ds-" + id.replace(/[^a-z0-9-]/gi, "-");
}

function groupOf(id: string): string {
  const i = id.indexOf(".");
  return i > 0 ? id.slice(0, i) : "อื่น ๆ";
}

function buList(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return cell(v);
}

function templateTitle(t: Template, byId: Map<string, CatalogItem>): string {
  return (
    t.title_i18n?.th ??
    t.title_i18n?.en ??
    t.title ??
    byId.get(t.dataset_id)?.name ??
    t.dataset_id
  );
}

function renderParams(params: CatalogParam[]): string[] {
  if (!params.length) return ["- **ตัวแปร:** ไม่มี"];
  const out = [
    "- **ตัวแปร:**",
    "",
    "  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |",
    "  | --- | --- | --- | --- | --- | --- |",
  ];
  for (const p of params) {
    out.push(
      `  | ${code(p.name)} | ${cell(p.label)} | ${cell(p.type)} | ${
        p.options?.length ? p.options.map(code).join(" ") : "อิสระ"
      } | ${cell(p.default)} | ${p.required ? "ใช่" : "—"} |`,
    );
  }
  return out;
}

function renderDataset(
  d: CatalogItem,
  thNames: Record<string, string>,
): string[] {
  const th = thNames[d.id];
  const backend = d.supported_renders ?? [];
  const fe = availableRenders(d.shape, backend);
  const warns: string[] = [];
  if (!fe.length) warns.push("⚠️ วาดไม่ได้ใน FE");
  if (!th) warns.push("⚠️ ไม่มีชื่อไทย");
  return [
    `<a id="${anchor(d.id)}"></a>`,
    "",
    `#### ${code(d.id)} — ${d.name}${warns.length ? " " + warns.join(" ") : ""}`,
    "",
    `- **ชื่อไทย:** ${th ?? "—"}`,
    `- **คำอธิบาย:** ${d.description || "—"}`,
    `- **shape:** ${code(d.shape)} · **หน่วย:** ${d.unit || "—"} · **หมวด:** ${d.category}`,
    `- **backend รองรับ:** ${backend.length ? backend.map(code).join(" ") : "—"}`,
    `- **FE วาดได้จริง:** ${fe.length ? fe.map(code).join(" ") : "—"}`,
    ...renderParams(d.params ?? []),
    "",
  ];
}

function renderTemplates(
  rows: Template[],
  byId: Map<string, CatalogItem>,
): string[] {
  const out = [
    "| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const t of rows) {
    const d = byId.get(t.dataset_id);
    const warns: string[] = [];
    if (!d) warns.push("⚠️ ไม่มี dataset นี้ใน catalog");
    else if (
      !availableRenders(d.shape, d.supported_renders ?? []).includes(
        t.widget_type as never,
      )
    )
      warns.push(`⚠️ FE วาด ${t.widget_type} กับ shape นี้ไม่ได้`);
    const ds = d
      ? `[${code(t.dataset_id)}](#${anchor(t.dataset_id)})`
      : code(t.dataset_id);
    out.push(
      `| ${t.order_index} | ${cell(templateTitle(t, byId))} | ${ds}${
        warns.length ? " " + warns.join(" ") : ""
      } | ${code(t.widget_type)} | ${cell(t.params)} | ${cell(t.display)} | ${buList(
        t.allow_business_unit,
      )} | ${buList(t.deny_business_unit)} | ${t.is_active === false ? "ปิด" : "เปิด"} |`,
    );
  }
  out.push("");
  return out;
}

const RENDER_TABLE = [
  "| widget_type | shape ที่ FE วาดได้ |",
  "| --- | --- |",
  "| `kpi` | `scalar` `scalar_delta` |",
  "| `gauge` | `scalar` `scalar_delta` |",
  "| `pie` | `categorical` `ranked` |",
  "| `bar` | `categorical` `ranked` `time_series` |",
  "| `line` | `time_series` |",
  "| `area` | `time_series` |",
  "| `table` | `table` `categorical` `ranked` |",
  "",
  "ยังไม่มีการ์ด: `sparkline` `heatmap` · shape `matrix` ยังไม่มี widget ไหนวาดได้",
  "(ที่มา: `RENDERERS` ใน `components/dashboard-widget/render-support.ts`)",
];

const SHAPE_TABLE = [
  "| shape | ข้อมูลที่ได้ |",
  "| --- | --- |",
  "| `scalar` | `{ value }` |",
  "| `scalar_delta` | `{ value, prev, change? }` — prev = ค่าเมื่อ ≥7 วันก่อน |",
  "| `time_series` | `[{ date, value }]` |",
  "| `categorical` | `[{ label, value, color? }]` |",
  "| `ranked` | `[{ rank, label, value, extras? }]` |",
  "| `matrix` | `{ rows, cols, values[][] }` |",
  "| `table` | `{ columns: [{ key, label, type? }], rows }` — คอลัมน์ type `id` ใช้ทำลิงก์ ไม่แสดง |",
  "",
  "(ที่มา: `types/dashboard-widget.ts`)",
];

const DISPLAY_TABLE = [
  "| key | ความหมาย |",
  "| --- | --- |",
  "| `width` | ความกว้างเป็นคอลัมน์ของกริด 12 คอลัมน์ (3=¼ · 4=⅓ · 6=½ · 8=⅔ · 9=¾ · 12=เต็มแถว) ไม่ใส่ = ตามชนิดกราฟ |",
  "| `height` | ความสูงเป็นจำนวนแถว (1 แถว = 4rem) เนื้อหาที่ล้นจะเลื่อนในกล่อง |",
  "| `decimals` | ทศนิยมของตัวเลขบนการ์ด |",
  "| `min` | ต้นสเกลของ gauge (default 0) |",
  "| `max` | ปลายสเกลของ gauge — ไม่ใส่ = เดาจากค่าปัจจุบัน |",
  "| `thresholds` | `[{ value, color }]` เปลี่ยนสีเมื่อค่าถึงขีด เรียงน้อยไปมาก (UI แก้ได้ตัวแรกตัวเดียว) |",
  "",
  "`display` เป็น schema ของ FE — backend เก็บเป็น object ทึบ (≤ 8KB) ไม่ตีความ (ที่มา: `WidgetDisplay` ใน `types/dashboard-widget.ts`)",
];

function moduleRank(m: string): number {
  const i = MODULE_ORDER.indexOf(m);
  return i === -1 ? MODULE_ORDER.length : i;
}

export function renderDoc(input: DocInput): string {
  const all = [...input.catalog].sort((a, b) => a.id.localeCompare(b.id));
  // template ยังอ้าง dataset lab ได้ จึงเก็บไว้ใน byId — แค่ไม่ลงแคตตาล็อก
  const byId = new Map(all.map((d) => [d.id, d]));
  const catalog = all.filter((d) => !d.id.startsWith(LAB_PREFIX));

  const groups = new Map<string, CatalogItem[]>();
  for (const d of catalog) {
    const g = groupOf(d.id);
    groups.set(g, [...(groups.get(g) ?? []), d]);
  }

  const byModule = new Map<string, Template[]>();
  for (const t of input.system) {
    const m = t.module ?? "main";
    byModule.set(m, [...(byModule.get(m) ?? []), t]);
  }
  const modules = [...byModule.keys()].sort(
    (a, b) => moduleRank(a) - moduleRank(b) || a.localeCompare(b),
  );
  const byOrder = (a: Template, b: Template) =>
    a.order_index - b.order_index || a.dataset_id.localeCompare(b.dataset_id);

  const out: string[] = [
    "# Dashboard widgets",
    "",
    "> ไฟล์นี้ **สร้างอัตโนมัติ ห้ามแก้มือ** — `bun run docs:widgets` (ดู `scripts/gen-widget-docs.ts`)",
    ">",
    `> ภาพถ่ายจาก \`${input.backendUrl}\` เมื่อ ${input.generatedAt}`,
    "> ส่วนที่ 2 เป็นข้อมูลใน DB ของ platform — แก้ผ่าน carmen-platform ได้โดยไม่มี commit และแต่ละ env/BU อาจต่างจากนี้",
    "",
    `dataset ${catalog.length} ตัว · system widget ${input.system.length} ตัว · bu_default ${input.buDefault.length} ตัว`,
    "",
    "## สารบัญ",
    "",
    "1. [แคตตาล็อก dataset](#1-แคตตาล็อก-dataset)",
    ...[...groups.keys()].map(
      (g) => `   - [${g}](#${anchor("group-" + g)}) (${groups.get(g)!.length})`,
    ),
    "2. [widget สำเร็จรูป](#2-widget-สำเร็จรูป)",
    "3. [ภาคผนวก](#3-ภาคผนวก)",
    "",
    "## 1. แคตตาล็อก dataset",
    "",
    "ตัวแปรที่แสดงคือตัวที่ผู้ใช้ตั้งได้เท่านั้น ตัวที่ระบบเติมเอง (เช่น user ปัจจุบัน) ไม่อยู่ในรายการ",
    "",
    "ไม่รวม dataset ทดลอง (`lab.*`)",
    "",
  ];

  for (const [g, items] of groups) {
    out.push(`<a id="${anchor("group-" + g)}"></a>`, "", `### ${g}`, "");
    for (const d of items) out.push(...renderDataset(d, input.thNames));
  }

  out.push(
    "## 2. widget สำเร็จรูป",
    "",
    "### หน้า dashboard ของแต่ละ module (`system`)",
    "",
  );
  if (!modules.length) out.push("_ไม่มี_", "");
  for (const m of modules) {
    out.push(
      `#### ${m}`,
      "",
      ...renderTemplates(byModule.get(m)!.sort(byOrder), byId),
    );
  }
  out.push(
    "### ชุดตั้งต้นของหน้า dashboard หลัก (`bu_default`)",
    "",
    "ชุดที่ platform deploy ลง BU — หลัง deploy แล้ว BU แก้ของตัวเองต่อได้",
    "",
    ...(input.buDefault.length
      ? renderTemplates([...input.buDefault].sort(byOrder), byId)
      : ["_ไม่มี_", ""]),
  );

  out.push(
    "## 3. ภาคผนวก",
    "",
    "### widget_type ↔ shape",
    "",
    ...RENDER_TABLE,
    "",
    "### รูปข้อมูลต่อ shape",
    "",
    ...SHAPE_TABLE,
    "",
    "### display keys",
    "",
    ...DISPLAY_TABLE,
    "",
  );
  return out.join("\n");
}

// ── fetch ───────────────────────────────────────────────────────────────────
function fail(msg: string): never {
  console.error(`gen-widget-docs: ${msg} — ไม่ได้เขียน ${DOC}`);
  process.exit(1);
}

/** envelope มีทั้ง `data.items` และ `data` เป็น array */
function asItems<T>(json: unknown, label: string): T[] {
  const data = (json as { data?: unknown })?.data;
  const items = Array.isArray(data)
    ? data
    : (data as { items?: unknown } | undefined)?.items;
  if (!Array.isArray(items)) fail(`${label}: response ไม่มีรายการ`);
  return items as T[];
}

/** แบนคีย์ `dashboard.datasets` ของ th.json → `dataset_id → ชื่อไทย` */
function loadThNames(): Record<string, string> {
  const th = JSON.parse(readFileSync(TH, "utf8")) as {
    dashboard?: { datasets?: Record<string, unknown> };
  };
  const out: Record<string, string> = {};
  const walk = (o: unknown, prefix: string) => {
    if (typeof o === "string") out[prefix] = o;
    else if (o && typeof o === "object")
      for (const [k, v] of Object.entries(o))
        walk(v, prefix ? `${prefix}.${k}` : k);
  };
  walk(th.dashboard?.datasets, "");
  return out;
}

async function main() {
  const envIdx = process.argv.indexOf("--env");
  const env = envIdx > -1 ? process.argv[envIdx + 1] : "prod";
  const config = JSON.parse(
    readFileSync(resolve(ROOT, `public/config.${env}.json`), "utf8"),
  ) as { BACKEND_URL: string; X_APP_ID: string };

  const email = process.env.WIDGET_DOC_EMAIL;
  const password = process.env.WIDGET_DOC_PASSWORD;
  if (!email || !password)
    fail("ต้องตั้ง WIDGET_DOC_EMAIL และ WIDGET_DOC_PASSWORD");

  const base = config.BACKEND_URL.replace(/\/$/, "");
  const appHeaders = {
    "Content-Type": "application/json",
    "x-app-id": config.X_APP_ID,
  };

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: appHeaders,
    body: JSON.stringify({ email, password }),
  }).catch(() => fail(`เชื่อมต่อ ${base} ไม่ได้`));
  const loginJson = (await loginRes.json().catch(() => ({}))) as {
    data?: { access_token?: string };
    message?: string;
  };
  const token = loginJson.data?.access_token;
  if (!loginRes.ok || !token)
    fail(`login ไม่ผ่าน (${loginRes.status} ${loginJson.message ?? ""})`);

  const getJson = async (path: string): Promise<unknown> => {
    const res = await fetch(`${base}${path}`, {
      headers: { ...appHeaders, Authorization: `Bearer ${token}` },
    }).catch(() => fail(`GET ${path}: เชื่อมต่อไม่ได้`));
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) fail(`GET ${path}: ${res.status} ${json.message ?? ""}`);
    return json;
  };

  const catalog = asItems<CatalogItem>(
    await getJson("/api-system/dashboard-templates/datasets"),
    "catalog",
  );
  if (!catalog.length) fail("catalog ว่าง");
  const system = asItems<Template>(
    await getJson("/api-system/dashboard-templates?kind=system"),
    "templates system",
  );
  const buDefault = asItems<Template>(
    await getJson("/api-system/dashboard-templates?kind=bu_default"),
    "templates bu_default",
  );

  writeFileSync(
    DOC,
    renderDoc({
      backendUrl: base,
      generatedAt: new Date().toISOString(),
      catalog,
      system,
      buDefault,
      thNames: loadThNames(),
    }),
  );
  console.log(
    `เขียน ${DOC} แล้ว — dataset ${catalog.length} · system ${system.length} · bu_default ${buDefault.length}`,
  );
}

// รันเมื่อถูกเรียกตรง ๆ เท่านั้น — import `renderDoc` ไปใช้ที่อื่นต้องไม่ยิง backend
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
