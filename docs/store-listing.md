# Store listing copy

Neither store reads this repository. Everything below is typed by hand into the Chrome Web Store
and AMO dashboards at submission time; this file is only the place where that copy is kept under
version control, so the next submission does not start from a blank page. Keep it in sync whenever
a listing is edited.

The one exception is the short description, which travels inside the package.

---

## Short description (ships in the manifest)

Set in `manifest/base.json`. Both stores show it as the one-line blurb, and so does the browser's
own extensions page. Chrome's limit is **132 characters**.

> Shows the full current URL in a bar at the top of every page. Click to copy, double-click to edit.

(98 characters.)

---

## Chrome Web Store

### Product details

- **Name:** Full Address Bar
- **Category:** Developer Tools
- **Language:** English
- **Store icon:** `icons/icon-128.png` (128×128, uploaded separately from the package)

### Detailed description

> **See the whole address, always.**
>
> Modern browsers hide the address: they drop the scheme, trim `www.`, cut the query string and
> truncate long paths. Full Address Bar puts the complete URL back — in a fixed bar at the top of
> every page, where it stays visible while you work.
>
> **What it does**
>
> • Shows the full current URL, percent-decoded so a Cyrillic or otherwise escaped path reads as
>   text instead of `%D0%BF%D1%83%D1%82%D1%8C`.
> • Follows navigation inside single-page apps, without a reload.
> • Pushes the page down instead of covering it, so nothing is hidden behind the bar.
>
> **How you use it**
>
> • **Click** the URL to copy it. What lands on the clipboard is the raw address, not the decoded
>   display form, so it pastes back as a working link.
> • **Double-click** to edit it in place — Enter navigates, Esc or clicking away cancels.
> • **⋯** opens the bar's own menu: put it at the top or the bottom of the page, have it hide while
>   you scroll, dismiss it for this page, or turn it off on the site for good.
>
> **Settings**
>
> • A global on/off switch.
> • Light, dark, or follow the system theme.
> • Top or bottom of the page, and an optional hide-while-scrolling mode that brings the bar back
>   when you scroll up or move the pointer to its edge.
> • "Disable on this site", plus the list of sites you have disabled. A disabled entry covers that
>   site's subdomains too.
> • Changes apply to tabs that are already open — no reload needed.
>
> **Details that matter in daily use**
>
> • Invisible and right-to-left override characters stay escaped in the display, so a crafted URL
>   cannot render its own address backwards to disguise where you are.
> • A typed address without a scheme is assumed to be `https://`. `javascript:`, `data:` and
>   `vbscript:` are refused rather than executed.
> • Copying works on plain-HTTP pages too, where the clipboard API is unavailable.
>
> **Known limitation**
>
> The bar is fixed to the top of the viewport and the page is pushed down by a margin on the
> document root. A site with its own sticky header pinned to `top: 0` will render underneath the
> bar.
>
> **Privacy**
>
> Full Address Bar makes no network requests of any kind. It has no analytics and loads no remote
> code. The only thing it stores is your three settings, held locally in the browser on your own
> device — see the privacy policy.

### Graphic assets

Ready to upload, in [`store-assets/`](store-assets):

| File | Size | Slot |
| --- | --- | --- |
| `screenshot-1-long-url-1280x800.png` | 1280×800 | Screenshot — a Wikipedia search URL whose query the browser's own address bar would truncate, shown whole and decoded |
| `screenshot-2-decoded-1280x800.png` | 1280×800 | Screenshot — a percent-encoded Cyrillic article path rendered as readable text |
| `screenshot-3-edit-1280x800.png` | 1280×800 | Screenshot — the bar in edit mode, field focused with the raw URL |
| `screenshot-4-popup-1280x800.png` | 1280×800 | Screenshot — the popup over a page, showing the toggle, the theme selector and the list of disabled sites |
| `promo-small-tile-440x280.png` | 440×280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee promo tile |

The four screenshots are captures of the real extension, loaded unpacked into headless Chromium
through `agent-browser --extension dist-chrome` and driven against live Wikipedia pages. The two
tiles are branding graphics rather than captures: [`make-tiles.html`](store-assets/make-tiles.html)
is an exact-size page built from the bar's own dark-theme tokens and `icons/icon-128.png`, which is
then screenshotted — edit that file, not the PNGs. It carries the capture commands in a comment at
the top.

