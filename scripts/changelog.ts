/**
 * สร้าง changelog ของแอปจาก git history
 *
 * ยกมาจาก carmen-turborepo-backend
 * (`apps/backend-gateway/scripts/generate-changelog.ts`) แล้วดัดแปลงให้เข้ากับ
 * รีโปนี้ — ดู `collectCommits()` สำหรับจุดที่ต่างกันจริง ๆ และสำคัญที่สุด
 *
 * ไฟล์นี้เป็น library ล้วน ไม่ทำอะไรตอน import — จุดเข้าใช้จาก command line
 * อยู่ที่ `scripts/changelog-cli.ts`
 *
 * type มาจาก `lib/changelog.ts` ที่เดียว (`import type` จึงถูก erase ทิ้ง ไม่ลาก
 * `changelog.json` เข้ามาในสคริปต์) — สำเนา interface สองชุดที่ต้อง sync กันเอง
 * คือปัญหาที่ `scripts/app-version.ts` ถูกแยกออกมาแก้อยู่แล้ว
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ChangeItem, Changelog, VersionEntry } from "../lib/changelog";

/** ตัวคั่นฟิลด์ใน --pretty — ASCII unit separator ไม่มีทางโผล่ในข้อความ commit */
const UNIT = "\x1f";

const ROOT = path.resolve(import.meta.dirname, "..");
const JSON_PATH = path.resolve(ROOT, "changelog.json");
const MD_PATH = path.resolve(ROOT, "CHANGELOG.md");

type Category = "added" | "fixed" | "changed";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", cwd: ROOT }).trim();
}

/** commit type → หมวดใน changelog · type อื่น (docs/chore/test/style/build) ถูกทิ้ง */
function categoryFor(type: string): Category | null {
  if (type === "feat") return "added";
  if (type === "fix") return "fixed";
  if (type === "perf" || type === "refactor") return "changed";
  return null;
}

interface RawCommit {
  hash: string;
  author: string;
  subject: string;
  pr: number | null;
}

function parsePrFromSubject(subject: string): number | null {
  const match = /\(#(\d+)\)/.exec(subject);
  return match ? Number(match[1]) : null;
}

function parseLines(raw: string): RawCommit[] {
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const [hash, author, subject] = line.split(UNIT);
    return { hash, author, subject, pr: parsePrFromSubject(subject) };
  });
}

/**
 * เก็บ commit ทั้งหมดในช่วงที่ระบุ (รับได้ทั้ง "a..b" และ "<ref>" = ทั้งประวัติถึง ref)
 *
 * **จุดที่ต่างจากต้นฉบับฝั่ง backend และห้ามลอกกลับ:** ที่นั่นเขียน
 * `if (merge.pr === null) continue;` เพราะทุก merge มาจาก GitHub PR แต่รีโปนี้
 * merge branch ในเครื่องด้วยข้อความ `merge: <ไทย>` อยู่ 33 จาก 108 merge
 * (ยืนยัน 2026-08-10) การข้ามไปจะทิ้ง commit ทั้งสาขาแบบเงียบ ๆ → เดินทุก merge
 * แล้วปล่อยให้ `pr` เป็น null เมื่อหาเลขไม่เจอ
 */
function collectCommits(range: string): RawCommit[] {
  const seen = new Set<string>();
  const commits: RawCommit[] = [];

  // 1) merge บนเส้น first-parent — หนึ่งตัวต่อหนึ่งสาขาที่ถูก merge เข้ามา
  const mergeRaw = git(
    "log",
    "--first-parent",
    "--merges",
    `--pretty=format:%h${UNIT}%s`,
    range,
  );
  const merges = mergeRaw
    ? mergeRaw.split("\n").map((line) => {
        const [hash, subject] = line.split(UNIT);
        const prMatch = /Merge pull request #(\d+)/.exec(subject);
        return { hash, pr: prMatch ? Number(prMatch[1]) : null };
      })
    : [];
  for (const merge of merges) {
    const introduced = parseLines(
      git(
        "log",
        "--no-merges",
        `--pretty=format:%h${UNIT}%an${UNIT}%s`,
        `${merge.hash}^1..${merge.hash}^2`,
      ),
    );
    for (const commit of introduced) {
      if (seen.has(commit.hash)) continue;
      seen.add(commit.hash);
      commits.push({ ...commit, pr: commit.pr ?? merge.pr });
    }
  }

  // 2) commit ที่ลงเส้น first-parent ตรง ๆ ไม่ผ่าน merge
  const directs = parseLines(
    git(
      "log",
      "--first-parent",
      "--no-merges",
      `--pretty=format:%h${UNIT}%an${UNIT}%s`,
      range,
    ),
  );
  for (const commit of directs) {
    if (seen.has(commit.hash)) continue;
    seen.add(commit.hash);
    commits.push(commit);
  }
  return commits;
}

