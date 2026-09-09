# Full Address Bar — design

Date: 2026-09-08
Status: approved, ready for implementation planning

## Purpose

A browser extension (Chrome + Firefox) that renders a fixed bar at the top of
every page showing the full current URL. Browsers increasingly truncate and
hide the address (scheme, `www.`, query, long paths); this extension makes the
complete address permanently visible, readable, copyable and editable.

Naming: product name **Full Address Bar**, package/slug `full-address-bar`,
repository directory `full-address-bar`.

Architecture follows the sibling project `../git-path-viewer`: esbuild bundling
into `dist-chrome/` and `dist-firefox/`, a shared manifest base with
per-browser overlays, a `core/` layer of pure logic with colocated vitest
tests, and UI mounted inside a Shadow DOM.

## Scope

In scope:

- Fixed bar at the top of the top-level frame of every page.
- Page content is pushed down so the bar never covers it.
- The URL is displayed with percent-decoding applied for readability.
- Single click copies the raw (non-decoded) URL to the clipboard.
- Double click switches the field to edit mode; Enter navigates, Esc cancels.
- A close button hides the bar for the current page until reload.
- Popup with: global on/off toggle, theme (light / dark / auto), a
  "disable on this domain" action and the list of excluded domains.
- Settings are stored locally and applied live, without reloading pages.

Out of scope (explicitly not built):

- Sub-frames (`all_frames: false`); only the top document gets a bar.
- Allow-list mode. The site rules are a deny-list only.
- URL history, search, suggestions or any autocomplete in edit mode.
- Highlighting URL parts by color. Only decoding is applied.
- Syncing settings across devices (`chrome.storage.sync`).

## Decisions

### Page shift strategy

The bar is `position: fixed` at `top: 0`, and the page is pushed down by
setting `margin-top` on `documentElement` equal to the bar height.

Rationale: this is the approach used by real banner-style extensions and works
on the large majority of sites. Known limitation: a site's own sticky header
with `position: fixed; top: 0` will sit underneath our bar. The alternative —
inserting the bar as the first in-flow element of `body` — leaves site headers
intact but scrolls away with the page, which contradicts the requirement that
the bar is always visible.

The strategy is isolated in `content/page-shift.ts` (apply + revert), so it can
be replaced without touching the rest of the code.

### Revealing an auto-hidden bar

The pointer-driven reveal is measured from pointer coordinates, not by placing
a strip at the edge of the viewport.

Rationale: a strip is a hit area, and it would sit exactly where sites put
their own edge-anchored buttons, swallowing clicks meant for them. Listening
for `mousemove` and comparing against the viewport edge costs the page nothing
and leaves those elements clickable. A hidden bar also carries
`pointer-events: none`, so it cannot intercept anything while slid away.

The decision logic lives in `core/reveal-policy.ts` as pure functions
(`pointerAtEdge`, `scrollIntent`); `content/edge-reveal.ts` holds the
listeners. The awkward rules — scroll noise, the grace period before
re-hiding, which edge counts — are then testable against a table of numbers
rather than a live page.

### URL change detection

`content/url-watch.ts` subscribes to `popstate` and `hashchange`, and also
polls `location.href` on a ~250 ms interval to catch SPA navigations.

Rationale: `history.pushState` cannot be patched from a content script's
isolated world (it would require a separate MAIN-world script), and routing the
detection through the background worker with `chrome.tabs.onUpdated` would
require the `tabs` permission plus a messaging layer. Polling is cheaper and
more reliable here.

### Deny-list semantics

Sites are matched by hostname. An entry disables the bar for that host and all
its subdomains (`example.com` also covers `app.example.com`). The default list
is empty, so the bar is shown everywhere.

### Copy semantics

The bar displays the percent-decoded URL, but copies the raw `location.href`.
A decoded string is not guaranteed to be a valid URL when pasted back, so the
copied value must be the original.

## Module structure

```
build.mjs                    esbuild -> dist-chrome / dist-firefox
manifest/base.json           shared MV3 manifest
manifest/chrome.json         chrome overlay
manifest/firefox.json        firefox overlay (browser_specific_settings)
icons/                       generated icon set
scripts/gen-icons.mjs        icon generation
scripts/package.mjs          zip the built extensions
scripts/package-source.mjs   zip the source (AMO submission)
src/
  core/                      pure logic: no DOM, no chrome.*
    url-format.ts            URL parsing + safe percent-decoding
    url-format.test.ts
    site-rules.ts            hostname matching against the deny-list
    site-rules.test.ts
    settings.ts              Settings type, defaults, validation
    settings.test.ts
  ui/
    dom.ts                   el() element helper
    styles.ts                CSS exported as a string (no CSS loader)
    theme.ts                 light / dark / auto resolution
    bar.ts                   builds the bar DOM, takes callbacks
    bar.test.ts              jsdom
  content/
    main.ts                  the only module with side effects
    page-shift.ts            push the page down / revert
    url-watch.ts             subscribe to URL changes
  integration/
    settings-storage.ts      chrome.storage.local + onChanged
  popup/
    popup.html
    popup.ts
```

