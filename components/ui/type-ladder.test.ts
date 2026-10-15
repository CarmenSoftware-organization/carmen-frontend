import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

/**
 * The one sanctioned sub-10px tier: `{typography.micro-eyebrow}` is 9px and
 * `{typography.micro-floor}` is 8px — same ladder, so both sizes want weight 600.
 *
 * Two spellings, because the tier is mid-migration: the arbitrary literals this
 * guard was written against (`text-[0.5625rem]` / `text-[0.5rem]`) are being
 * replaced by the `text-micro-eyebrow` / `text-micro-floor` utilities now that
 * the ladder exists in CSS. Matching only the literals would make this guard
 * pass vacuously for every migrated file — green, and blind. Keep BOTH arms
 * until the last literal is gone, then drop the first.
 *
 * Deliberately does not include a bare `text-micro` arm: that is the 11px tier,
 * and as a prefix of `text-micro-eyebrow` it would also blur the two together.
 */
const MICRO_EYEBROW = String.raw`(?:text-\[0\.5(?:625)?rem\]|text-micro-eyebrow|text-micro-floor)`;

function tsxFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxFiles(rel);
    return e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx")
      ? [rel]
      : [];
  });
}

const sources = ["components", "routes"]
  .flatMap(tsxFiles)
  .map((file) => ({ file, src: readFileSync(join(ROOT, file), "utf-8") }));

const offenders = (): string[] =>
  sources
    .filter(({ src }) =>
      new RegExp(
        `(${MICRO_EYEBROW}[^"'\`]*font-bold|font-bold[^"'\`]*${MICRO_EYEBROW})`,
      ).test(src),
    )
    .map(({ file }) => file);

describe("the 9px micro tier stays at weight 600", () => {
  it("has no font-bold on a 9px eyebrow in live code", () => {
    expect(offenders()).toEqual([]);
  });

  it("still finds the pattern it claims to guard, in both spellings", () => {
    // guards the regex itself: if it silently stopped matching, the test above
    // would pass for the wrong reason. Both arms are probed — covering only the
    // literal is how this guard would go blind as the migration proceeds.
    const probes = [
      `text-[0.5625rem] font-bold tracking-widest uppercase`,
      `text-[0.5rem] font-bold tracking-widest uppercase`,
      `text-micro-eyebrow font-bold tracking-widest uppercase`,
      `text-micro-floor font-bold tracking-widest uppercase`,
    ];
    for (const probe of probes) {
      expect(
        new RegExp(`${MICRO_EYEBROW}[^"'\`]*font-bold`).test(probe),
        `should flag: ${probe}`,
      ).toBe(true);
    }
  });

  it("does not confuse the 11px tier for the 9px one", () => {
    // `text-micro` is a prefix of `text-micro-eyebrow`; a sloppy arm would drag
    // the whole 11px tier (55 sites in system-admin alone) into this guard.
    expect(
      new RegExp(`${MICRO_EYEBROW}[^"'\`]*font-bold`).test(
        `text-micro font-bold tabular-nums`,
      ),
    ).toBe(false);
    expect(
      new RegExp(`${MICRO_EYEBROW}[^"'\`]*font-bold`).test(
        `text-micro-legal font-bold`,
      ),
    ).toBe(false);
  });
});

/**
 * The app carried ~613 arbitrary `text-[…]` sizes in four near-duplicate values
 * (10px was spelled two ways) purely because the ladder in docs/DESIGN.md had no
 * CSS tokens to reach for. Now it does, and 591 of those were swept away.
 *
 * Nothing stops the 614th. This is the ratchet: a size with a token can never
 * come back, and any other arbitrary size must be justified here by name.
 *
 * Every tokenised size is listed in BOTH spellings it can be written in. Missing
 * one is a hole, not a tidier table: `text-[14px]` sailed past this guard into
 * the notification dialog because only `0.875rem` was registered, and landed in
 * ALLOWED_OFF_LADDER — the list for sizes that have *no* token — as if it were a
 * deliberate exception. A size that is off the ladder and a size that is on it
 * but spelled by hand need different answers, and this map is what tells them
 * apart.
 */
const TOKENISED: Record<string, string> = {
  "0.5rem": "text-micro-floor",
  "0.5625rem": "text-micro-eyebrow",
  "9px": "text-micro-eyebrow",
  "0.625rem": "text-micro-legal",
  "10px": "text-micro-legal",
  "0.6875rem": "text-micro",
  "0.7rem": "text-micro",
  "0.75rem": "text-xs",
  "12px": "text-xs",
  "0.875rem": "text-sm",
  "14px": "text-sm",
};

const ALLOWED_OFF_LADDER: Record<string, number> = {
  // Badge `default` (13px) and `xl` (15px) size variants — part of the component's
  // public API, chosen deliberately, and they straddle the 12/14 ladder steps.
  "components/ui/badge.tsx": 2,
  // shadcn/react-day-picker upstream default (12.8px) on weekday headers.
  // Changing it diverges from upstream for 0.8px.
  "components/ui/calendar.tsx": 2,
  // Auth display sizes: 13/28/36/44px, now in the shell that /login and /register
  // share. The auth screens are the one surface that is intentionally not dense —
  // DESIGN.md's display end is deliberately loose.
  "components/auth/auth-split-shell.tsx": 4,
  "components/module-landing.tsx": 1, // 24px section head
  "components/not-found-component.tsx": 1, // 88px "404" numeral
  "routes/dashboard/dashboard-component.tsx": 2, // 16px + 32px stat display
  "routes/inventory-management/spot-check/sc-form.tsx": 1, // 28px count display
  // 7px inside a decorative miniature mock-UI illustration — it draws a picture of
  // an interface rather than presenting text, so DESIGN.md's 8px floor (which is
  // about legibility of real content) does not apply.
  "routes/system-admin/landing-visuals.tsx": 1,
};

