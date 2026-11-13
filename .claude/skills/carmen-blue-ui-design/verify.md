# How to check the 5 screen sizes

Embed a same-origin iframe of the same page at the width you want — media queries and container
queries inside it respond to the iframe's width (`resize_window` cannot be trusted). An iframe
larger than the screen is scaled down with `transform` to fit. Values measured from
`contentDocument` are still the iframe's real pixels; do not divide by the scale.

## Script

Run it once in the tab that has the page open, then call `await __vp(W, H)` per size. It returns the
measurements as text.

```js
window.__vp = async (W, H, { edit = false, dark = false } = {}) => {
  document.getElementById("__vp")?.remove();
  const f = document.createElement("iframe");
  f.id = "__vp";
  f.src = location.href;
  const s = Math.min(1, innerWidth / W, innerHeight / H);
  f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;transform:scale(${s});transform-origin:top left;z-index:99999;background:#fff;border:0`;
  document.body.appendChild(f);
  await new Promise((r) => setTimeout(r, 4500)); // wait for boot + data fetch
  const d = f.contentDocument;
  if (edit) {
    [...d.querySelectorAll("button")].find((b) => /Edit/.test(b.textContent))?.click();
    await new Promise((r) => setTimeout(r, 700));
  }
  if (dark) d.documentElement.classList.replace("light", "dark") || d.documentElement.classList.add("dark");
  const out = [`${W}: page ${d.documentElement.scrollWidth}`];
  const t = d.querySelector("table");
  if (t) out.push(`table ${t.offsetWidth}/${t.parentElement.clientWidth} cols ${[...t.querySelectorAll("thead th")].map((th) => Math.round(th.getBoundingClientRect().width)).join("/")}`);
  const bar = d.querySelector("[data-slot=status-bar]");
  if (bar) {
    const [l, r] = bar.children;
    const last = [...l.children].filter((e) => e.getBoundingClientRect().width > 0).pop();
    out.push(`footer gap ${Math.round(r.getBoundingClientRect().left - last.getBoundingClientRect().right)} scroll ${bar.scrollWidth}/${bar.clientWidth}`);
  }
  return out.join(" | ");
};
const sizes = [[390, 844], [768, 1024], [1366, 768], [1920, 1080], [3840, 2160]];
const res = [];
for (const [W, H] of sizes) res.push(await __vp(W, H));
res;
```

Measuring more than 4 sizes in one `javascript_tool` call times out at 45 seconds — split into two
batches.

Reading the result:

- `page` must equal `W` — larger = the page scrolls horizontally
- `table a/b` must have `a ≤ b` — larger = the table overflows its frame
- `footer gap` must be positive and the two `scroll` values equal — negative = text overlaps

Take a screenshot after each size. `zoom` coordinates are screenshot coordinates, not viewport
coordinates: the iframe is `W × s` viewport pixels wide, and that must be multiplied again by
(screenshot width ÷ `innerWidth`).

## Check real clicks (not just screen sizes)

After laying out a form you must also click through it for real — the `/profile/setting` bug
(2026-11-13) was not found by measuring all 5 screen sizes; it was found by pressing Save.

- **Save → change the same field back to the old value within 3 seconds → Save again.** The button
  must be enabled and the value must be saved (reload and check). A form that binds `values` to
  query data breaks here if it lacks two things: `resetOptions: { keepDirtyValues: true }` (a
  refetch does not overwrite the field being edited) and a mutation that `setQueryData`s the
  just-saved value before `invalidateQueries` (otherwise, while waiting for the refetch, the form
  holds the old value as its default, and changing back to the original value leaves Save disabled).
  Examples: `hooks/use-profile.ts` `useUpdateProfile`, `routes/profile/user-profile-setting.tsx`
- Set an input's value with the native setter + an `input` event (plain `el.value = …` is invisible
  to React) — but the setter **bypasses `disabled`**. What you get while the field is disabled
  (during a pending mutation) is not real user behaviour; do not read it as a bug.
- Functions parked on `window` (`__vp`) vanish every time the page reloads or navigates — declare
  them again.
- A result containing `=` is blocked by the extension as "Cookie/query string data" even though the
  script ran to completion — do not rerun without checking state. Use `:` instead.
- A dialog with a password field (Change Password) detaches the extension ("Detached") — check it by
  eye. A script that detaches midway **still runs to the end**; take a screenshot to see the state
  before doing anything else.
- Testing on the shared dev DB: note the original value before changing it, change it back, then
  reload to confirm · delete things created for the test (tokens, signatures) · **do not upload over
  an existing image/file** (it cannot be recovered) and do not press "delete all".
- Switching language: `localStorage["carmen.locale"] = "th"`, then reload the iframe. Set it back
  when done.

## Landing pages

- **Column count** = the number of distinct `left` values of the groups · **card width** must be
  around 280–400px at every size · **page length** = the bottom edge of the lowest group − the top
  edge of the `h1`, compared with the viewport height
- **Is an illustration clipped?** The top edge of the illustration content
  (`box.firstElementChild.firstElementChild`) must not sit above the top edge of the illustration
  frame — reduce the frame height and a 4-row illustration gets clipped silently.
- **Raw translation keys**: text starting with the namespace (`systemAdmin.`) must count 0 — a tab
  left open from before the translation file was edited still holds the old strings. Reload before
  trusting it.
- **Open every destination**: collect every card's `href`, then load each path in an iframe (~3
  seconds each, in batches of 5–6 cards) and check that `location.pathname` matches and there is no
  `[role=alert]` · actually click at least 1 card.
- **Locked / no permission / hidden states** cannot be seen with an admin account — force the state
  temporarily in the page's code (change the value in the permission map, tagged
  `__TEMP_VERIFY__`), open it and click for real, then **remove it and grep to confirm before
  committing**. Cover all 4 cases: locked (padlock + licence dialog), no permission (permission
  dialog), card gone, whole group gone (group numbers must not skip; the column count drops
  accordingly). Tell the user it was a simulation, not a real non-admin account.

## Tab unusable ("Cannot access a chrome-extension:// URL of different extension")

A tab where the user has another tool open on top (such as device-emulation mode) cannot take
commands from the extension, neither JS nor screenshots — do not retry. Open a new tab with
`tabs_create_mcp`, work in that tab, and close it when done. If the user's window is already narrow
(`innerWidth` < 600) you can look at the real thing in the tab without an iframe.

## Check everything before saying it is done

- [ ] View mode **and** edit mode at all 5 sizes (`{ edit: true }`)
- [ ] No horizontal page scroll, and no table overflowing its frame
- [ ] Tables that pick columns/sizes by box width: also measure at 1024, 1180, 1280 (the steps
      change in this range) and resize the iframe live (`f.style.width = "900px"`) to confirm the
      columns swap
- [ ] Search bar: the distance from the search box to the View button is the same at every size
      from tablet up
- [ ] Footer / shell bars do not overlap at mobile and tablet
- [ ] Form header buttons stay on one line at 360 / 390 / 486 in both view and edit mode — count the
      distinct `top` values of the header buttons, which must be 1, and the right edge of the last
      button must not pass the header's right edge
- [ ] Dark mode at one size at least (`{ dark: true }`)
- [ ] Loading skeleton and empty state (no data)
- [ ] Expandable/openable states of list items (both with and without comparison content)
- [ ] Forms: error text under a field · Save then change back within 3 seconds (see "Check real
      clicks")
- [ ] Thai at mobile and 1366 at least · things whose count depends on data, tried at the maximum
      (e.g. 10 scopes)
- [ ] Changed a shared piece (`CompactSection` etc.) → open every page that uses it, not just the
      page you are working on
- [ ] Landing pages: no hard-coded numbers · a card for every menu page · every destination opened ·
      the 4 permission states
- [ ] `bun run typecheck` · `bun run lint` · tests of the folders you touched
- [ ] Anything not checked, any size not opened: tell the user plainly — do not report it as
      complete
