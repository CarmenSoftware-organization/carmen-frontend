/**
 * สร้าง `constant/__fixtures__/license-catalog.ts` จาก catalog ของ backend
 *
 * เดิมไฟล์ fixture ถูก **คัดลอกด้วยมือ** จาก `license-catalog.generated.ts` ของ
 * `carmen-turborepo-backend` ผลคือมันค้างเงียบ ๆ: ตรวจครั้งล่าสุด 2026-08-30 พบว่า
 * fixture มี 74 คีย์ ขณะที่ backend มี 76 (ขาด `configuration.chart_of_accounts`
 * และ `configuration.location_shelf`)
 *
 * ทิศทางที่อันตรายกว่าคือคีย์ที่ backend **ลบหรือเปลี่ยนชื่อ** — fixture ยังถือคีย์เก่าไว้
 * เทสต์จึงเขียว ทั้งที่ `module-list.ts` ชี้ไป feature ที่ backend ไม่รู้จักแล้ว พอเปิด
 * `LICENSE_ENFORCEMENT` หน้านั้นถูกล็อกถาวร และ license ไม่มี admin bypass
 *
 * ## วิธีใช้
 *     bun run gen:license-fixture                        # หา backend จากพาธพี่น้องปกติ
 *     BACKEND_REPO=/path/to/backend-v2 bun run gen:license-fixture
 *
 * แล้ว `git diff` ดูว่าคีย์อะไรเปลี่ยน ถ้ามีคีย์หายไป (`-`) ให้ตรวจ `module-list.ts`
 * ว่ายังชี้ไปคีย์นั้นอยู่หรือเปล่า **ก่อน** commit
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../constant/__fixtures__/license-catalog.ts");
const REL = "apps/backend-gateway/src/license/license-catalog.generated.ts";

const candidates = [
  process.env.BACKEND_REPO,
  resolve(HERE, "../../carmen-turborepo-backend"),
].filter((p): p is string => Boolean(p));

const repo = candidates.find((p) => existsSync(join(p, REL)));
if (!repo) {
  console.error(
    `หา ${REL} ไม่เจอ ลองที่:\n${candidates.map((c) => `  - ${join(c, REL)}`).join("\n")}\n` +
      `ตั้ง BACKEND_REPO ให้ชี้ที่ checkout ของ carmen-turborepo-backend`,
  );
  process.exit(1);
}

const src = readFileSync(join(repo, REL), "utf8");

/**
 * ตัดอาร์เรย์ `LICENSE_FEATURES` ออกมาแล้ว `JSON.parse`
 *
 * ต้องหา `[` ที่อยู่**หลังเครื่องหมาย `=`** ไม่ใช่ `[` ตัวแรกหลังชื่อตัวแปร — ตัวแรกคือ
 * `[]` ของ type annotation (`readonly LicenseFeatureSeed[]`) ซึ่ง match แล้วได้อาร์เรย์ว่าง
 * และ diff จะบอกว่า "backend ไม่มีคีย์อะไรเลย" อย่างเงียบ ๆ
 */
function parseFeatures(text: string): { key: string; parent_key: string | null }[] {
  const m = /LICENSE_FEATURES\s*:[^=]*=\s*/.exec(text);
  if (!m) throw new Error("หา LICENSE_FEATURES ไม่เจอในไฟล์ generated");
  const start = text.indexOf("[", m.index + m[0].length - 1);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) {
      const rows = JSON.parse(text.slice(start, i + 1));
      if (!Array.isArray(rows) || rows.length === 0)
        throw new Error("parse ได้อาร์เรย์ว่าง — อย่าเขียนทับ fixture ด้วยของว่าง");
      return rows;
    }
  }
  throw new Error("อาร์เรย์ LICENSE_FEATURES ปิดวงเล็บไม่ครบ");
}

const features = parseFeatures(src);
const keys = features.map((f) => f.key).sort();
const modules = features.filter((f) => f.parent_key === null).map((f) => f.key).sort();
const list = (xs: string[]) => xs.map((k) => `  ${JSON.stringify(k)},`).join("\n");

writeFileSync(
  OUT,
  `/**
 * สำเนา feature key ทั้งหมดของ license catalog ฝั่ง backend — **ใช้ในเทสต์เท่านั้น**
 *
 * ไฟล์นี้ถูก **สร้างด้วยสคริปต์ ห้ามแก้ด้วยมือ** — \`bun run gen:license-fixture\`
 * (อ่านจาก \`${REL}\` ของ carmen-turborepo-backend ซึ่งเป็นไฟล์ generated จาก
 * \`prisma/permission.route-map.ts\` + \`prisma/seed.permission.data.ts\` อีกที)
 *
 * ## ทำไมต้องมีสำเนาในรีโปนี้
 * FE คำนวณ feature key ของแต่ละหน้าเองจาก \`constant/module-list.ts\`
 * (\`licenseFeature\` หรือ \`featureKeyOf(permission)\`) แต่ **namespace ของ permission
 * กับของ license feature ไม่ใช่ตัวเดียวกัน** — key ที่คำนวณผิดจะทำให้หน้านั้นถูกล็อกถาวร
 * ตอนเปิด \`LICENSE_ENFORCEMENT\` และ license **ไม่มี admin bypass** จึงไม่มีใครในระบบ
 * เข้าไปแก้ได้เลย \`constant/module-list.license-feature.test.ts\` ใช้ไฟล์นี้ยืนยันว่า
 * ทุก leaf ผลิต key ที่มีอยู่จริงใน catalog
 *
 * ## เมื่อ backend เพิ่ม/แก้ feature
 * รัน \`bun run gen:license-fixture\` แล้วดู \`git diff\` — **คีย์ที่หายไป (\`-\`) สำคัญกว่า
 * คีย์ที่เพิ่ม** เพราะแปลว่า backend ลบหรือเปลี่ยนชื่อ และถ้า \`module-list.ts\` ยังชี้ไปคีย์นั้น
 * หน้านั้นจะถูกล็อกถาวรตอนเปิด enforcement
 *
 * ห้ามแก้ไฟล์นี้เพื่อ "ทำให้เทสต์ผ่าน" — ถ้าเทสต์แดง แปลว่า \`module-list.ts\` ชี้ไป feature
 * ที่ backend ไม่รู้จัก ต้องแก้ที่ \`module-list.ts\`
 *
 * ขนาด catalog: ${keys.length} feature (${modules.length} module + ${keys.length - modules.length} resource)
 *
 * **ไม่มีวันที่ในไฟล์นี้โดยตั้งใจ** — เพื่อให้ \`bun run gen:license-fixture && git diff --exit-code\`
 * เป็นด่านตรวจความสดได้: diff ว่าง = fixture ตรงกับ backend ณ ตอนนั้นจริง
 */

/** feature key ทั้งหมดใน catalog (module + resource) */
export const LICENSE_FEATURE_KEYS: readonly string[] = [
${list(keys)}
];

/** เฉพาะ module-level key (entry ที่ \`parent_key: null\` ใน catalog) */
export const LICENSE_MODULE_KEYS: readonly string[] = [
${list(modules)}
];
`,
  "utf8",
);

console.log(`เขียน ${OUT}`);
console.log(`  ${keys.length} feature (${modules.length} module + ${keys.length - modules.length} resource)`);
console.log(`  ที่มา: ${join(repo, REL)}`);
