---
version: 1
name: Carmen-inventory-ERP
verified: 2026-09-16   # counts and file references re-checked against the code on this date
description: A dense hospitality supply-chain ERP. Neutral graphite surfaces carry a single Carmen-blue accent; chrome is flat and borderless-by-default so that rows of data, not the container, are what the eye lands on. Type is governed from the small end up — 97% of the app's text sits at or below 12px — and colour is split two ways: semantic status and a 41-value document-status palette — per-module identity was tried and removed. Every rule here is measured against the code, not aspirational — counts drift as the app grows, so treat them as evidence for a proportion, not as a contract.

colors:
  # CARMEN BLUE — neutral graphite surfaces + Carmen blue accent.
  # Source of truth: styles/globals.css (OKLCH). Hex below are sRGB equivalents.
  #
  # TWO COLOUR LAYERS, plus one derived palette. Know which one you are in:
  #   styles/globals.css       semantic + surface + the status *inks* (below)
  #   styles/badge-status.css  the 41-value document-status palette, with its
  #                            own hue-to-meaning table — see "Document status"
  #   styles/module-colors.css NOT a layer any more — only the app-tile palette,
  #                            derived from `--primary`. The `--module-*` and
  #                            `--sub-*` tokens were DELETED 2026-09-10 because
  #                            they had become a second, third and fourth accent
  #                            on one page. Do not reintroduce them.
  #
  # USAGE — single accent signal (avoid "neon"): accent & semantic colors
  # (primary / destructive / success / warning) should appear ONCE per element,
  # never clustered. Repeating one color across icon-box + icon + chip on a
  # neutral surface reads as glowing/neon — keep it to a single signal and let
  # the surrounding box / label / border stay neutral.
  #   e.g. error state = red icon only; neutral box, muted label, neutral border.
  #   (Applied in ProfileError — components/share/profile-gate.tsx, and in the
  #   Badge `*-light` variants, which put the hue in the label and leave the box
  #   `bg-muted`.)
  #
  # CONTRAST — the status colours are FILL colours, not text colours.
  # Each has a matching `-foreground` for the label that sits ON it. Measured as
  # `text-*` against the light canvas they do not reach WCAG AA (4.5:1):
  #     warning 1.93 · success 1.99 · positive 3.20 · negative 3.79 · info 4.31
  # All of them pass comfortably in dark mode (6–10:1), so the light values are
  # effectively tuned for the dark canvas.
  # RESOLVED by splitting the roles: `--<status>-ink` is the same hue and chroma
  # at a lightness that clears AA, and the 96 `text-*` call sites use it. Fills
  # keep the plain token, so chips and badges are unchanged.
  #   text-warning-ink · text-success-ink · text-info-ink
  #   text-positive-ink · text-negative-ink · text-brand-ink
  # Lightness is solved against the WORST surface the text can land on: in light
  # mode the DARKEST light surface (`--accent` 0.93), in dark mode the LIGHTEST
  # dark one (`--accent` 0.29). Solving against the canvas alone yields inks that
  # pass on the page and fail on every card — a first pass at these values did
  # exactly that. lib/__tests__/status-ink-contrast.test.ts recomputes all of it
  # from the CSS and also fails if a fill token is used as `text-*` again.
  # `destructive` (5.08) and `primary` (6.60) are safe as light-mode text without
  # an ink; `brand` is the mirror case — fine on light, 4.28 on dark.
  #
  # ── Light mode ──
  primary: "#0154bd"            # Carmen Blue — brand accent: buttons, links, focus
  primary-foreground: "#fcfcfc"
  background: "#f8f8f8"
  foreground: "#0d0d0d"
  card: "#ffffff"
  popover: "#ffffff"
  secondary: "#ebebeb"
  muted: "#eeeeee"
  muted-foreground: "#585858"
  accent: "#e8e8e8"             # the DARKEST light surface — inks are solved against it
  border: "#e1e1e1"
  ring: "#0154bd"
  sidebar: "#f5f5f5"
  destructive: "#cd2531"        # dark enough for a white label — WCAG AA 5.38:1
  success: "#44c5bc"
  info: "#007eb0"               # Azure — semantic info/comment, distinct from primary blue
  warning: "#efa831"
  positive: "#23a136"
  highlight: "#f5e49c"          # search-match background (tree/table filter hits).
                                # Not a status colour; never use it to mean warning.
  # ── Dark mode (neutral graphite) ──
  dark-primary: "#3894f7"       # Aquatic — brighter on dark so `text-primary` reads
                                # on the canvas (5.79:1). One token serves both the
                                # fill and links, and no lightness satisfies both with
                                # a white label, so the fill takes a dark one.
  dark-primary-foreground: "#08121f"
  dark-background: "#161616"
  dark-foreground: "#e8e8e8"
  dark-card: "#1f1f1f"
  dark-popover: "#222222"
  dark-secondary: "#262626"
  dark-muted: "#222222"
  dark-muted-foreground: "#8c8c8c"
  dark-accent: "#2b2b2b"        # the LIGHTEST dark surface — inks are solved against it
  dark-border: "#2e2e2e"
  dark-ring: "#3894f7"
  dark-sidebar: "#0f0f0f"
  dark-destructive: "#f75253"   # stays light so `text-destructive` reads on dark;
                                # the fill takes a dark label
  dark-destructive-foreground: "#1d0c0b"
  dark-success: "#44c5bc"
  dark-info: "#0aa0d2"          # Azure (brighter on dark) — distinct from dark-primary
  dark-warning: "#f5b75b"
  dark-positive: "#68cb6e"
  dark-highlight: "#6b5a1f"