Two things about the popup shot are worth knowing before it is replaced:

- It is a composite. A headless capture holds the page viewport only, never the browser's own
  chrome, so the popup was captured at its natural size and laid over the page capture where the
  popup actually opens. Both halves are real renderings; neither was edited.
- The "Disable on this site" button is absent from it. That button only appears when the popup can
  read the current tab's host, which requires the real popup context that `activeTab` grants —
  a popup opened as an ordinary tab, which is what a headless capture can reach, never shows it.
  A system screenshot of a real window would show that button and is the better long-term asset.

Chrome accepts 640×400 as an alternative screenshot size, but 1280×800 is what the store displays at
full width.

### Privacy tab

**Single purpose**

> Full Address Bar displays the complete URL of the page the user is on, in a bar at the top of that
> page, and lets the user copy or edit it.

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's three settings — the global on/off switch, the theme, and the list of sites the bar is disabled on — locally on the device. Nothing else is stored. |
| `activeTab` | Lets the popup read the host of the tab whose toolbar icon was just clicked, so it can offer "Disable on this site". It is used for nothing else and grants no standing access. |
| `clipboardWrite` | Copying the URL is the extension's primary action. On plain-HTTP pages the asynchronous clipboard API is unavailable, and this permission allows the `document.execCommand('copy')` fallback. |
| Content script on `<all_urls>` | The bar's entire purpose is to be present on every page, so the content script must match every page. It runs in the top frame only (`all_frames: false`). It reads the page's URL and hostname, inserts its own UI element and a top margin on the document root, and does not read or modify the page's own content. |
| Remote code | Not used. All logic is bundled in the package. |

**Data usage:** certify that no user data is collected.

**Privacy policy URL:** a public link to [`PRIVACY.md`](../PRIVACY.md) (the raw file on GitHub is
enough once the repository is public).

---

## Firefox Add-ons (AMO)

On the first submission AMO prefills the name and summary from the manifest; after that both are
edited in the developer hub and no longer follow the manifest.

- **Name:** Full Address Bar
- **Category:** Privacy & Security / Web Development
- **License:** MIT
- **Support site:** the repository's issue tracker

### Summary (limit 250 characters)

> Puts the complete URL back on screen, in a bar at the top of every page — scheme, query and all,
> percent-decoded so it is readable. Click to copy the raw address, double-click to edit it. Works
> in single-page apps. Nothing is collected.

(238 characters.)

### Description

The same copy as the Chrome detailed description above.

### Privacy policy

Paste the text of [`PRIVACY.md`](../PRIVACY.md).

### Notes to reviewer

> The add-on's scripts are bundled from TypeScript with esbuild, so the full source is attached as a
> separate archive (produced by `yarn package:source`). The README's "Build instructions for AMO
> reviewers" section holds the same steps:
>
> Build environment: Node.js 24.x, Yarn 4.15 via Corepack, any OS.
> Steps: `corepack enable`, `yarn install --immutable`, `yarn build`.
>
> The add-on's scripts are `dist-firefox/content.js` and `dist-firefox/popup.js`, each a standalone
> IIFE bundled by esbuild (version pinned in `yarn.lock`) with no minification. Entry points are
> `src/content/main.ts` and `src/popup/popup.ts`. `build.mjs` merges `manifest/base.json` with
> `manifest/firefox.json` to produce the manifest; `src/popup/popup.html` and `icons/` are copied
> verbatim. There is no background script.
>
> The add-on makes no network requests at all and collects nothing: the three settings live in
> `browser.storage.local` on the device.

---

## Before submitting

- [ ] `yarn package` and `yarn package:source` produce the archives for the tagged version.
- [ ] The version in `package.json` and `manifest/base.json` is the one being submitted (AMO refuses
      a version it has seen).
- [ ] Screenshots in `docs/store-assets/` still reflect the current UI (regenerate with the commands
      in `make-tiles.html` and the capture recipe above after any visual change).
- [ ] The privacy policy URL resolves publicly.
- [ ] The README's GitHub badge and issue links point at the real repository — they currently guess
      the slug `arturminchukov/full-address-bar`, because no git remote was configured when they
      were written.
- [ ] The extension has been loaded unpacked in both Chrome and Firefox and exercised by hand.
- [ ] The copy above matches what is actually in the dashboards.