function toChangeItem(
  commit: RawCommit,
): { category: Category; item: ChangeItem } | null {
  const conventional = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/.exec(
    commit.subject,
  );
  if (!conventional) return null;
  const category = categoryFor(conventional[1]);
  if (!category) return null;
  return {
    category,
    item: {
      scope: conventional[2] ?? null,
      // ตัด "(#123)" ท้ายหัวข้อทิ้ง — เลข PR ถูกเก็บเป็นฟิลด์ของตัวเองแล้ว
      summary: conventional[4].replace(/\s*\(#\d+\)\s*$/, "").trim(),
      hash: commit.hash,
      author: commit.author,
      pr: commit.pr,
    },
  };
}

function buildChanges(range: string): VersionEntry["changes"] {
  const changes: VersionEntry["changes"] = {
    added: [],
    fixed: [],
    changed: [],
  };
  for (const commit of collectCommits(range)) {
    const parsed = toChangeItem(commit);
    if (!parsed) continue;
    changes[parsed.category].push(parsed.item);
  }
  return changes;
}

function renderItem(item: ChangeItem): string {
  const scope = item.scope ? `**${item.scope}:** ` : "";
  const pr = item.pr ? ` (#${item.pr})` : "";
  return `- ${scope}${item.summary}${pr} — ${item.author} \`${item.hash}\``;
}

export function renderMarkdown(changelog: Changelog): string {
  const lines: string[] = [
    "# Changelog",
    "",
    "ไฟล์นี้ generate จาก git history โดย `bun run build:bump` — อย่าแก้ด้วยมือ",
    "แก้ที่ `changelog.json` หรือแก้ตัว generator (`scripts/changelog.ts`) แล้วรัน",
    "`bun scripts/changelog-cli.ts` เพื่อ render ใหม่",
    "",
  ];
  for (const entry of changelog.versions) {
    lines.push(`## [${entry.version}] - ${entry.date}`, "");
    const sections: Array<[string, ChangeItem[]]> = [
      ["Added", entry.changes.added],
      ["Fixed", entry.changes.fixed],
      ["Changed", entry.changes.changed],
    ];
    if (!sections.some(([, items]) => items.length > 0)) {
      // ใช้ "init" ให้ตรงกับที่ whats-new-dialog.tsx:50 เช็ค — ต้นฉบับ backend
      // ใช้คำว่า "baseline" ซึ่งฝั่งนี้ไม่มีใครอ่าน
      lines.push(
        entry.note === "init" ? "_Initial release._" : "_No notable changes._",
        "",
      );
      continue;
    }
    for (const [title, items] of sections) {
      if (items.length === 0) continue;
      lines.push(`### ${title}`, ...items.map(renderItem), "");
    }
  }
  return lines.join("\n").replace(/\n+$/, "") + "\n";
}

export function readChangelog(): Changelog {
  return JSON.parse(readFileSync(JSON_PATH, "utf8")) as Changelog;
}

function writeAll(changelog: Changelog): void {
  writeFileSync(JSON_PATH, JSON.stringify(changelog, null, 2) + "\n");
  writeFileSync(MD_PATH, renderMarkdown(changelog));
}

function countChanges(entry: VersionEntry): number {
  return (
    entry.changes.added.length +
    entry.changes.fixed.length +
    entry.changes.changed.length
  );
}

function isCommit(rev: string): boolean {
  try {
    return git("cat-file", "-t", rev) === "commit";
  } catch {
    return false;
  }
}

/**
 * แทรก entry ของ release ใหม่ไว้บนสุด แล้วเขียนทั้ง changelog.json และ CHANGELOG.md
 *
 * ช่วง git = `<commit ของ entry บนสุด>..HEAD` ซึ่งกิน commit `chore(release):`
 * ของรอบก่อนเข้ามาด้วย 1 ตัว — ตั้งใจ เพราะ `chore` ไม่เข้าเกณฑ์หมวดใดเลยและถูก
 * `toChangeItem()` ทิ้งอยู่แล้ว (entry ที่ได้จาก rebuildFromTags() ไม่มีอาการนี้
 * เพราะ commit ของมันชี้ที่ release commit พอดี — ความต่างนี้ตั้งใจ ไม่ต้องทำให้เท่ากัน)
 *
 * @param params.target semver ที่กำลังปล่อย เช่น "1.2.1"
 * @param params.fullVersion เช่น "1.2.1-build.20260810.abc1234" — ใช้เป็นฟิลด์ `build`
 *   ของ entry ตรง ๆ ไม่ถูก parse ต่อ
 * @param params.commit short hash ของ HEAD ก่อน release commit — ผู้เรียกส่งมาตรง ๆ
 *   แล้วใช้เป็นฟิลด์ `commit` ของ entry (ไม่ derive จาก fullVersion อีกต่อไป)
 * @throws ถ้า changelog.json ไม่มี entry หรือ baseline ชี้ commit ที่ไม่มีในรีโป
 */
export function recordRelease(params: {
  target: string;
  fullVersion: string;
  commit: string;
}): void {
  const changelog = readChangelog();
  const baseline = changelog.versions[0]?.commit;
  if (!baseline)
    throw new Error("changelog.json ไม่มี entry ให้ใช้เป็น baseline");
  // เคยเกิดจริง: changelog.json ที่ port ติดมาจาก Next.js app ชี้ commit dbf5ae2b
  // ที่ไม่มีในรีโปนี้ แล้ว `git log dbf5ae2b..HEAD` fatal โดยไม่บอกสาเหตุ
  if (!isCommit(baseline)) {
    throw new Error(
      `changelog.json อ้าง commit ${baseline} ที่ไม่มีในรีโปนี้ — รัน \`bun scripts/changelog-cli.ts --rebuild\` ก่อน`,
    );
  }

  const entry: VersionEntry = {
    version: params.target,
    build: params.fullVersion,
    date: new Date().toISOString().slice(0, 10),
    commit: params.commit,
    changes: buildChanges(`${baseline}..HEAD`),
  };
  changelog.versions.unshift(entry);
  changelog.current = params.target;
  changelog.generated_at = new Date().toISOString();
  writeAll(changelog);
  console.log(
    `▸ changelog ........ +${countChanges(entry)} รายการ (${baseline}..HEAD) ✓`,
  );
}

/**
 * สร้าง changelog.json ใหม่ทั้งไฟล์จาก git tag — bootstrap ทับของเดิมทั้งหมด
 *
 * หนึ่ง entry ต่อหนึ่ง tag ช่วงของ tag ที่ n คือ `<tag n-1>..<tag n>` ส่วน tag
 * เก่าสุดกินทั้งประวัติถึงตัวมันเอง · `commit` ของแต่ละ entry คือ commit ที่ tag ชี้
 * (= release commit) ช่วงของ recordRelease() ครั้งถัดไปจึงพอดีเป๊ะ
 */
export function rebuildFromTags(): void {
  const raw = git("tag", "--list", "v*", "--sort=v:refname");
  const tags = raw ? raw.split("\n") : [];
  if (tags.length === 0) throw new Error("ไม่มี tag v* ให้ rebuild");

  const entries: VersionEntry[] = tags.map((tag, index) => {
    const previous = index === 0 ? null : tags[index - 1];
    const commit = git("rev-list", "-n", "1", "--abbrev-commit", tag);
    const date = git("log", "-1", "--format=%ad", "--date=short", tag);
    const version = tag.replace(/^v/, "");
    const entry: VersionEntry = {
      version,
      build: `${version}-build.${date.replace(/-/g, "")}.${commit}`,
      date,
      commit,
      changes: buildChanges(previous ? `${previous}..${tag}` : tag),
    };
    if (index === 0) entry.note = "init";
    return entry;
  });
  entries.reverse(); // ใหม่สุดอยู่บน — lib/changelog.ts:37 อ่าน versions[0] เป็น LATEST

  writeAll({
    current: entries[0].version,
    generated_at: new Date().toISOString(),
    versions: entries,
  });
  for (const entry of entries) {
    console.log(
      `  v${entry.version.padEnd(8)} ${String(countChanges(entry)).padStart(3)} รายการ  ${entry.date}`,
    );
  }
  console.log(`✓ rebuild ${entries.length} เวอร์ชันจาก git tag`);
}
