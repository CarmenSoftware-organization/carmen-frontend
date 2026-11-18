import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const DIR = "routes/system-admin";
// การ์ด หัวหน้า และตัวช่วยวาดเส้นย้ายไปเป็นของกลางแล้ว — ยังต้องอยู่ใต้กติกาสีเดียวเหมือนเดิม
const SHARED_DIR = "components/share/landing";

const SECOND_ACCENTS =
  /var\(--(positive|destructive|success|warning|info|chart-\d+)\)/;

const read = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.startsWith("landing-") && !f.includes(".test."))
    .map((f) => ({
      file: `${dir}/${f}`,
      src: readFileSync(join(dir, f), "utf-8"),
    }));

const landingFiles = [...read(DIR), ...read(SHARED_DIR)];

describe("the admin landing carries a single accent", () => {
  it("reads every landing file", () => {
    // guards the glob: an empty list would make the assertions below vacuous
    expect(landingFiles.length).toBeGreaterThan(4);
  });

  it("uses no accent other than --primary", () => {
    const offenders = landingFiles
      .filter(({ src }) => SECOND_ACCENTS.test(src))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("has no per-category colour map left", () => {
    // strip comments first — the files explain the old TONE_COLOR by name, and
    // that history is worth keeping; it's the code that must not resurrect it
    const offenders = landingFiles
      .filter(({ src }) =>
        /TONE_COLOR|\btint\b/.test(
          src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
        ),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