describe("arbitrary font sizes do not creep back", () => {
  const found = sources.flatMap(({ file, src }) =>
    [...src.matchAll(/text-\[([0-9.]+(?:rem|px))\]/g)].map((m) => ({
      file,
      size: m[1],
    })),
  );

  it("never reintroduces a size that already has a token", () => {
    const offenders = found
      .filter((f) => TOKENISED[f.size])
      .map((f) => `${f.file}: text-[${f.size}] → use ${TOKENISED[f.size]}`);
    expect(offenders).toEqual([]);
  });

  it("only allows off-ladder sizes that are listed with a reason", () => {
    const counts: Record<string, number> = {};
    for (const f of found.filter((x) => !TOKENISED[x.size])) {
      counts[f.file] = (counts[f.file] ?? 0) + 1;
    }
    expect(counts).toEqual(ALLOWED_OFF_LADDER);
  });
});

function classNameExpressions(src: string): string[] {
  const out: string[] = [];
  const re = /className=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const i = m.index + "className=".length;
    const q = src[i];
    if (q === '"' || q === "'") {
      const end = src.indexOf(q, i + 1);
      if (end !== -1) out.push(src.slice(i + 1, end));
      continue;
    }
    if (src[i] !== "{") continue;
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    out.push(src.slice(i + 1, j));
  }
  return out;
}

const ALLOWED_SUB_10PX: Record<string, number> = {
  // ── Drawings of a UI, not text in a UI ──
  // Miniature mock interfaces: a fake terminal with macOS traffic-light dots, a
  // fake SQL editor, fake table rows. Scaling this type up breaks the illustration
  // — the point is that it reads as a tiny screenshot.
  // Was 20 until ca4d678 deleted the email-config module's illustration (−3).
  "routes/system-admin/landing-visuals.tsx": 17,

  // ── Digits ──
  // Uniform height, no ascenders/descenders, no diacritics; legible at 9px in a way
  // running text is not, and most sit in fixed-size chips that 11px would overflow.
  "components/navbar/notification.tsx": 1, // unread count "9+"
  "components/ui/input.tsx": 1, // character counter
  "components/ui/textarea.tsx": 1, // character counter
  "components/ui/transfer.tsx": 1, // selected count chip
  "components/share/tree-product-lookup.tsx": 1, // leaf count chip
  "routes/inventory-management/shared/entry-notes-dialog.tsx": 1, // file size
  "routes/inventory-management/shared/filter-pill.tsx": 1, // filter count chip
  "routes/inventory-management/spot-check/sc-product-panel.tsx": 1, // String(length)
  "routes/operation-plan/recipe/recipe-name-field.tsx": 1, // character counter
  "routes/report/report-landing.tsx": 1, // "07:30" schedule time

  // The "caps by nature" section is gone on purpose: its only entry was the
  // wf-stage-users avatar initials, which cc009d2 moved to `text-sm` on a size-8
  // avatar. Deleting the line rather than zeroing it is what this list is for —
  // a stale entry and a real exemption should not look the same.
};

describe("sub-10px type stays off running text", () => {
  const offenders = sources.flatMap(({ file, src }) =>
    classNameExpressions(src)
      .filter(
        (e) =>
          /\b(text-micro-eyebrow|text-micro-floor)\b/.test(e) &&
          !/\buppercase\b/.test(e),
      )
      .map(() => file),
  );

  it("only allows sub-10px non-uppercase where it is listed with a reason", () => {
    const counts: Record<string, number> = {};
    for (const f of offenders) counts[f] = (counts[f] ?? 0) + 1;
    expect(counts).toEqual(ALLOWED_SUB_10PX);
  });

  it("does not flag a size and its uppercase sitting in separate cn() arguments", () => {
    // the glass-card false positive, frozen as a case
    const src = `<Badge className={cn(base, "rounded-full font-semibold tracking-widest uppercase", large ? "text-micro-legal" : "text-micro-eyebrow")} />`;
    const flagged = classNameExpressions(src).filter(
      (e) =>
        /\b(text-micro-eyebrow|text-micro-floor)\b/.test(e) &&
        !/\buppercase\b/.test(e),
    );
    expect(flagged).toEqual([]);
  });

  it("still flags a sub-10px class with no uppercase anywhere in the expression", () => {
    const src = `<p className={cn("text-muted-foreground", "text-micro-eyebrow leading-snug")}>{t("hint")}</p>`;
    const flagged = classNameExpressions(src).filter(
      (e) =>
        /\b(text-micro-eyebrow|text-micro-floor)\b/.test(e) &&
        !/\buppercase\b/.test(e),
    );
    expect(flagged).toHaveLength(1);
  });
});
