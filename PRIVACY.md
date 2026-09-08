# Privacy Policy — Full Address Bar

_Last updated: 2026-09-08_

Full Address Bar does not collect, store on any server, transmit, sell, or
share any personal or user data.

## What the extension does

The extension reads the URL of the page it runs on only to display it in the
bar. All processing happens locally in your browser — the extension makes no
network requests of any kind, so no page content and no URL is ever sent to
any server or third party.

## Data stored

The only data the extension stores is your own settings: the global on/off
switch, the theme (light/dark/auto), and the list of sites where the bar is
disabled. These three fields are saved with the browser's local extension
storage (`chrome.storage.local`) on your device and are never transmitted
anywhere.

## Permissions

- **`storage`** — to remember the settings listed above.
- **`activeTab`** — used by the toolbar popup to read the current tab's host
  when offering "disable on this site".
- **A content script on all pages** — to show the bar. Chrome describes this
  broad access as "read and change all your data on all websites"; that
  wording is standard for any extension whose content script must run on
  every page, which is exactly what a bar shown on every page requires. The
  script only reads `location.href` and inserts the bar's own UI — it does
  not read or modify page content.

## Remote code

The extension contains no remote code and makes no network requests. All
logic is bundled inside the package and runs entirely offline.

## Contact

Questions or issues: https://github.com/arturminchukov/full-address-bar/issues