typography:
  # The ladder is named from the DENSE END UP, which is the inversion that makes
  # this an ERP type system rather than a marketing one: 775 `text-xs` uses and
  # ~613 former sub-12px literals versus 48 uses of `text-xl` and above. The
  # governed, tokenised part is everything at or below 12px; the display end is
  # the afterthought. Sizes below are the ramp — a literal `text-[…]` off this
  # ramp is a design-system bug (enforced, see Principles).
  #
  # ROOT SCALE — ตั้งแต่ 2026-07-27 ladder นี้อยู่ใต้ font scale ที่ผู้ใช้ปรับได้เอง
  # จากเมนูโปรไฟล์ (lib/font-scale.ts + `html.font-scale-*` ใน globals.css)
  # ขนาด px ทุกค่าข้างล่างคือค่าที่ระดับ `normal` (root 100% = 16px ตาม browser
  # default) ห้าระดับคือ 93.75 / 100 / 112.5 / 125 / 137.5% ทำให้ทั้ง ladder กวาด
  # ตามเป็นสัดส่วนเดียว — micro-floor 8px จริงๆ คือช่วง 7.5–11px และ body 17px คือ
  # 15.9–23.4px ตัวเลขในเอกสารนี้ยังเป็นสัญญาที่ถูกต้อง เพราะสิ่งที่การันตีคือ
  # *สัดส่วนบน ladder* ไม่ใช่ px สัมบูรณ์บนจอผู้ใช้คนใดคนหนึ่ง — breakpoint ของ
  # Tailwind (`sm:`, `md:`, …) ไม่อยู่ใน scope นี้: media query คำนวณ rem จาก
  # initial font-size ของ browser เสมอ ไม่ใช่จาก root ที่ scale แล้ว จึงไม่ขยับตาม
  # ladder นี้ (รายละเอียดดู note ใน globals.css)
  micro-floor:
    # 8px — the absolute floor, tightest micro-grid cells only (HeroCell, the
    # DataGrid badge). Uppercase/numeric only. Utility: `text-micro-floor`
    fontSize: 8px
    fontWeight: 600
    lineHeight: 1.2
    textTransform: uppercase
  micro-eyebrow:
    # 9px uppercase caps for badge/chip eyebrows. Wide tracking + 600 weight keep
    # tiny caps legible — the one place sub-10px type is sanctioned.
    # Utility: `text-micro-eyebrow`
    fontSize: 9px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.04em
    textTransform: uppercase
  micro-legal:
    # 10px — inline meta, timestamps, captions. Utility: `text-micro-legal`
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: -0.08px
  micro:
    # 11px — the workhorse dense size: count chips, inline meta, tabular numbers
    # (pair with `tabular-nums`). Utility: `text-micro`
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: -0.075px
  fine-print:
    # 12px — dense body and form labels. Note `text-xs` is the same size and is
    # the app's overwhelmingly dominant spelling (775 sites); prefer it.
    # Utility: `text-fine-print`
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: -0.12px
  body:
    # 14px — section text, dialog body, button labels. Tailwind `text-sm`.
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-lg:
    # 16px — the rare comfortable read. Tailwind `text-base`.
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  inherited-base:
    # 17px — `body { font-size: 1.0625rem }` in globals.css, inherited by any text
    # with no explicit size. It is a reading-app value ("Apple reading pace") left
    # over from this document's origin, and it is why ~613 sub-12px literals were
    # written: the base sat five steps above the size the app actually works at.
    # Almost every element overrides it, so lowering it to 12px is a small change
    # in theory and an unreviewed change to every unstyled text node in practice —
    # it has been left alone deliberately. Listed here because it is real, not
    # because it is a step anyone should target.
    fontSize: 17px
    fontWeight: 400
  heading-sm:
    fontSize: 18px    # text-lg — card and section headings
    fontWeight: 600
    lineHeight: 1.4
  heading:
    fontSize: 20px    # text-xl
    fontWeight: 600
    lineHeight: 1.3
  heading-lg:
    fontSize: 24px    # text-2xl — page titles
    fontWeight: 600
    lineHeight: 1.25
  display:
    fontSize: 30px    # text-3xl — module landings
    fontWeight: 600
    lineHeight: 1.2
  display-lg:
    fontSize: 36px    # text-4xl — the largest routinely used step
    fontWeight: 600
    lineHeight: 1.15
  display-xl:
    fontSize: 48px    # text-5xl — one-off hero numerals
    fontWeight: 700
    lineHeight: 1.1
  display-2xl:
    fontSize: 60px    # text-6xl — the 404 numeral, and nothing else
    fontWeight: 700
    lineHeight: 1.05

