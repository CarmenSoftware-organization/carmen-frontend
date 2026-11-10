import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { youtubeEmbedUrl } from "@/lib/youtube";

/**
 * Guard ของ security headers — ค่าชุดเดียวกันถูกประกาศไว้ 4 ที่ ที่ไม่มีอะไรผูกกันเลย
 * เพราะแต่ละปลายทาง deploy คนละรูปแบบ (nginx conf · vercel.json · gcloud flag ·
 * CloudFront policy JSON)
 *
 * ตัวที่อันตรายที่สุดคือ `script-src` hash ของ inline script ใน index.html — วันที่มีคน
 * แก้สคริปต์นั้นแม้แต่ตัวอักษรเดียว hash จะไม่ตรง แล้ว **สคริปต์จะถูกบล็อกเงียบ ๆ ใน
 * production ทุกปลายทาง** (หน้าเว็บยังขึ้น แค่ font-scale ไม่ทำงาน) ไม่มี test ไหนจับได้
 * เพราะ dev server ไม่มี CSP เลย — test นี้อ่านไฟล์จริงจาก disk มาเทียบให้
 */
const ROOT = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const HOSTING_CONFIGS = [
  "docker/30-render-security-headers.sh",
  "vercel.json",
  "scripts/setup-gcs-cdn.sh",
  "scripts/cloudfront-security-headers.sh",
] as const;

/**
 * `<script ...>` ทุกตัวในเอกสาร — จับแบบไม่สนตัวพิมพ์และยอมให้มี attribute
 *
 * ของเดิมเป็น `/<script>(.*?)<\/script>/s` ซึ่งจับได้เฉพาะ tag ตัวเล็กล้วนที่ไม่มี
 * attribute เลย วันที่มีคนใส่ `type=` หรือ `nonce=` ให้สคริปต์นั้น regexp จะไม่เจอ
 * แล้วเทสต์นี้พังแบบ "no inline script" ทั้งที่ของยังอยู่ — หรือแย่กว่านั้นคือไปเจอ
 * สคริปต์ตัวอื่นแล้วคิด hash ผิดตัว (CodeQL js/bad-tag-filter #7)
 *
 * ฝั่งปิด tag ก็ต้องยอมให้มี attribute ด้วย — spec ถือว่า `</script foo>` ปิดจริง
 * (parser บ่นแต่ก็ปิดให้) รับแค่ `</script >` จะตัดเนื้อเลยจุดปิดจริงไป (#9)
 */
const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script(?:\s[^>]*)?>/gi;

function inlineScriptBodies(html: string): string[] {
  const bodies: string[] = [];
  for (const [, attrs, body] of html.matchAll(SCRIPT_TAG)) {
    if (/\bsrc\s*=/i.test(attrs)) continue;
    bodies.push(body);
  }
  return bodies;
}

/**
 * hash แบบที่ CSP ต้องการ: base64 ของ sha256 ของ "เนื้อใน" tag (ไม่รวมตัว tag เอง)
 * คืนมาทุกตัว ไม่ใช่ตัวแรก — เพิ่ม inline script ตัวที่สองแล้วไม่ใส่ hash ให้มัน
 * ผลคือสคริปต์นั้นถูกบล็อกเงียบ ๆ ใน production ซึ่งคือสิ่งที่ไฟล์นี้มีไว้กัน
 */
function cspHashesOfInlineScripts(html: string): string[] {
  const bodies = inlineScriptBodies(html);
  if (bodies.length === 0)
    throw new Error("index.html has no inline <script> block");
  return bodies.map(
    (body) => `sha256-${createHash("sha256").update(body).digest("base64")}`,
  );
}

describe("security headers", () => {
  const expectedHashes = cspHashesOfInlineScripts(read("index.html"));

  it.each(HOSTING_CONFIGS)(
    "%s มี script-src hash ครบทุก inline script ของ index.html",
    (file) => {
      const source = read(file);
      for (const hash of expectedHashes) {
        expect(source, `${file} ขาด ${hash}`).toContain(hash);
      }
    },
  );

  it("เก็บ inline script ครบทุกแบบที่ browser ยอมรับ", () => {
    // browser ไม่สน case และ attribute ไม่ได้ทำให้ tag เป็นคนละตัว — ตัวจับต้อง
    // เห็นเท่าที่ browser เห็น ไม่งั้น hash ที่คำนวณได้ไม่ตรงกับของที่รันจริง
    const html = [
      "<SCRIPT>upper()</SCRIPT>",
      '<script type="module">withAttr()</script>',
      '<script src="/main.tsx"></script>',
      "<script >spaced()</script >",
      // end tag ที่มี attribute — spec ถือว่าปิดจริง เบราว์เซอร์ก็ปิดให้
      "<script>attrEnd()</script foo>",
    ].join("\n");
    expect(inlineScriptBodies(html)).toEqual([
      "upper()",
      "withAttr()",
      "spaced()",
      "attrEnd()",
    ]);
  });

  // ชื่อ header ที่ห้ามหายไปจากปลายทางไหน — ค่าของแต่ละตัวต่างกันได้ตามปลายทาง
  // (เช่น connect-src ของ Docker เป็น same-origin แต่ของ CDN ต้องระบุ backend origin)
  // แต่ "มีหรือไม่มี" ต้องเหมือนกันหมด
  //
  // CloudFront ไม่ได้เขียนชื่อ header ตรง ๆ — policy JSON ใช้คีย์ของตัวเอง
  // (`ContentTypeOptions`, `FrameOptions`, …) จึงรับได้ทั้งสองสะกด
  it.each(HOSTING_CONFIGS)("%s ประกาศ header ครบทุกตัว", (file) => {
    const source = read(file);
    for (const header of [
      /Content-Security-Policy|ContentSecurityPolicy/,
      /X-Content-Type-Options|ContentTypeOptions/,
      /X-Frame-Options|FrameOptions/,
      /Referrer-Policy|ReferrerPolicy/,
      /Permissions-Policy/,
      /Strict-Transport-Security|StrictTransportSecurity/,
    ]) {
      expect(source).toMatch(header);
    }
  });

  it.each(HOSTING_CONFIGS)(
    "%s ให้ฝัง player ของ YouTube (nocookie) ได้ — วิดีโอบนหน้าสูตร",
    (file) => {
      // ต้องตรงกับโดเมนใน lib/youtube.ts youtubeEmbedUrl() ไม่งั้น iframe ว่างเฉพาะ production
      const frameSrc = /frame-src[^;"]*/.exec(read(file))?.[0] ?? "";
      expect(frameSrc, file).toContain(
        new URL(youtubeEmbedUrl("dQw4w9WgXcQ")).origin,
      );
    },
  );

  it("CSP ไม่มี 'unsafe-inline' ใน script-src", () => {
    // style-src ต้องมี 'unsafe-inline' (React ใส่ style attribute + chart.tsx inject
    // <style>) แต่ script-src ห้ามมีเด็ดขาด ไม่งั้น CSP แทบไม่เหลือประโยชน์กับ XSS
    // ซึ่งเป็นเหตุผลหลักที่ใส่มันเข้ามาตั้งแต่แรก (refresh token อยู่ใน localStorage)
    for (const file of HOSTING_CONFIGS) {
      const scriptSrc = /script-src[^;"]*/.exec(read(file))?.[0] ?? "";
      expect(scriptSrc, file).not.toContain("unsafe-inline");
    }
  });
});
