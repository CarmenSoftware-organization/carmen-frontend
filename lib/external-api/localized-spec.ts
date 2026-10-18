// สำเนาของ BE `docs/external-api/openapi.json` (carmen-turborepo-backend-v2) — อัปเดต: รัน
// `bun run swagger:export-external` ที่ BE แล้ว copy มาทับ จากนั้นรัน `bun run docs:i18n-check`
import openapi from "./openapi.json";
import thOverlay from "./openapi.th.json";

export type ExternalApiSpec = typeof openapi;

/** คำแปลหนึ่งข้อความ — `en` คือต้นฉบับ ณ ตอนแปล ใช้จับว่า BE เปลี่ยนข้อความแล้วหรือยัง */
export type SpecOverlay = Record<string, { en: string; th: string }>;

/**
 * ประโยคใน spec ที่ชวนกด Authorize แล้วลองยิง — เอกสารของเราไม่มี Try it จึงตัดทิ้งทุกภาษา
 * ถ้า BE เปลี่ยนถ้อยคำ = ไม่ตัด ไม่พัง
 */
const AUTHORIZE_HINT =
  "In this page, click **Authorize** and fill in both values to try the endpoint.";

/** server ของหน้า public — ไม่มี host จริงของ BU ใด ผู้อ่านพิมพ์ host ที่ได้จากผู้ดูแลเอง */
export const PUBLIC_SERVERS = [
  {
    url: "https://{host}",
    description: "Carmen",
    variables: { host: { default: "your-carmen-api-host" } },
  },
];

/**
 * spec ต้นฉบับภาษาอังกฤษที่ตัดประโยค Authorize แล้ว — ฐานของทุกฉบับ และเป็นต้นฉบับที่
 * overlay ภาษาไทยเทียบ `en` ด้วย
 *
 * @returns สำเนาใหม่ทุกครั้ง แก้ได้โดยไม่กระทบ JSON ที่ import มา
 */
export function baseSpec(): ExternalApiSpec {
  const spec = structuredClone(openapi);
  spec.info.description = spec.info.description.replace(AUTHORIZE_HINT, "");
  return spec;
}

const escapePointer = (key: string) =>
  key.replaceAll("~", "~0").replaceAll("/", "~1");

/**
 * ไล่หาข้อความที่ต้องแปลใน spec — ทุก `description` / `summary` ยกเว้นใต้ `servers`,
 * `example`, `enum` และค่า `value` ของ `examples` (ชื่อ field / enum / ตัวอย่างห้ามแปล)
 *
 * @param spec - spec ที่จะไล่ (ปกติคือ `baseSpec()`)
 * @returns JSON pointer (RFC 6901) → ข้อความ
 */
export function collectTranslatableStrings(
  spec: ExternalApiSpec,
): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: unknown, pointer: string) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${pointer}/${i}`));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      const child = `${pointer}/${escapePointer(key)}`;
      if (key === "example" || key === "enum" || key === "value") continue;
      if (pointer === "" && key === "servers") continue;
      if (
        (key === "description" || key === "summary") &&
        typeof value === "string"
      ) {
        out.set(child, value);
      } else {
        walk(value, child);
      }
    }
  };
  walk(spec, "");
  return out;
}

const unescapePointer = (part: string) =>
  part.replaceAll("~1", "/").replaceAll("~0", "~");

/** เขียนค่าที่ pointer (ต้องมีอยู่แล้ว) — คืน false ถ้า path ไม่มี */
function setAtPointer(root: unknown, pointer: string, value: string): boolean {
  const parts = pointer.split("/").slice(1).map(unescapePointer);
  const last = parts.pop();
  let node: unknown = root;
  for (const part of parts) {
    if (!node || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[part];
  }
  if (!node || typeof node !== "object" || last === undefined) return false;
  (node as Record<string, unknown>)[last] = value;
  return true;
}

/**
 * spec ฉบับพร้อมแสดงบนหน้า public — server เป็น placeholder และเมื่อ `th` ทับคำแปล
 * เฉพาะข้อความที่ต้นฉบับยังตรงกับ `en` ของคำแปล (BE แก้แล้วยังไม่แปลใหม่ → แสดงอังกฤษ
 * ไม่แสดงคำแปลเก่าที่อาจผิด) และ `th` ไม่ว่าง
 *
 * @param locale - locale ของแอป (`en` / `th`)
 * @param opts.overlay - คำแปล (default `openapi.th.json`)
 * @returns spec ใหม่
 */
export function localizedSpec(
  locale: string,
  opts?: { overlay?: SpecOverlay },
): ExternalApiSpec {
  const spec = baseSpec();
  (spec as { servers: unknown }).servers = structuredClone(PUBLIC_SERVERS);
  if (locale !== "th") return spec;
  const overlay = opts?.overlay ?? (thOverlay as SpecOverlay);
  const current = collectTranslatableStrings(spec);
  for (const [pointer, entry] of Object.entries(overlay)) {
    if (!entry.th || current.get(pointer) !== entry.en) continue;
    setAtPointer(spec, pointer, entry.th);
  }
  return spec;
}