### Boundaries

- `core/` depends on nothing but the language. Directly unit-testable.
- `ui/bar.ts` builds DOM and accepts callbacks (`onCopy`, `onNavigate`,
  `onHide`); it never touches `chrome.*` or `location`. Testable in jsdom with
  no extension mocks.
- `content/` and `integration/` hold all I/O: the page, storage, navigation.
- No circular dependencies: `content` -> `ui` -> `core`, `content` ->
  `integration` -> `core`.

## Data flow

1. The content script runs at `document_start`.
2. It reads `Settings` through `integration/settings-storage.ts`.
3. `core/site-rules.ts` decides whether the bar applies to this hostname; if
   the extension is globally off or the host is denied, nothing is mounted.
4. A host element is created, `attachShadow({ mode: 'open' })`, styles from
   `ui/styles.ts` are injected, and `ui/bar.ts` builds the bar inside it.
5. `content/page-shift.ts` sets `margin-top` on `documentElement`.
6. `content/url-watch.ts` reports URL changes; `core/url-format.ts` produces
   the display string and the bar text is updated.
7. `chrome.storage.onChanged` re-applies settings live: mount/unmount the bar,
   switch the theme, apply a newly added deny-list entry.

## Interaction model

| Action | Result |
|---|---|
| Single click on the URL | Copy raw `location.href`, show a transient "Copied" hint |
| Double click on the URL | Enter edit mode, text selected |
| Enter (edit mode) | Navigate to the entered value |
| Esc (edit mode) | Revert to display mode with the current URL |
| Blur (edit mode) | Same as Esc |
| `⋯` menu | Position, auto-hide, hide for this page load, turn off on this site |

Edit mode navigates to the entered value as typed, with one normalization: if
it has no scheme, `https://` is prepended. No search fallback, no history
lookup.

## Settings

```ts
interface Settings {
  enabled: boolean;          // global on/off, default true
  theme: 'light' | 'dark' | 'auto';  // default 'auto'
  position: 'top' | 'bottom';        // default 'top'
  autoHide: boolean;         // hide while scrolling, default false
  deniedHosts: string[];     // default []
}
```

`autoHide` implies the bar floats over the page instead of pushing it: a bar
that both moved the page and slid away on scroll would make the content jump
on every scroll, so the two are one setting rather than two.

Stored in `chrome.storage.local` under a single key. Reads are validated
through `core/settings.ts`, which falls back to defaults for anything missing
or malformed, so a corrupted value can never break the bar.

## Error handling

- Storage unavailable (e.g. the bar rendered on a demo page outside the
  extension): fall back to defaults, as `git-path-viewer`'s storage layer does.
- `decodeURIComponent` throws on malformed sequences: `url-format` catches and
  falls back to the raw string, per URL component.
- Clipboard write rejected (no permission / insecure context): show a "Copy
  failed" hint instead of the success hint; never throw into the page.
- Any unexpected failure while mounting must leave the page untouched: the
  shift is applied only after the bar mounts successfully.

## Testing

Vitest, test files colocated with sources.

- `url-format.test.ts` — decoding of path/query/hash, malformed `%` sequences,
  very long query strings, non-http schemes (`data:`, `about:`, `file:`).
- `site-rules.test.ts` — exact host match, subdomain match, non-match of
  lookalike hosts (`notexample.com` vs `example.com`), empty list.
- `settings.test.ts` — defaults, partial objects, wrong types, unknown theme.
- `bar.test.ts` (jsdom) — single click copies, double click enters edit mode,
  Enter emits navigation, Esc reverts, close button emits hide.

Manual verification before release: a static site, a heavy SPA (URL changes
without reload), a site with its own fixed header (documented limitation), and
both browsers loaded unpacked.

## Permissions and privacy

Manifest V3.

- `permissions: ["storage", "activeTab", "clipboardWrite"]` — `activeTab` lets
  the popup read the current tab's host for the "disable on this site" action,
  granted only while the user has the popup open. `clipboardWrite` covers the
  `document.execCommand('copy')` fallback used where `navigator.clipboard` is
  unavailable (insecure contexts); it adds no user-facing warning. No standing
  `host_permissions`, no `tabs`.
- `content_scripts`: `matches: ["<all_urls>"]`, `run_at: "document_start"`,
  `all_frames: false`
- `action` with `default_popup: popup.html`

Chrome will show "read and change all your data on all websites" — unavoidable
for a bar that is present everywhere. `PRIVACY.md` states that nothing is
transmitted anywhere and all settings stay in local extension storage.

## Tooling

Mirrors `git-path-viewer`: TypeScript strict, ESLint, Yarn 4, esbuild.

Scripts: `build`, `watch`, `package`, `package:source`, `typecheck`, `lint`,
`test`, `test:watch`.
