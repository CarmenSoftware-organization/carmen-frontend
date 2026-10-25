# Contributing

Working agreement for `carmen-frontend` — CARMEN BLUE's Vite + React
Router 7 SPA. For *how the app is built* read [CLAUDE.md](../CLAUDE.md) (conventions) and
[architecture.md](architecture.md) (design); this file is about *how to get a change in*.

## Environment setup

Prerequisites: **Bun** (CI pins `1.3.13`) and a backend to talk to. Node is not used to
run anything here — every script goes through Bun.

```bash
bun install
cp public/config.sample.json public/config.local.json   # fill in X_APP_ID; keep BACKEND_URL="" for proxy mode
VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev     # proxies /api/* — dev never needs backend CORS
```

`public/config*.json` is gitignored (except the sample), so every developer keeps their
own. `bun dev` serves `public/config.local.json` at `/config.json`; there is no literal
`public/config.json` in dev. The app opens on http://localhost:3000 (Vite bumps the port
if it's taken).

Every command and every config key is tabled in [README.md](../README.md) —
§Commands and §Runtime & build configuration are generated from `package.json`,
`lib/runtime-config.ts` and `vite.config.ts`, so trust those over anything written here.

## The gate

<!-- AUTO-GENERATED: .github/workflows/ci.yml -->

CI (`.github/workflows/ci.yml`) is **manual-only** (`workflow_dispatch` — Actions → CI →
Run workflow); nothing runs on push or pull request, so the local run below *is* the gate:

| Step | Command | Notes |
|---|---|---|
| Lint | `bun run lint` | ESLint — includes the `next*`-import guard and the module-boundary rules |
| Test | `bun run test:run` | Vitest, single run |
| Build | `bun run build` | `tsc --noEmit` + patch bump + `vite build` (the bump is skipped under `CI`); uses `BUILD_CONFIG_FILE=config.sample.json` because the real configs are gitignored |

Run the same three locally before merging. `bun run typecheck` is the standalone
`tsc --noEmit` if you only need the type gate.

<!-- /AUTO-GENERATED -->

Not in CI (run it yourself when routes change): `bun run gen:route-map --check` verifies
`docs/modules/README.md` still matches `routes/router.tsx`.

## Code style

Enforced by `eslint.config.mjs` and `tsconfig.json`, not by review:

- **TypeScript strict.** No `tsc` errors, ever — `bun run build` will not pass otherwise.
- **No `next*` imports.** The `lib/compat/*` shims were removed; import `react-router`
  and `use-intl` directly.
- **Module boundary.** `routes/<A>/` may not import from `routes/<B>/`, and the shared
  layer (`components/` `hooks/` `lib/` `constant/` `types/`) may not import from
  `routes/` at all. When two modules need the same thing, its home is the shared layer —
  never the other module. The rule list is generated from the folders on disk, so a new
  module is covered the moment its folder exists.
- **Colocated routes.** `routes/<module>/<feature>/<feature>.route.tsx` exporting
  `Component`, with its components/hooks/tests flat beside it. No `page.tsx`,
  no `_components/`, no `[id]/`, no `index.ts` barrels.
- **Hooks live at the smallest scope that owns them** — one feature → beside the route;
  two features of one module → `routes/<module>/shared/`; across modules → `hooks/`.

## Tests

Vitest + Testing Library, run with `bun test:run` (add a path for one file) or
`bun test` to watch. Tests sit flat beside the code they cover, or in a `__tests__/`
folder. The suite is **238 test files** and must be green before merge.

End-to-end tests are **not** in this repo — they live in
`../carmen-frontend-e2e` and are run against this SPA with:

```bash
E2E_FRONTEND_DIR=../carmen-frontend VITE_DEV_PROXY_TARGET=<backend> bun e2e
```

## Branches and commits

Branch off `main` — this repo has **no `develop`**. `prod` (production), `vercel` and
`dev2` are deploy branches, not integration branches; never delete or force-push `prod`.
`.github/workflows/deploy-dev.yml` deploys on every push to `main`;
`deploy-gcp.yml` is manual-only.

| Prefix | For |
|---|---|
| `feature/<slug>` / `feat/<slug>` | new features |
| `fix/<slug>` | bug fixes |

**Commit messages are written in Thai**, in Conventional Commit form. The subject line is
parsed by `scripts/changelog.ts`, so the prefix decides where the change lands in
What's New:

<!-- AUTO-GENERATED: scripts/changelog.ts categoryFor() -->

| Prefix | Changelog section |
|---|---|
| `feat` | Added |
| `fix` | Fixed |
| `perf`, `refactor` | Changed |
| anything else | not in the changelog |

Format: `type(scope): สรุปเป็นภาษาไทย` — e.g.
`fix(list-toolbar): ติ๊ก Toggle Columns แล้วเครื่องหมายถูกในเมนูไม่อัปเดต`.
The scope is optional and renders bolded in the changelog. A `!` breaking marker
(`feat(api)!: …`) parses but nothing consumes it yet — such commits render as ordinary
entries.

<!-- /AUTO-GENERATED -->

Pull request titles and descriptions stay in **English**.

## Pull request checklist

- [ ] Branched off `main` with a `feature/` or `fix/` prefix
- [ ] `bun run lint` clean
- [ ] `bun run test:run` green (all 238 files)
- [ ] `bun run build` passes (this is the `tsc --noEmit` gate too; it also bumps the patch
      in `package.json` — use `SKIP_VERSION_BUMP=1` if you don't want that in your diff)
- [ ] Commits are Conventional Commits in Thai, so the changelog picks them up
- [ ] If a route was added, moved or renamed: `bun run gen:route-map` and commit the
      `docs/modules/README.md` diff — the tables there are generated from
      `routes/router.tsx` and nothing else will catch them drifting
- [ ] Manually verified in the browser against a real backend — the type checker does not
      catch wrong data shapes
- [ ] If a new `api_name` is called: the backend app-id allowlist has it, or users get
      401'd out to the login screen
- [ ] If `index.html`'s inline script changed: `bun test:run lib/__tests__/security-headers.test.ts`
      — the CSP `script-src` is pinned to its sha256 across four deploy targets, and a
      stale hash blocks the script silently in production only
- [ ] If a `RuntimeConfig` key was added: `public/config.sample.json`, the README table,
      and the per-environment configs (which are gitignored — someone has to add it by
      hand) are all updated

**Merge with a merge commit, never squash.** `scripts/changelog.ts` walks first-parent
merge commits; squashing produces an empty changelog on the next release with no error.
Use `gh pr merge --merge`, and `git fetch` before `bun run build:bump`.

## Cutting a release

`bun run build:bump [patch|minor|major]` on a clean `main`: it gates on typecheck + lint
+ tests, bumps `package.json`, regenerates `CHANGELOG.md` / `changelog.json`, commits and
tags — **locally only, it never pushes**. Deploy steps per target are in
[deploy.md](deploy.md).