rounded:
  # Carmen Blue's real radius grammar, counted from the code. Base `--radius: 0.625rem`
  # in styles/globals.css; the rest are Tailwind's rounded-* steps off it.
  # A full-pill primary CTA was trialled on Button and intentionally REVERTED —
  # it did not fit dense ERP chrome. Pills are for indicators, not actions.
  full: 9999px      # 208 uses — status dots, avatars, count chips
  lg: 10px          # 188 uses — cards-in-lists, panels
  md: 8px           # 180 uses — buttons, badges, inputs (the control radius)
  xl: 12px          # 105 uses — the Card primitive
  sm: 6px           # 60 uses — inline chips, table-cell affordances
  none: 0px         # 25 uses — flush table edges, full-bleed strips

spacing:
  # ── Project constraint (Carmen Blue / Tailwind v4) ───────────────
  # Do NOT define a `--spacing-md` token. In Tailwind v4 the `md` key is SHARED
  # by the spacing scale AND the container/max-width scale, so defining it
  # shadows `max-w-md` (28rem → your value) and collapses every `max-w-md` /
  # `w-md` / `min-w-md` in the app (login card, panels… text wraps one word per
  # line). Same trap for the t-shirt names sm / lg / xl / 2xl.
  # → For an off-scale value use an arbitrary utility (`p-[1.0625rem]`) or a
  #   non-colliding token name (`--spacing-17` → `p-17`).
  # Everything else maps to Tailwind's 4px scale.
  base: 4px
  xxs: 4px
  xs: 8px
  sm: 12px
  lg: 24px
  xl: 32px
  xxl: 48px

