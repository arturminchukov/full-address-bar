# Full Address Bar

<!-- Update the owner/repo slug if you push under a different name. -->
[![CI](https://github.com/arturminchukov/full-address-bar/actions/workflows/ci.yml/badge.svg)](https://github.com/arturminchukov/full-address-bar/actions/workflows/ci.yml)

Browser extension (Chrome + Firefox, Manifest V3) that shows the full current
URL in a bar fixed to the top of every page — useful whenever the browser's
own address bar truncates, hides, or otherwise doesn't show the complete
address you need.

## What it does

A thin bar is inserted at the edge of every page and shows the current URL,
percent-decoded for readability (the decoded text is for display only — every
action below always uses the raw address, exactly as the browser reports it).

| Interaction | Result |
| --- | --- |
| Click the URL | Copies the raw address to the clipboard. |
| Double-click the URL | Opens an editable field prefilled with the raw address. |
| `Enter` in the edit field | Navigates to the typed value. |
| `Esc` in the edit field, or clicking away | Cancels the edit, no navigation. |
| `⋯` button | Opens the bar's menu: position, auto-hide, and the two ways to dismiss it. |

Typed addresses are interpreted like this: a value with no scheme is assumed
to be `https`; `javascript:`, `data:` and `vbscript:` are refused outright;
anything that still can't be parsed into a URL shows an "Invalid address"
hint instead of navigating.

## Settings

The `⋯` menu on the bar itself holds the two layout settings and the two ways
to dismiss it:

- **Position** — top or bottom of the page.
- **Hide while scrolling** — the bar slides away as you scroll down and comes
  back when you scroll up, reach the top of the page, or move the pointer to
  its edge. Once revealed by the pointer, it stays visible until the next
  downward scroll. See [Auto-hide](#auto-hide) below.
- **Hide on this page** — dismisses the bar until the page is reloaded. Move
  the pointer to its edge to bring it back.
- **Turn off on this site** — adds the host to the disabled list for good; the
  same thing the popup's button does.

Click the toolbar icon for the rest:

- **Global on/off** — turns the bar off everywhere.
- **Theme** — light, dark, or auto (follows the OS).
- **Disable on this site** — a one-click button that hides the bar on the
  current tab's host. A disabled entry also covers that host's subdomains.
- **Disabled sites list** — shows every disabled host, each removable
  individually.

Settings apply immediately to already-open tabs — no reload needed.

## Auto-hide

With **Hide while scrolling** on, the bar floats over the page rather than
pushing it down. That pairing is not a choice: a bar that both moved the page
and slid away on scroll would make the content jump every time it moved.

Bringing it back by pointing at the edge is deliberately not implemented with
a strip of pixels at the edge of the window. Such a strip would be a hit area,
sitting exactly where sites like to put their own buttons, and it would
swallow the clicks meant for them. Instead the bar watches pointer movement
and reveals itself when the pointer comes within a few pixels of its edge —
there is no element there to intercept anything, and while the bar is hidden
it takes no pointer events at all. When auto-hide is enabled, the collapse
button beside `⋯` hides it immediately; the next scroll resumes the normal
scroll behavior.

## Known limitation

The bar is fixed to the top of the page, and the page itself is pushed down
by setting `margin-top` on the document's root element to make room for it.
A site that positions its own header with `position: fixed; top: 0` is not
aware of this shift, so that header will render **underneath** the bar
instead of below it.

## Permissions

The extension requests `storage`, `activeTab`, `clipboardWrite`, and a content
script that runs on every page (`<all_urls>`). There is no background script. Chrome shows
this combination as "read and change all your data on all websites" — that
warning is simply what a bar meant to appear on every page requires; see
[PRIVACY.md](PRIVACY.md) for exactly what the extension does and does not do
with that access (nothing is ever transmitted anywhere).

## Install from source

```sh
yarn install
yarn build        # -> dist-chrome/ and dist-firefox/
```

- **Chrome**: open `chrome://extensions`, enable *Developer mode*, click
  *Load unpacked*, and select the `dist-chrome/` folder.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click *Load
  Temporary Add-on*, and select `manifest.json` inside `dist-firefox/`.

## Develop

```sh
yarn watch         # rebuild on change
yarn test          # vitest
yarn typecheck
yarn lint
yarn package        # -> release/full-address-bar-{chrome,firefox}-<version>.zip
yarn package:source  # -> release/full-address-bar-source-<version>.zip
```

`scripts/gen-icons.mjs` regenerates `icons/icon-{16,32,48,128}.png` with no
external dependencies (`node scripts/gen-icons.mjs`); `yarn build` copies
them into each `dist-*/` output.

Set `FAB_VERSION` to stamp a different version into the manifest and the
package zip names, e.g. `FAB_VERSION=0.2.0 yarn package`.

### Build instructions for AMO reviewers

Both of the add-on's scripts are bundled from TypeScript with esbuild, so the
source is submitted alongside the build:

```sh
yarn package:source   # -> release/full-address-bar-source-<version>.zip
```

Reproduce the exact build:

```text
Build environment
- OS: Linux, macOS, or Windows
- Node.js: 24.x
- Yarn: 4.15 (provided via Corepack)

Steps
1. corepack enable
2. yarn install --immutable
3. yarn build

Result
- dist-firefox/content.js  <- src/content/main.ts
- dist-firefox/popup.js    <- src/popup/popup.ts
```

Each output is a standalone IIFE produced by esbuild (version pinned in
`yarn.lock`) with no minification. `build.mjs` merges `manifest/base.json`
with `manifest/firefox.json` to produce the manifest, and copies
`src/popup/popup.html` and `icons/` verbatim. There is no background script.

The store listing copy for both browsers lives in
[docs/store-listing.md](docs/store-listing.md).

## License

[MIT](LICENSE) © Artur Minchukou
