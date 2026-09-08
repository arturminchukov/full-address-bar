# Full Address Bar

<!-- Update the owner/repo slug if you push under a different name. -->
[![CI](https://github.com/arturminchukov/full-address-bar/actions/workflows/ci.yml/badge.svg)](https://github.com/arturminchukov/full-address-bar/actions/workflows/ci.yml)

Browser extension (Chrome + Firefox, Manifest V3) that shows the full current
URL in a bar fixed to the top of every page — useful whenever the browser's
own address bar truncates, hides, or otherwise doesn't show the complete
address you need.

## What it does

A thin bar is inserted at the top of every page and shows the current URL,
percent-decoded for readability (the decoded text is for display only — every
action below always uses the raw address, exactly as the browser reports it).

| Interaction | Result |
| --- | --- |
| Click the URL | Copies the raw address to the clipboard. |
| Double-click the URL | Opens an editable field prefilled with the raw address. |
| `Enter` in the edit field | Navigates to the typed value. |
| `Esc` in the edit field, or clicking away | Cancels the edit, no navigation. |
| `✕` button | Hides the bar for the current page until it is reloaded. |

Typed addresses are interpreted like this: a value with no scheme is assumed
to be `https`; `javascript:`, `data:` and `vbscript:` are refused outright;
anything that still can't be parsed into a URL shows an "Invalid address"
hint instead of navigating.

## Settings

Click the toolbar icon to open the popup:

- **Global on/off** — turns the bar off everywhere.
- **Theme** — light, dark, or auto (follows the OS).
- **Disable on this site** — a one-click button that hides the bar on the
  current tab's host. A disabled entry also covers that host's subdomains.
- **Disabled sites list** — shows every disabled host, each removable
  individually.

Settings apply immediately to already-open tabs — no reload needed.

## Known limitation

The bar is fixed to the top of the page, and the page itself is pushed down
by setting `margin-top` on the document's root element to make room for it.
A site that positions its own header with `position: fixed; top: 0` is not
aware of this shift, so that header will render **underneath** the bar
instead of below it.

## Permissions

The extension requests `storage`, `activeTab`, and a content script that runs
on every page (`<all_urls>`). There is no background script. Chrome shows
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

## License

[MIT](LICENSE) © Artur Minchukou