components:
  # Carmen Blue's real primitives, read from components/ui/. Variants are listed where
  # the component defines them; this is a map of what exists, not a wish-list.
  button:
    element: components/ui/button.tsx
    rounded: "{rounded.md}"
    typography: "{typography.body}"   # 14px / 600 / tracking-tight
    variants: default · destructive · outline · secondary · success · info · warning · ghost · link
    sizes: default 36px · sm 32px · xs 24px · lg 40px · icon 36px · icon-sm 32px · icon-xs 24px · icon-lg 40px
    press: "transform: scale(0.95)"
    focus: 2px ring on `--ring`, plus a border colour change
    note: solid variants carry a hairline `border-black/10` (`dark:border-white/10`)
          so a coloured fill still has an edge on a coloured surface
  badge:
    element: components/ui/badge.tsx
    rounded: "{rounded.md}"
    typography: 600 weight, tracking-tight, `[&_svg]:size-3`
    variants: default · secondary · destructive · success · info · warning · outline ·
              ghost · link · invert · <hue>-light · <hue>-outline
    note: the `-light` set is the "avoid neon" answer — a neutral `bg-muted` box
          with the hue carried ONCE, by the label (`text-warning-ink` etc.).
          Reach for `-light` inside dense rows; reserve solid fills for the few
          places a chip must survive being scanned past.
  card:
    element: components/ui/card.tsx
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    border: 1px "{colors.border}"
    padding: 24px block
    elevation: none — flat chrome, see Elevation
  data-grid:
    element: components/ui/data-grid/
    note: the core ERP surface — table, column header/filter/visibility, pagination,
          row actions, and two drag-and-drop table variants. Badges inside it are
          forced to `{typography.micro-floor}` by a rule in globals.css.
  field:
    element: components/ui/field.tsx
    note: `FieldPlainText` is the read-only value display (~140 uses) and is where
          weight 500 is baked in — see the weight principle.
  app-shell:
    element: components/sidebar/app-sidebar.tsx + components/navbar/navbar.tsx
    note: fixed sidebar (`{colors.sidebar}`, one step off the canvas rather than a
          border) + a top bar carrying breadcrumb, BU switcher, module launcher,
          notifications, theme and language switches, and the user menu.
---

## Overview

Carmen Blue is a hospitality supply-chain ERP: purchase requests, purchase orders, goods receipt, store requisitions, physical counts, vendor price lists. The people using it are storekeepers, cost controllers and procurement officers who sit in it for most of a working day, in Thai or English, mostly on a desktop.

That gives the interface one job above all others: **let someone scan hundreds of rows and find the one that is wrong.** Every rule below follows from it.

**Key characteristics:**

- **Density is the point.** The type ladder is governed from 8px up, not from the display sizes down, because that is where the app actually lives.
- **Chrome recedes.** Cards are flat — a hairline border and a surface step, no shadows. Elevation is reserved for things that genuinely float (dialogs, popovers, dropdowns).
- **One accent.** Carmen Blue is the only "you can act on this" colour. Status hues are information, not decoration, and appear once per element.
- **Colour is stratified.** Semantic (`warning`/`success`/…) and document status (41 values) are two separate systems that must not be mixed. A document being _Rejected_ is not the same kind of fact as a field being _invalid_. There is deliberately no third, per-module layer — see below.
- **Bilingual by default.** Thai and English share every surface, and Thai sets the floor for line-height and font stack.

## Colors

### The two layers

| Layer           | File                      | What it means                                                       |
| --------------- | ------------------------- | ------------------------------------------------------------------- |
| Semantic        | `styles/globals.css`      | State of a _control or message_ — invalid, warning, success, info   |
| Document status | `styles/badge-status.css` | Where a _document_ is in its lifecycle — draft, submitted, approved… |

Mixing them is the most common colour mistake here. A green `success` toast and a green `approved` badge mean different things and are allowed to be different greens.

**There was a third layer and it was removed.** `styles/module-colors.css` used to carry `--module-*` and `--sub-*` identity colours per ERP area. On 2026-09-10 they were deleted and every call site moved to `var(--primary)`: painted onto buttons, steppers and badge dots, they had become a second, third and fourth accent on a single page — the exact thing the single-accent rule above exists to prevent. What is left in that file is the app-tile palette, which was always derived from `--primary`.

**Distinguish modules with icons, wording and layout — not with colour.**

### Brand & accent

- **Carmen Blue** (`{colors.primary}` — #0154bd): the single interactive colour — buttons, links, focus ring. On dark it lightens to `{colors.dark-primary}` (#3894f7) so `text-primary` still reads on the canvas; one token serves both fill and link, and since no lightness satisfies both with a white label, the fill takes a dark one.
- There is no second brand colour. If something needs to stand out and is not an action, it is a status, not an accent.

### Surfaces

Neutral graphite in both themes, achromatic (chroma 0) so the accent is the only hue in the chrome. Light runs `background` #f8f8f8 → `card` #ffffff, i.e. cards are _lighter_ than the page; dark runs `background` #161616 → `card` #1f1f1f, the same direction. `accent` is the extreme in each mode (darkest light surface, lightest dark surface) which is why the status inks are solved against it.

### Document status

`styles/badge-status.css` carries 41 status values with a documented hue-to-meaning table (gray = not started, sky = open, yellow = in progress, green = approved, indigo = completed, red = rejected, rose = cancelled, dark amber = locked, and so on), plus separate ramps for workflow actions (`wf-*`), stock direction, GRN origin, and cuisine regions. Each has a `-fg` partner for its label. **Add a status by editing that file, not by reaching for a semantic token** — a semantic `warning` chip and an `in-progress` chip drift apart the moment someone re-tunes one of them.

### Hairlines

Borders do the work shadows would. `{colors.border}` at 1px is the default separator; solid-fill buttons add `border-black/10` (`dark:border-white/10`) so a coloured fill still has an edge when it sits on a coloured surface.

## Typography

### Font family

`--font-sans` is a system stack with Thai families appended:

```text
-apple-system, BlinkMacSystemFont, system-ui, "Inter", "Segoe UI", Roboto,
"Sarabun", "Noto Sans Thai", "IBM Plex Sans Thai", "Leelawadee UI", "Thonburi", sans-serif
```

Font fallback is per-glyph, so Latin resolves from the first group and only Thai glyphs fall through to the second. No webfont is loaded — the bundle is static on a CDN and the stack is deliberately zero-request. Numeric columns pair with `tabular-nums` (used ~360×).

### Hierarchy

The ramp is the `typography` block above. In practice:

| Tier    | Utility              | Where                                                   |
| ------- | -------------------- | ------------------------------------------------------- |
| 8px     | `text-micro-floor`   | tightest grid cells, DataGrid badges                    |
| 9px     | `text-micro-eyebrow` | uppercase eyebrows on chips and cards                   |
| 10px    | `text-micro-legal`   | timestamps, captions, inline meta                       |
| 11px    | `text-micro`         | count chips, tabular numbers                            |
| 12px    | `text-xs`            | **the real body size** — labels, cells, most of the app |
| 14px    | `text-sm`            | dialog body, buttons, section text                      |
| 18–24px | `text-lg`/`xl`/`2xl` | headings                                                |
| 30px+   | `text-3xl`+          | module landings, one-off numerals                       |

### Principles

- **Use the utility, not a literal.** Every tier is a real Tailwind utility. A new `text-[…]` arbitrary value is a design-system bug, not a shortcut. This is enforced: `components/ui/type-ladder.test.ts` fails if a size that already has a token reappears anywhere, and every remaining off-ladder literal is listed there by file with the reason it was left. Adding a new one means editing that list — which is the point.
- **A size token sets size, not weight or case.** `micro-eyebrow` and `micro-floor` describe uppercase 600 type, but the _utilities_ deliberately do not enforce it — a `text-*` utility that silently restyled weight would have restyled 32 of 102 existing sub-10px call sites on migration, and Tailwind's own `text-*` utilities never do it. Keep `font-semibold` / `uppercase` / `tracking-*` explicit at the call site.
- **A new step must be registered with `cn()`, not just defined in CSS.** `cn()` is `twMerge(clsx(…))`, and tailwind-merge only knows Tailwind's built-in scale plus arbitrary values — not `@theme` font-size keys. An unregistered step is not treated as conflicting with `text-sm`/`text-xs`, so `cn("… text-sm", "text-micro-legal")` keeps **both** and CSS source order picks the winner. That is how the navbar avatar initials silently jumped 10px → 14px during the ladder migration; it never broke while the call site said `text-[0.625rem]`, because arbitrary values _are_ recognised. Add every new step to the `font-size` class group in `lib/utils.ts` (`lib/__tests__/cn-font-size.test.ts` fails if you forget).
- **Sub-10px is for uppercase eyebrows and digits only** — never for running text. The 600 weight and wide tracking of caps are what keep 9px legible, and sentence copy has neither; digits get away with it because they are uniform-height with no ascenders, descenders or diacritics. It matters most in Thai, which stacks two levels of marks above the baseline (สระบน + วรรณยุกต์). **Enforced:** `type-ladder.test.ts` freezes every sub-10px site that is not `uppercase`, so a new one fails the suite until somebody either marks it `uppercase` or records why it is exempt. The proxy is deliberately crude — digits and illustration mock-ups are legitimately neither — because its job is to force a human look, not to classify.
- **Thai sets the line-height floor.** Thai stacks two levels of diacritics above the baseline, which clip at `line-height: 1`. The tiers that carry Thai sentence text (`micro`, `micro-legal`, `fine-print`) ship at 1.35–1.4; only the uppercase tiers go tighter, and only because Thai has no uppercase.
- **Weight 500 is the data-value tier.** The full ladder is **300 / 400 / 500 / 600 / 700**. 500 has exactly one job: _this is the value, as distinct from its label or its qualifier._ It is load-bearing — `FieldPlainText` bakes it in and is used ~175×, plus ~110 further `font-medium` sites, all doing the same thing:

  | pattern                | example                                                  |
  | ---------------------- | -------------------------------------------------------- |
  | amount + currency code | amount at 500, the `THB` suffix at 400                   |
  | name + code beneath    | product / vendor / location name at 500, its code at 400 |
  | label → value pair     | label `text-muted-foreground`, value 500                 |
  | table header `<th>`    | `px-3 py-2 font-medium`                                  |
  | selected state         | `checked ? "font-medium" : "text-foreground/90"`         |

  Do not use 500 for headings or running text — those are 600 and 400. Reach for it when a value must out-rank something adjacent without shouting; 600 in a dense row reads as a heading and flattens the scan.

- **600 is the mid-weight, not 700.** Headings sit at 600. 700 is rare and deliberate. `font-bold` on the 9px tier has been swept repeatedly and is guarded by `type-ladder.test.ts`.
- **Display type is deliberately loose.** Above 18px there is no governed ladder beyond Tailwind's steps, because the app barely goes there. Do not invent one.

## Layout

### Shell

A fixed sidebar (`{colors.sidebar}`, distinguished by a surface step rather than a border) plus a top bar carrying breadcrumb, business-unit switcher, module launcher, notifications, theme switch, language switch and user menu. Content fills the remainder. Module sections mount under a section parent that owns the error boundary.

### Spacing

4px base, Tailwind's scale. Dense surfaces (rows, cells, chips) run on 2–8px; page-level rhythm on 16–32px. See the `spacing` block above for the `md` naming trap — it is the one thing in this system that will break unrelated layout if you get it wrong.

### Grid

Content is fluid to the viewport rather than locked to a max width — an ERP table wants the pixels. Cards inside a page use a responsive column grid; forms use a two-column split that collapses to one.

## Elevation & Depth

| Level    | Treatment                   | Use                                                |
| -------- | --------------------------- | -------------------------------------------------- |
| Flat     | 1px border, surface step    | Cards, panels, the DataGrid, sidebar — the default |
| Raised   | `--shadow-sm`/`--shadow`    | Dropdowns, popovers, comboboxes                    |
| Floating | `--shadow-lg`/`--shadow-xl` | Dialogs, sheets, the command palette               |
| Overlay  | `--overlay` scrim           | Behind modals                                      |

**Flat chrome is the rule.** A card is a border and a surface step, never a shadow — shadows on every panel turn a dense page into visual noise, and the row you are hunting for stops being the most interesting thing on screen. Shadow means "this is temporarily on top of the page", and nothing else. The shadow scale exists (`--shadow-2xs` → `--shadow-2xl`) but the low end is essentially unused by design.

## Shapes

See the `rounded` block. The grammar in one line: **`md` for controls, `lg`/`xl` for containers, `full` for indicators, `none` where a table must sit flush.** The full-pill CTA was trialled on Button and reverted — pills read as status here, not as actions, and a pill button in a dense toolbar is louder than the data.

## Components

Specs live in the `components` block above, read from the source. Notes that do not fit there:

**Button** — one primary per view. Everything else is `outline`, `secondary` or `ghost`. The coloured variants (`success`/`info`/`warning`/`destructive`) are for actions whose _outcome_ is that colour, not for decorating a toolbar.

**Badge** — prefer the `-light` variants inside tables and dense rows: a neutral `bg-muted` box with the hue carried once, by the label. Solid fills are for the few chips that must survive being scanned past. Document-status badges take their colour from `badge-status.css`, not from the semantic variants.

**DataGrid** — the surface everything else is in service of. Column header, filter, visibility toggle, pagination and row actions are all provided; two drag-and-drop variants exist for ordering. Badges inside it are pinned to 8px by a rule in `globals.css`.

**Field / FieldPlainText** — the read-only value display, and the home of weight 500.

**Dialogs, sheets, popovers** — the only places elevation appears.

## Do's and Don'ts

### Do

- Use `{colors.primary}` for every interactive signal, and nothing else.
- Let one colour signal carry an element — the `-light` badge pattern is the model.
- Reach for a ladder utility (`text-micro`, `text-micro-legal`, …) instead of a literal size.
- Register a new type step in **both** `globals.css` and `lib/utils.ts`.
- Use `-ink` tokens for status **text** and the plain token for status **fills**.
- Pair numeric columns with `tabular-nums`.
- Give Thai room: 1.35+ line-height anywhere sentence text can appear.
- Keep cards flat; spend elevation only on things that float.

### Don't

- Don't mix the two colour layers — a document status is not a semantic state.
- Don't reintroduce a per-module identity colour. It existed, it became a second accent, it was removed on purpose.
- Don't set body copy, headings or display type at weight 500; it marks a data value against its label, and nothing else.
- Don't put sub-10px type on running text, in either language.
- Don't add a shadow to a card, panel or table.
- Don't introduce a second accent colour.
- Don't define a `--spacing-md` token, or any spacing token named for a t-shirt size.
- Don't use `{colors.highlight}` to mean warning — it is a search-match background.
- Don't "clean up" a raw palette colour into a semantic token without checking contrast first; several of those call sites were darker than the token on purpose.

## Responsive Behavior

Carmen Blue is desktop-first: it is a working tool for people at a desk, and the tables assume width. Real breakpoint usage in the code is `sm:` 590 · `lg:` 181 · `md:` 123 · `xl:` 27 · `2xl:` 1 — so the meaningful decisions are "does this stack on a phone" (`sm:`) and "does the sidebar/grid change on a laptop" (`lg:`). Do not design an eight-step responsive matrix; this app does not have one.

- Tables scroll horizontally rather than reflowing — a column that disappears is a column somebody was reading.
- The sidebar collapses to icons, then to a sheet.
- Forms go two-column → one-column at `sm:`.
- Touch targets: 44×44px minimum where touch is plausible; the dense desktop controls (`size-6` icon buttons, 24px chips) are deliberately below that and are desktop-only affordances.

## Iteration Guide

1. Change one thing at a time and reference its key (`{typography.micro}`, `{rounded.md}`).
2. Never inline a hex; never inline a font size.
3. When a rule here and the code disagree, **check which one is load-bearing before assuming the code is wrong.** Weight 500 was "deliberately absent" in this document while 178 rendered instances depended on it; the ladder's dense tier was documented in prose with no CSS token behind it, which is why ~613 literals existed. Both times the code was reporting a real gap.
4. If you find yourself reaching outside the system repeatedly, that is a signal the system is missing a step — not that the team is sloppy. That pattern has now produced the sub-12px tier, the status inks, and the 500 weight.
5. Measure contrast rather than eyeballing it; `lib/__tests__/status-ink-contrast.test.ts` and `components/ui/button-contrast.test.ts` both do the maths from the CSS.

## Known Gaps

- **Component specs are a map, not a full spec.** `components/ui/` holds 67 top-level primitives (83 files counting sub-folders such as `data-grid/`); the block above names the load-bearing ones and their variants. Individual anatomy (slot structure, every state) is not documented — read the component.
- **Motion has no scale, but it does respect the user.** `globals.css` defines fade/float/pulse keyframes and four global interaction transitions; there is still no documented duration/easing scale. `prefers-reduced-motion` **is** honoured now: a blanket rule neutralises animation and transition, with `.animate-spin` and `.animate-pulse` deliberately exempted — the usual boilerplate's `animation-iteration-count: 1` freezes ~100 spinners and ~11 skeletons, and a frozen spinner reads as a hung request rather than as calm. Guarded by `lib/__tests__/reduced-motion.test.ts`, including the exemption.
- **Focus and screen-reader behaviour are partly checked, not audited.** Every interactive primitive carries a `focus-visible` ring (`combobox` uses `focus-within` on its container instead — different mechanism, same result), and every custom clickable found with `tabIndex={0}` also has `role="button"` and an Enter/Space `onKeyDown`. That is a **code reading, not a live keyboard test** — driving real Tab focus through browser automation did not work here, so no one has actually tabbed the app end to end. Screen-reader behaviour is entirely unverified; `aria-label` appears in 163 of 1,012 component files, which is a coverage number, not a correctness one.
- **Touch targets are desktop-first by choice.** 145 icon buttons render at 24–36px, below the 44px guideline. That is deliberate for a desk tool, but it means the app is not usable on a tablet without a pass over the dense controls.
- **`styles/module-colors.css` is documented in its own header only.** Since the identity tokens were removed it holds only the app-tile derivation (single-accent tints mixed in sRGB, deliberately not oklch, to avoid a hue shift toward pink) — read that header before touching tile colour.
- **Empty, loading and error states** have implementations (`ErrorState`, `Empty`, skeletons) but no documented rules about when each applies.
- **This document was previously an analysis of apple.com** — a teardown that arrived as the project's design doc and accumulated Carmen-specific corrections as marginal notes. The Apple-only material (product tiles, store pages, photography geometry, an eight-step breakpoint matrix) has been removed. If a rule here reads like it came from a marketing site rather than from this codebase, it is a bug — check it against the code and fix it.
