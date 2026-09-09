# Full Address Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome + Firefox extension that shows a fixed bar with the full, percent-decoded URL at the top of every page, with click-to-copy, double-click-to-edit, a per-page hide button, and a popup for the global toggle, theme and a per-domain deny-list.

**Architecture:** A `document_start` content script mounts a Shadow-DOM bar into the top frame and pushes the page down with `margin-top` on `documentElement`. All decision logic lives in a pure `core/` layer (URL formatting, settings validation, host matching) with colocated vitest tests; DOM building lives in `ui/` and takes callbacks; every side effect (storage, page mutation, navigation) is confined to `content/` and `integration/`. esbuild bundles the entry points into `dist-chrome/` and `dist-firefox/` from a shared manifest base plus per-browser overlays.

**Tech Stack:** TypeScript (strict), esbuild, vitest + jsdom, ESLint, Yarn 4, Manifest V3.

**Spec:** `docs/superpowers/specs/2026-09-08-full-address-bar-design.md`

**Reference implementation:** `../git-path-viewer` — the sibling extension this project mirrors. Copy its build pipeline, tsconfig, eslint config and CI workflow rather than inventing new ones.

## Global Constraints

- Product name **Full Address Bar**; package name `full-address-bar`; CSS class prefix and storage key prefix `fab-`.
- Manifest V3 for both browsers. Chrome minimum version 110, Firefox `strict_min_version` 115.
- Permissions are exactly `["storage", "activeTab"]` plus a `content_scripts` entry matching `<all_urls>` at `document_start` with `all_frames: false`. Never add `tabs`, `scripting` or standing `host_permissions`.
- `core/` must not import from `ui/`, `content/` or `integration/`, and must not reference `document`, `window` or `chrome`.
- `ui/` must not reference `chrome` or `location`; it receives values and callbacks.
- The bar copies the **raw** `location.href`, never the decoded display string.
- TypeScript strict mode; `yarn typecheck`, `yarn lint` and `yarn test` must pass at the end of every task.
- **Commits:** the owner granted per-task commits for this execution run only. Commit with the
  suggested message at the end of each task, under the repository's own git identity
  (`Artur Minchukov <arturminchukov@gmail.com>`, already set locally). Never add a
  `Co-Authored-By` trailer or any "Generated with" line. Never amend or rebase earlier commits.
- The repository is already initialized, `docs/` is already committed on `main`, and work happens
  on the branch `feature/full-address-bar`. Do not run `git init` and do not switch branches.
- `.gitignore` already exists and already ignores `.superpowers/` — keep that entry.

---

### Task 1: Project scaffolding and build pipeline

Deliverable: `yarn build` produces loadable `dist-chrome/` and `dist-firefox/` containing a valid manifest and a content script that mounts a placeholder bar.

**Files:**
- Create: `package.json`, `tsconfig.json`, `.eslintrc.cjs`, `.gitignore`, `.yarnrc.yml`, `build.mjs`
- Create: `manifest/base.json`, `manifest/chrome.json`, `manifest/firefox.json`
- Create: `src/content/main.ts`
- Reference: `../git-path-viewer/build.mjs`, `../git-path-viewer/tsconfig.json`, `../git-path-viewer/.eslintrc.cjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the `yarn build` / `yarn test` / `yarn lint` / `yarn typecheck` scripts and the `src/` layout every later task builds on.

- [ ] **Step 1: Initialize the repository and package manifest**

```bash
cd /Users/arturminchukov/code/personal/full-address-bar
git init
corepack enable
```

Create `package.json`:

```json
{
  "name": "full-address-bar",
  "version": "0.1.0",
  "description": "Browser extension that shows the full current URL in a bar at the top of every page",
  "type": "module",
  "private": true,
  "license": "MIT",
  "author": "Artur Minchukou",
  "scripts": {
    "build": "node build.mjs",
    "watch": "node build.mjs --watch",
    "package": "node build.mjs && node scripts/package.mjs",
    "package:source": "node scripts/package-source.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint \"src/**/*.ts\""
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@typescript-eslint/eslint-plugin": "^7.16.0",
    "@typescript-eslint/parser": "^7.16.0",
    "esbuild": "^0.23.0",
    "eslint": "^8.57.0",
    "jsdom": "^29.1.1",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "packageManager": "yarn@4.15.0"
}
```

Create `.yarnrc.yml`:

```yaml
enableScripts: true

nodeLinker: node-modules
```

Create `.gitignore`:

```
node_modules/
dist-chrome/
dist-firefox/
dist-tsc/
release/
web-ext-artifacts/
.yarn/
*.log
*.zip
.DS_Store
```

Note: unlike `git-path-viewer`, `docs/superpowers/` is **not** ignored here — the spec and this plan are tracked.

Run: `yarn install`

- [ ] **Step 2: Add tsconfig and eslint config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["chrome"],
    "outDir": "dist-tsc",
    "noEmit": true
  },
  "include": ["src", "build.mjs"]
}
```

`.eslintrc.cjs`:

```js
/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { browser: true, es2021: true },
  ignorePatterns: ['dist-chrome/', 'dist-firefox/', 'node_modules/', 'build.mjs'],
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
};
```

- [ ] **Step 3: Write the manifests**

`manifest/base.json`:

```json
{
  "manifest_version": 3,
  "name": "Full Address Bar",
  "version": "0.1.0",
  "description": "Shows the full current URL in a bar at the top of every page. Click to copy, double-click to edit.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": ["storage", "activeTab"],
  "action": {
    "default_title": "Full Address Bar",
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": false
    }
  ]
}
```

`manifest/chrome.json`:

```json
{
  "minimum_chrome_version": "110"
}
```

`manifest/firefox.json`:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "full-address-bar@arturminchukov",
      "strict_min_version": "115.0",
      "data_collection_permissions": {
        "required": ["none"]
      }
    }
  }
}
```

There is no background script in this extension — the popup and the content script talk only through `chrome.storage`.

- [ ] **Step 4: Write build.mjs**

Copy `../git-path-viewer/build.mjs` and change three things: the entry points, the env var name, and drop the background entry.

```js
// Build the extension for Chrome and Firefox into dist-chrome/ and
// dist-firefox/. Bundles the content script and popup with esbuild and merges
// the per-browser manifest with the shared base.

import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const TARGETS = [
  { name: 'chrome', dir: 'dist-chrome', overlay: 'manifest/chrome.json' },
  { name: 'firefox', dir: 'dist-firefox', overlay: 'manifest/firefox.json' },
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeManifest(target) {
  const base = JSON.parse(await readFile(join(root, 'manifest/base.json'), 'utf8'));
  const overlay = JSON.parse(await readFile(join(root, target.overlay), 'utf8'));
  const merged = { ...base, ...overlay };
  // Releases stamp the tag version (e.g. FAB_VERSION=0.2.0) into the manifest.
  if (process.env.FAB_VERSION) merged.version = process.env.FAB_VERSION;
  await writeFile(
    join(root, target.dir, 'manifest.json'),
    JSON.stringify(merged, null, 2) + '\n',
  );
}

async function copyIcons(target) {
  const iconsDir = join(root, 'icons');
  if (await exists(iconsDir)) {
    await cp(iconsDir, join(root, target.dir, 'icons'), { recursive: true });
  }
}

async function buildTarget(target) {
  const outDir = join(root, target.dir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const options = {
    entryPoints: {
      content: join(root, 'src/content/main.ts'),
      popup: join(root, 'src/popup/popup.ts'),
    },
    bundle: true,
    format: 'iife',
    target: target.name === 'firefox' ? 'firefox115' : 'chrome110',
    outdir: outDir,
    sourcemap: watch,
    logLevel: 'info',
  };

  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
  } else {
    await build(options);
  }

  await writeManifest(target);
  await copyIcons(target);
  await cp(join(root, 'src/popup/popup.html'), join(outDir, 'popup.html'));
}

for (const target of TARGETS) {
  await buildTarget(target);
}

if (watch) {
  console.log('Watching for changes… (Ctrl+C to stop)');
}
```

- [ ] **Step 5: Add placeholder entry points so the build has something to bundle**

`src/content/main.ts`:

```ts
// Content-script entry point. This is the only module with side effects.

console.info('[full-address-bar] loaded');
```

`src/popup/popup.ts`:

```ts
// Popup entry point.

console.info('[full-address-bar] popup');
```

`src/popup/popup.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Full Address Bar</title>
  </head>
  <body>
    <script src="popup.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Verify the build**

Run: `yarn build && yarn typecheck && yarn lint`

Expected: `dist-chrome/manifest.json`, `dist-chrome/content.js`, `dist-chrome/popup.js`, `dist-chrome/popup.html` exist, same for `dist-firefox/`, and all three commands exit 0. Confirm with:

```bash
ls dist-chrome dist-firefox
node -e "JSON.parse(require('fs').readFileSync('dist-chrome/manifest.json','utf8'))"
```

- [ ] **Step 7: Stage and report**

```bash
git add -A
```

Suggested message: `chore: scaffold Full Address Bar extension build`. Do not commit — report the message and let the owner commit.

---

### Task 2: URL formatting (core)

Deliverable: a pure function that turns a raw URL into the display string, decoding percent-escapes safely.

**Files:**
- Create: `src/core/url-format.ts`
- Test: `src/core/url-format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatUrl(raw: string): UrlDisplay` where `interface UrlDisplay { raw: string; display: string }`, and `decodePercent(value: string): string`.
- Also produces (added during execution, see Task 7's fix round): `toNavigableUrl(value: string): string | null` — turns a value typed into the bar into a URL worth navigating to, assuming `https://` when no scheme is present, refusing `javascript:`, `data:` and `vbscript:`, and refusing anything `new URL` cannot parse.

- [ ] **Step 1: Write the failing test**

`src/core/url-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodePercent, formatUrl } from './url-format';

describe('decodePercent', () => {
  it('decodes a percent-encoded UTF-8 run', () => {
    expect(decodePercent('/%D0%BF%D1%83%D1%82%D1%8C')).toBe('/путь');
  });

  it('decodes runs inside a query string', () => {
    expect(decodePercent('?q=%D0%B4%D0%BE%D0%BC&page=2')).toBe('?q=дом&page=2');
  });

  it('leaves a malformed escape untouched', () => {
    expect(decodePercent('/a%ZZb')).toBe('/a%ZZb');
  });

  it('leaves an invalid UTF-8 sequence untouched', () => {
    expect(decodePercent('/%E0%A4%A')).toBe('/%E0%A4%A');
    expect(decodePercent('/%FF')).toBe('/%FF');
  });

  it('does not turn + into a space', () => {
    expect(decodePercent('?q=a+b')).toBe('?q=a+b');
  });

  it('returns an unescaped string unchanged', () => {
    expect(decodePercent('https://example.com/a/b')).toBe('https://example.com/a/b');
  });
});

describe('formatUrl', () => {
  it('keeps the raw value alongside the display value', () => {
    const raw = 'https://example.com/%D0%B0?q=%D0%B1#%D0%B2';
    expect(formatUrl(raw)).toEqual({
      raw,
      display: 'https://example.com/а?q=б#в',
    });
  });

  it('passes non-http schemes through the same decoder', () => {
    expect(formatUrl('file:///Users/me/%D1%84.txt').display).toBe('file:///Users/me/ф.txt');
    expect(formatUrl('about:blank').display).toBe('about:blank');
  });

  it('skips decoding for very long values', () => {
    const raw = 'data:text/plain,' + '%D0%B0'.repeat(1000);
    expect(raw.length).toBeGreaterThan(4096);
    expect(formatUrl(raw).display).toBe(raw);
  });

  it('handles the empty string', () => {
    expect(formatUrl('')).toEqual({ raw: '', display: '' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/core/url-format.test.ts`
Expected: FAIL — cannot resolve `./url-format`.

- [ ] **Step 3: Implement**

`src/core/url-format.ts`:

```ts
// Turns a raw URL into the string shown in the bar. The bar displays a
// percent-decoded URL for readability, but every consumer that needs a usable
// address (copy, navigation) uses the raw value.

export interface UrlDisplay {
  /** The address exactly as the browser reports it. */
  raw: string;
  /** Percent-decoded for display only; not guaranteed to be a valid URL. */
  display: string;
}

// Above this length decoding costs more than it helps (long data: URLs).
const MAX_DECODE_LENGTH = 4096;

// One or more consecutive %XX escapes: a full UTF-8 code point never spans
// two separate runs, so decoding run by run is safe.
const PERCENT_RUN = /(?:%[0-9A-Fa-f]{2})+/g;

/**
 * Decode percent-escapes, leaving anything malformed exactly as it was.
 * Unlike `decodeURIComponent` this never throws, and unlike form decoding it
 * does not treat `+` as a space.
 */
export function decodePercent(value: string): string {
  return value.replace(PERCENT_RUN, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
}

export function formatUrl(raw: string): UrlDisplay {
  if (raw.length > MAX_DECODE_LENGTH) return { raw, display: raw };
  return { raw, display: decodePercent(raw) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run src/core/url-format.test.ts && yarn typecheck && yarn lint`
Expected: all tests PASS, both checks exit 0.

- [ ] **Step 5: Stage and report**

```bash
git add src/core/url-format.ts src/core/url-format.test.ts
```

Suggested message: `feat(core): add safe percent-decoding URL formatter`.

---

### Task 3: Settings model (core)

Deliverable: the `Settings` type, its defaults, and a validator that never throws on corrupted stored data.

**Files:**
- Create: `src/core/settings.ts`
- Test: `src/core/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Theme = 'light' | 'dark' | 'auto'`
  - `interface Settings { enabled: boolean; theme: Theme; deniedHosts: string[] }`
  - `const DEFAULT_SETTINGS: Settings`
  - `function parseSettings(value: unknown): Settings`

- [ ] **Step 1: Write the failing test**

`src/core/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('returns the defaults for undefined', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the defaults for a non-object', () => {
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing fields from the defaults', () => {
    expect(parseSettings({ enabled: false })).toEqual({
      enabled: false,
      theme: 'auto',
      deniedHosts: [],
    });
  });

  it('rejects a wrongly typed enabled flag', () => {
    expect(parseSettings({ enabled: 'yes' }).enabled).toBe(true);
  });

  it('rejects an unknown theme', () => {
    expect(parseSettings({ theme: 'solarized' }).theme).toBe('auto');
  });

  it('accepts every known theme', () => {
    expect(parseSettings({ theme: 'light' }).theme).toBe('light');
    expect(parseSettings({ theme: 'dark' }).theme).toBe('dark');
    expect(parseSettings({ theme: 'auto' }).theme).toBe('auto');
  });

  it('keeps only string entries in deniedHosts', () => {
    expect(parseSettings({ deniedHosts: ['a.com', 42, null, 'b.com'] }).deniedHosts).toEqual([
      'a.com',
      'b.com',
    ]);
  });

  it('replaces a non-array deniedHosts with an empty list', () => {
    expect(parseSettings({ deniedHosts: 'a.com' }).deniedHosts).toEqual([]);
  });

  it('does not share the default array between results', () => {
    const a = parseSettings(undefined);
    a.deniedHosts.push('x.com');
    expect(parseSettings(undefined).deniedHosts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/core/settings.test.ts`
Expected: FAIL — cannot resolve `./settings`.

- [ ] **Step 3: Implement**

`src/core/settings.ts`:

```ts
// The extension's persisted settings, with a validator that tolerates any
// stored value: corrupted storage must never break the bar.

export type Theme = 'light' | 'dark' | 'auto';

const THEMES: readonly Theme[] = ['light', 'dark', 'auto'];

export interface Settings {
  /** Global on/off switch. */
  enabled: boolean;
  theme: Theme;
  /** Hosts the bar is suppressed on, including their subdomains. */
  deniedHosts: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  theme: 'auto',
  deniedHosts: [],
};

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme);
}

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS, deniedHosts: [] };
  const raw = value as Partial<Record<keyof Settings, unknown>>;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    deniedHosts: Array.isArray(raw.deniedHosts)
      ? raw.deniedHosts.filter((host): host is string => typeof host === 'string')
      : [],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run src/core/settings.test.ts && yarn typecheck && yarn lint`
Expected: PASS, exit 0.

- [ ] **Step 5: Stage and report**

```bash
git add src/core/settings.ts src/core/settings.test.ts
```

Suggested message: `feat(core): add settings model with tolerant validation`.

---

### Task 4: Deny-list host matching (core)

Deliverable: hostname normalization for popup input and the deny-list match used by the content script.

**Files:**
- Create: `src/core/site-rules.ts`
- Test: `src/core/site-rules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `function normalizeHost(input: string): string | null`
  - `function isDenied(hostname: string, deniedHosts: readonly string[]): boolean`

- [ ] **Step 1: Write the failing test**

`src/core/site-rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isDenied, normalizeHost } from './site-rules';

describe('normalizeHost', () => {
  it('lowercases a bare host', () => {
    expect(normalizeHost('Example.COM')).toBe('example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHost('  example.com  ')).toBe('example.com');
  });

  it('extracts the host from a full URL', () => {
    expect(normalizeHost('https://sub.example.com/path?q=1')).toBe('sub.example.com');
  });

  it('drops a trailing slash and path from a bare host', () => {
    expect(normalizeHost('example.com/path')).toBe('example.com');
  });

  it('strips leading dots', () => {
    expect(normalizeHost('.example.com')).toBe('example.com');
  });

  it('keeps a port out of the stored host', () => {
    expect(normalizeHost('localhost:3000')).toBe('localhost');
  });

  it('rejects empty and whitespace-only input', () => {
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
  });

  it('rejects input with inner spaces', () => {
    expect(normalizeHost('exa mple.com')).toBeNull();
  });

  it('keeps a bracketed IPv6 literal intact', () => {
    expect(normalizeHost('[2001:db8::1]')).toBe('[2001:db8::1]');
    expect(normalizeHost('[::1]')).toBe('[::1]');
  });

  it('strips scheme, port and path around an IPv6 literal', () => {
    expect(normalizeHost('http://[2001:db8::1]:8080/path?q=1')).toBe('[2001:db8::1]');
  });

  it('returns null for a scheme that carries no host', () => {
    expect(normalizeHost('about:blank')).toBeNull();
    expect(normalizeHost('mailto:someone@example.com')).toBeNull();
  });

  it('still reads a bare host:port as a host', () => {
    expect(normalizeHost('example.com:8080/path')).toBe('example.com');
  });
});

describe('isDenied', () => {
  it('is false for an empty list', () => {
    expect(isDenied('example.com', [])).toBe(false);
  });

  it('matches the exact host', () => {
    expect(isDenied('example.com', ['example.com'])).toBe(true);
  });

  it('matches a subdomain of a listed host', () => {
    expect(isDenied('app.example.com', ['example.com'])).toBe(true);
    expect(isDenied('a.b.example.com', ['example.com'])).toBe(true);
  });

  it('does not match a lookalike host', () => {
    expect(isDenied('notexample.com', ['example.com'])).toBe(false);
    expect(isDenied('example.com.evil.net', ['example.com'])).toBe(false);
  });

  it('does not match a parent of a listed host', () => {
    expect(isDenied('example.com', ['app.example.com'])).toBe(false);
  });

  it('is case insensitive on both sides', () => {
    expect(isDenied('APP.Example.com', ['example.COM'])).toBe(true);
  });

  it('ignores unnormalizable entries', () => {
    expect(isDenied('example.com', ['', '  ', 'example.com'])).toBe(true);
  });

  it('does not confuse distinct IPv6 hosts', () => {
    expect(isDenied('[2001:db8::1]', ['[2001:db8::9999]'])).toBe(false);
    expect(isDenied('[::2]', ['[::1]'])).toBe(false);
  });

  it('matches an IPv6 host against its own entry', () => {
    expect(isDenied('[2001:db8::1]', ['[2001:db8::1]'])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/core/site-rules.test.ts`
Expected: FAIL — cannot resolve `./site-rules`.

- [ ] **Step 3: Implement**

`src/core/site-rules.ts`:

```ts
// Deny-list matching. An entry suppresses the bar on that host and on every
// subdomain of it; the list is empty by default, so the bar is shown
// everywhere until the user opts a site out.

/**
 * Reduce user input (a bare host, a pasted URL, stray whitespace) to a
 * storable hostname, or null when it cannot be one.
 */
// A scheme with no "//" (about:blank, mailto:) carries no host at all. The
// lookahead keeps "localhost:3000" out of this branch: a bare port is digits.
const SCHEME_WITHOUT_AUTHORITY = /^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/;
// A bracketed IPv6 literal, which is what location.hostname reports for one.
const IPV6_LITERAL = /^\[[0-9a-f:.]+\]/;

export function normalizeHost(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  const schemeEnd = value.indexOf('://');
  if (schemeEnd !== -1) value = value.slice(schemeEnd + 3);
  else if (SCHEME_WITHOUT_AUTHORITY.test(value)) return null;

  // Everything from the first path, query or fragment separator is not host.
  value = value.split(/[/?#]/, 1)[0];
  // Credentials, then port — but an IPv6 literal is colons all the way down,
  // so it keeps its brackets and only a trailing :port is cut.
  value = value.slice(value.lastIndexOf('@') + 1);
  const ipv6 = IPV6_LITERAL.exec(value);
  if (ipv6) value = ipv6[0];
  else value = value.split(':', 1)[0].replace(/^\.+/, '').replace(/\.+$/, '');

  if (!value || /\s/.test(value)) return null;
  return value;
}

export function isDenied(hostname: string, deniedHosts: readonly string[]): boolean {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return deniedHosts.some((entry) => {
    const denied = normalizeHost(entry);
    if (!denied) return false;
    return host === denied || host.endsWith(`.${denied}`);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run src/core/site-rules.test.ts && yarn typecheck && yarn lint`
Expected: PASS, exit 0.

- [ ] **Step 5: Stage and report**

```bash
git add src/core/site-rules.ts src/core/site-rules.test.ts
```

Suggested message: `feat(core): add deny-list host matching`.

---

### Task 5: The bar UI

Deliverable: `renderBar()` builds the whole bar as DOM and wires its interactions, taking callbacks and touching nothing outside its own subtree.

**Files:**
- Create: `src/ui/dom.ts` (copy verbatim from `../git-path-viewer/src/ui/dom.ts`)
- Create: `src/ui/styles.ts`
- Create: `src/ui/bar.ts`
- Test: `src/ui/bar.test.ts`

**Interfaces:**
- Consumes: `Theme` from `src/core/settings.ts`.
- Produces:
  - `const STYLES: string` from `src/ui/styles.ts`
  - `const BAR_HEIGHT = 28` from `src/ui/bar.ts`
  - `interface BarCallbacks { onCopy(): void; onNavigate(value: string): void; onHide(): void }`
  - `interface BarHandle { element: HTMLElement; setUrl(display: string, raw: string): void; showHint(text: string): void; setTheme(theme: Exclude<Theme, 'auto'>): void }`
  - `function renderBar(callbacks: BarCallbacks): BarHandle`

Interaction detail that the test pins down: a single click copies, but only after `CLICK_DELAY_MS` (250 ms), so that a double click cancels the pending copy and opens edit mode instead.

- [ ] **Step 1: Copy the DOM helper**

```bash
mkdir -p src/ui
cp ../git-path-viewer/src/ui/dom.ts src/ui/dom.ts
```

- [ ] **Step 2: Write the failing test**

`src/ui/bar.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBar, type BarCallbacks } from './bar';

function setup(overrides: Partial<BarCallbacks> = {}) {
  const calls = { copy: 0, navigate: [] as string[], hide: 0 };
  const bar = renderBar({
    onCopy: () => {
      calls.copy += 1;
    },
    onNavigate: (value) => {
      calls.navigate.push(value);
    },
    onHide: () => {
      calls.hide += 1;
    },
    ...overrides,
  });
  document.body.append(bar.element);
  bar.setUrl('https://example.com/путь', 'https://example.com/%D0%BF%D1%83%D1%82%D1%8C');

  const text = bar.element.querySelector('.fab-url') as HTMLElement;
  const input = bar.element.querySelector('.fab-input') as HTMLInputElement;
  const close = bar.element.querySelector('.fab-close') as HTMLButtonElement;
  return { bar, calls, text, input, close };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('renderBar', () => {
  it('shows the decoded URL and hides the input initially', () => {
    const { text, input } = setup();
    expect(text.textContent).toBe('https://example.com/путь');
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
  });

  it('copies on a single click, after the double-click window', () => {
    const { text, calls } = setup();
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.copy).toBe(0);
    vi.advanceTimersByTime(250);
    expect(calls.copy).toBe(1);
  });

  it('does not copy when the click becomes a double click', () => {
    const { text, calls, input } = setup();
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(calls.copy).toBe(0);
    expect(input.hidden).toBe(false);
  });

  it('opens edit mode prefilled with the raw URL', () => {
    const { text, input } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(input.hidden).toBe(false);
    expect(input.value).toBe('https://example.com/%D0%BF%D1%83%D1%82%D1%8C');
  });

  it('navigates on Enter with the entered value', () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = 'https://other.test/x';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls.navigate).toEqual(['https://other.test/x']);
  });

  it('does not navigate on Enter with an empty value', () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = '   ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls.navigate).toEqual([]);
  });

  it('reverts to display mode on Escape', () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = 'typed but abandoned';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
    expect(calls.navigate).toEqual([]);
  });

  it('reverts to display mode on blur', () => {
    const { text, input } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
  });

  it('does not overwrite the input while the user is editing', () => {
    const { bar, text, input } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = 'half-typed';
    bar.setUrl('https://later.test/', 'https://later.test/');
    expect(input.value).toBe('half-typed');
  });

  it('reports the close button', () => {
    const { close, calls } = setup();
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.hide).toBe(1);
  });

  it('cancels a pending copy when the bar is closed', () => {
    const { text, close, calls } = setup();
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(calls.hide).toBe(1);
    expect(calls.copy).toBe(0);
  });

  it('shows a transient hint', () => {
    const { bar } = setup();
    const hint = bar.element.querySelector('.fab-hint') as HTMLElement;
    bar.showHint('Copied');
    expect(hint.textContent).toBe('Copied');
    expect(hint.hidden).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(hint.hidden).toBe(true);
  });

  it('applies the theme as a data attribute', () => {
    const { bar } = setup();
    bar.setTheme('dark');
    expect(bar.element.dataset.theme).toBe('dark');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn vitest run src/ui/bar.test.ts`
Expected: FAIL — cannot resolve `./bar`.

- [ ] **Step 4: Write the styles**

`src/ui/styles.ts`:

```ts
// All bar styles, scoped inside the Shadow DOM root and exported as a string
// so the build needs no CSS loader. Themes are driven by `data-theme` on the
// bar element.

export const STYLES = /* css */ `
:host {
  all: initial;
}
.fab-bar {
  --bg: #f6f8fa;
  --border: #d0d7de;
  --text: #1f2328;
  --text-muted: #656d76;
  --accent: #0969da;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 28px;
  padding: 0 8px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font: 12px/1 var(--font-mono);
}
.fab-bar[data-theme="dark"] {
  --bg: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent: #58a6ff;
}
.fab-url {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  user-select: none;
}
.fab-input {
  flex: 1;
  min-width: 0;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font: inherit;
}
.fab-hint {
  color: var(--text-muted);
}
.fab-close {
  padding: 0 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.fab-close:hover {
  color: var(--text);
}
[hidden] {
  display: none !important;
}
`;
```

- [ ] **Step 5: Implement the bar**

`src/ui/bar.ts`:

```ts
// Builds the bar DOM and wires its interactions. Knows nothing about storage,
// the page, or navigation: every effect goes out through a callback.

import type { Theme } from '../core/settings';
import { el } from './dom';

/** Bar height in px. The page shift must match this exactly. */
export const BAR_HEIGHT = 28;

// A single click copies; a double click edits. The copy waits out this window
// so a double click can cancel it.
const CLICK_DELAY_MS = 250;
const HINT_MS = 1500;

export interface BarCallbacks {
  onCopy(): void;
  onNavigate(value: string): void;
  onHide(): void;
}

export interface BarHandle {
  element: HTMLElement;
  /** `display` is shown; `raw` prefills the edit field. */
  setUrl(display: string, raw: string): void;
  showHint(text: string): void;
  setTheme(theme: Exclude<Theme, 'auto'>): void;
}

export function renderBar(callbacks: BarCallbacks): BarHandle {
  const text = el('span', {
    class: 'fab-url',
    title: 'Click to copy · double-click to edit',
  });
  const input = el('input', {
    class: 'fab-input',
    type: 'text',
    spellcheck: 'false',
    'aria-label': 'Edit address',
    hidden: true,
  }) as HTMLInputElement;
  const hint = el('span', { class: 'fab-hint', hidden: true });
  const close = el('button', {
    class: 'fab-close',
    type: 'button',
    title: 'Hide the bar on this page',
    'aria-label': 'Hide the bar on this page',
    text: '✕',
  }) as HTMLButtonElement;

  const bar = el('div', { class: 'fab-bar', role: 'toolbar' }, [text, input, hint, close]);

  let raw = '';
  let editing = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const stopEditing = () => {
    editing = false;
    input.hidden = true;
    text.hidden = false;
  };

  const startEditing = () => {
    editing = true;
    input.value = raw;
    text.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  };

  text.addEventListener('click', () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => callbacks.onCopy(), CLICK_DELAY_MS);
  });

  text.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    startEditing();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const value = input.value.trim();
      if (!value) return;
      stopEditing();
      callbacks.onNavigate(value);
    } else if (event.key === 'Escape') {
      stopEditing();
    }
  });

  input.addEventListener('blur', stopEditing);

  close.addEventListener('click', () => {
    // Dismissing the bar cancels anything it still had scheduled: a pending
    // copy must not reach the clipboard after the user closed the bar.
    clearTimeout(clickTimer);
    clearTimeout(hintTimer);
    callbacks.onHide();
  });

  return {
    element: bar,
    setUrl(display, rawUrl) {
      raw = rawUrl;
      text.textContent = display;
      // Never clobber a half-typed address under the user's cursor.
      if (!editing) input.value = rawUrl;
    },
    showHint(message) {
      clearTimeout(hintTimer);
      hint.textContent = message;
      hint.hidden = false;
      hintTimer = setTimeout(() => {
        hint.hidden = true;
      }, HINT_MS);
    },
    setTheme(theme) {
      bar.dataset.theme = theme;
    },
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn vitest run src/ui/bar.test.ts && yarn typecheck && yarn lint`
Expected: all PASS, exit 0.

- [ ] **Step 7: Stage and report**

```bash
git add src/ui
```

Suggested message: `feat(ui): add the address bar component`.

---

### Task 6: Page shift and URL watching

Deliverable: the two page-level side-effect modules, each reversible and independently testable.

**Files:**
- Create: `src/content/page-shift.ts`
- Test: `src/content/page-shift.test.ts`
- Create: `src/content/url-watch.ts`
- Test: `src/content/url-watch.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface PageShift { apply(heightPx: number): void; revert(): void }`
  - `function createPageShift(doc: Document): PageShift`
  - `function watchUrl(target: Window, onChange: (href: string) => void, intervalMs?: number): () => void`

- [ ] **Step 1: Write the failing page-shift test**

`src/content/page-shift.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createPageShift } from './page-shift';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('createPageShift', () => {
  it('pushes the document down by the given height', () => {
    createPageShift(document).apply(28);
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('28px');
    expect(document.documentElement.style.getPropertyPriority('margin-top')).toBe('important');
  });

  it('restores an absent inline margin on revert', () => {
    const shift = createPageShift(document);
    shift.apply(28);
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('');
  });

  it('restores a pre-existing inline margin on revert', () => {
    document.documentElement.style.marginTop = '10px';
    const shift = createPageShift(document);
    shift.apply(28);
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('28px');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });

  it('is idempotent: applying twice still reverts to the original', () => {
    document.documentElement.style.marginTop = '10px';
    const shift = createPageShift(document);
    shift.apply(28);
    shift.apply(28);
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });

  it('reverting without applying does nothing', () => {
    document.documentElement.style.marginTop = '10px';
    createPageShift(document).revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn vitest run src/content/page-shift.test.ts`
Expected: FAIL — cannot resolve `./page-shift`.

- [ ] **Step 3: Implement page-shift**

`src/content/page-shift.ts`:

```ts
// Pushes the page down so the fixed bar never covers content. Isolated here
// because it is the one strategy most likely to need revisiting: sites with
// their own `position: fixed; top: 0` header will render underneath the bar.

export interface PageShift {
  apply(heightPx: number): void;
  revert(): void;
}

export function createPageShift(doc: Document): PageShift {
  const root = doc.documentElement;
  let previous: { value: string; priority: string } | null = null;

  return {
    apply(heightPx) {
      // Remember the page's own inline margin once, not on every re-apply.
      previous ??= {
        value: root.style.getPropertyValue('margin-top'),
        priority: root.style.getPropertyPriority('margin-top'),
      };
      root.style.setProperty('margin-top', `${heightPx}px`, 'important');
    },
    revert() {
      if (!previous) return;
      root.style.removeProperty('margin-top');
      if (previous.value) {
        root.style.setProperty('margin-top', previous.value, previous.priority);
      }
      previous = null;
    },
  };
}
```

- [ ] **Step 4: Write the failing url-watch test**

`src/content/url-watch.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchUrl } from './url-watch';

// A minimal stand-in for `window`: the poll reads `location.href` off it and
// the listeners are registered on it, which is all watchUrl uses.
function fakeWindow(href: string) {
  const listeners = new Map<string, () => void>();
  return {
    location: { href },
    addEventListener(type: string, fn: () => void) {
      listeners.set(type, fn);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    fire(type: string) {
      listeners.get(type)?.();
    },
    has(type: string) {
      return listeners.has(type);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('watchUrl', () => {
  it('does not report the initial URL', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    expect(seen).toEqual([]);
  });

  it('reports a change picked up by polling', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    win.location.href = 'https://a.test/next';
    vi.advanceTimersByTime(250);
    expect(seen).toEqual(['https://a.test/next']);
  });

  it('reports at most once per distinct URL', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    win.location.href = 'https://a.test/next';
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(['https://a.test/next']);
  });

  it('reports immediately on popstate and hashchange', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    win.location.href = 'https://a.test/#one';
    win.fire('hashchange');
    win.location.href = 'https://a.test/two';
    win.fire('popstate');
    expect(seen).toEqual(['https://a.test/#one', 'https://a.test/two']);
  });

  it('stops polling and unsubscribes when disposed', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    const stop = watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    stop();
    win.location.href = 'https://a.test/next';
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
    expect(win.has('popstate')).toBe(false);
    expect(win.has('hashchange')).toBe(false);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `yarn vitest run src/content/url-watch.test.ts`
Expected: FAIL — cannot resolve `./url-watch`.

- [ ] **Step 6: Implement url-watch**

`src/content/url-watch.ts`:

```ts
// Reports URL changes within a single page load. `history.pushState` cannot be
// patched from the content script's isolated world, so SPA navigations are
// caught by a cheap poll on top of the two native events.

const DEFAULT_INTERVAL_MS = 250;

/** Subscribe to URL changes. Returns an unsubscribe function. */
export function watchUrl(
  target: Window,
  onChange: (href: string) => void,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): () => void {
  let last = target.location.href;

  const check = () => {
    const href = target.location.href;
    if (href === last) return;
    last = href;
    onChange(href);
  };

  target.addEventListener('popstate', check);
  target.addEventListener('hashchange', check);
  const timer = setInterval(check, intervalMs);

  return () => {
    clearInterval(timer);
    target.removeEventListener('popstate', check);
    target.removeEventListener('hashchange', check);
  };
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `yarn vitest run src/content && yarn typecheck && yarn lint`
Expected: all PASS, exit 0.

- [ ] **Step 8: Stage and report**

```bash
git add src/content/page-shift.ts src/content/page-shift.test.ts src/content/url-watch.ts src/content/url-watch.test.ts
```

Suggested message: `feat(content): add page shift and URL watching`.

---

### Task 7: Settings storage and content-script wiring

Deliverable: the bar actually appears on real pages, tracks navigation, copies, edits, hides, and reacts live to settings changes.

**Files:**
- Create: `src/integration/settings-storage.ts`
- Create: `src/ui/theme.ts`
- Test: `src/ui/theme.test.ts`
- Modify: `src/content/main.ts` (replace the Task 1 placeholder entirely)

**Interfaces:**
- Consumes: `formatUrl` (Task 2), `Settings`/`DEFAULT_SETTINGS`/`parseSettings`/`Theme` (Task 3), `isDenied` (Task 4), `renderBar`/`BAR_HEIGHT`/`STYLES` (Task 5), `createPageShift`/`watchUrl` (Task 6).
- Produces:
  - `const SETTINGS_KEY = 'fab-settings'`
  - `interface SettingsStore { load(): Promise<Settings>; save(patch: Partial<Settings>): Promise<void>; subscribe(fn: (settings: Settings) => void): () => void }`
  - `function createSettingsStore(): SettingsStore`
  - `function resolveTheme(theme: Theme): 'light' | 'dark'`

- [ ] **Step 1: Write the failing theme test**

`src/ui/theme.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme } from './theme';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );
}

describe('resolveTheme', () => {
  it('passes an explicit theme through', () => {
    stubPrefersDark(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('follows the OS preference for auto', () => {
    stubPrefersDark(true);
    expect(resolveTheme('auto')).toBe('dark');
    stubPrefersDark(false);
    expect(resolveTheme('auto')).toBe('light');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('auto')).toBe('light');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn vitest run src/ui/theme.test.ts`
Expected: FAIL — cannot resolve `./theme`.

- [ ] **Step 3: Implement the theme resolver**

`src/ui/theme.ts`:

```ts
// Resolves the stored theme preference to the concrete theme to render.

import type { Theme } from '../core/settings';

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return prefersDark() ? 'dark' : 'light';
}
```

- [ ] **Step 4: Implement the settings store**

`src/integration/settings-storage.ts`:

```ts
// The single I/O boundary for settings: reads, writes and change
// notifications, all validated through core/settings so a corrupted value can
// never reach the UI. Falls back to defaults when extension storage is
// unavailable (e.g. running the bar on a plain page during development).

import { parseSettings, type Settings } from '../core/settings';

export const SETTINGS_KEY = 'fab-settings';

export interface SettingsStore {
  load(): Promise<Settings>;
  save(patch: Partial<Settings>): Promise<void>;
  /** Subscribe to external changes. Returns an unsubscribe function. */
  subscribe(fn: (settings: Settings) => void): () => void;
}

export function createSettingsStore(): SettingsStore {
  const area = globalThis.chrome?.storage?.local;

  async function load(): Promise<Settings> {
    if (!area) return parseSettings(undefined);
    try {
      const stored = await area.get(SETTINGS_KEY);
      return parseSettings(stored?.[SETTINGS_KEY]);
    } catch {
      return parseSettings(undefined);
    }
  }

  return {
    load,

    async save(patch) {
      if (!area) return;
      const current = await load();
      const next: Settings = { ...current, ...patch };
      await area.set({ [SETTINGS_KEY]: next });
    },

    subscribe(fn) {
      const onChanged = globalThis.chrome?.storage?.onChanged;
      if (!onChanged) return () => undefined;
      const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName !== 'local' || !(SETTINGS_KEY in changes)) return;
        fn(parseSettings(changes[SETTINGS_KEY].newValue));
      };
      onChanged.addListener(listener);
      return () => onChanged.removeListener(listener);
    },
  };
}
```

- [ ] **Step 5: Wire the content script**

Replace `src/content/main.ts` in full:

```ts
// Content-script entry point. This is the only module in the content bundle
// with side effects: it reads settings, mounts the bar into a Shadow DOM host,
// shifts the page, and keeps both in sync with navigation and settings.

import type { Settings } from '../core/settings';
import { isDenied } from '../core/site-rules';
import { formatUrl, toNavigableUrl } from '../core/url-format';
import { createSettingsStore } from '../integration/settings-storage';
import { BAR_HEIGHT, renderBar, type BarHandle } from '../ui/bar';
import { STYLES } from '../ui/styles';
import { resolveTheme } from '../ui/theme';
import { createPageShift } from './page-shift';
import { watchUrl } from './url-watch';

const HOST_ID = 'full-address-bar-host';

const store = createSettingsStore();
const shift = createPageShift(document);

let host: HTMLElement | null = null;
let bar: BarHandle | null = null;
let stopWatching: (() => void) | null = null;
// Set by the close button: the bar stays down for this page load only.
let hiddenForThisPage = false;

function currentUrl(): void {
  if (!bar) return;
  const { raw, display } = formatUrl(location.href);
  bar.setUrl(display, raw);
}

async function copyUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(location.href);
    bar?.showHint('Copied');
  } catch {
    bar?.showHint('Copy failed');
  }
}

function navigate(value: string): void {
  const target = toNavigableUrl(value);
  if (!target) {
    bar?.showHint('Invalid address');
    return;
  }
  location.assign(target);
}

function mount(settings: Settings): void {
  if (host) return;

  const handle = renderBar({
    onCopy: () => void copyUrl(),
    onNavigate: navigate,
    onHide: () => {
      hiddenForThisPage = true;
      unmount();
    },
  });
  handle.setTheme(resolveTheme(settings.theme));

  const element = document.createElement('div');
  element.id = HOST_ID;
  const shadow = element.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.append(style, handle.element);
  document.documentElement.append(element);

  // Publish state only once the DOM work has succeeded: a failure above must
  // leave nothing wedged behind, so a later settings change can retry.
  host = element;
  bar = handle;
  // Shift only after a successful mount, so a failure leaves the page intact.
  shift.apply(BAR_HEIGHT);

  currentUrl();
  stopWatching = watchUrl(window, () => currentUrl());
}

function unmount(): void {
  stopWatching?.();
  stopWatching = null;
  shift.revert();
  host?.remove();
  host = null;
  bar = null;
}

function applies(settings: Settings): boolean {
  if (hiddenForThisPage) return false;
  if (!settings.enabled) return false;
  return !isDenied(location.hostname, settings.deniedHosts);
}

function sync(settings: Settings): void {
  try {
    if (applies(settings)) {
      mount(settings);
      bar?.setTheme(resolveTheme(settings.theme));
    } else {
      unmount();
    }
  } catch (err) {
    // Never leave the page half-modified, and never wedge the module: unmount
    // clears the state so a later settings change can try again.
    unmount();
    console.error('[full-address-bar]', err);
  }
}

async function run(): Promise<void> {
  // Subscribe before the first mount: if that mount fails, a later settings
  // change must still be able to bring the bar back.
  store.subscribe(sync);
  sync(await store.load());
}

void run();
```

Note the import of `Settings` above comes from `../core/settings`, not `../core/site-rules` — fix the import line to:

```ts
import type { Settings } from '../core/settings';
import { isDenied } from '../core/site-rules';
```

Mounting note: at `document_start` the `documentElement` already exists, so `document.documentElement.append(host)` is safe and no `DOMContentLoaded` wait is needed. Verify this in the browser in Step 7 rather than assuming it.

- [ ] **Step 6: Run the checks**

Run: `yarn test && yarn typecheck && yarn lint && yarn build`
Expected: all PASS, exit 0.

- [ ] **Step 7: Manual verification in both browsers**

Chrome: `chrome://extensions` → Developer mode → "Load unpacked" → `dist-chrome`.
Firefox: `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → `dist-firefox/manifest.json`.

Check, and report the result of each:

1. The bar appears at the top of a plain page and does not cover its content.
2. The URL shown is decoded on a page with a Cyrillic path (e.g. a Wikipedia article in Russian).
3. A single click copies; pasting elsewhere yields the raw `%XX` URL.
4. A double click opens the field prefilled with the raw URL; Enter navigates; Esc reverts.
5. The close button removes the bar and the page returns to its original position.
6. On a SPA (e.g. GitHub navigation between tabs) the URL text follows navigation without reload.

- [ ] **Step 8: Stage and report**

```bash
git add src/integration src/ui/theme.ts src/ui/theme.test.ts src/content/main.ts
```

Suggested message: `feat: mount the address bar and keep it in sync with settings`.

---

### Task 8: Popup

Deliverable: a working popup with the global toggle, theme selector, "disable on this site" action and the deny-list.

**Files:**
- Modify: `src/popup/popup.html` (replace the Task 1 placeholder)
- Modify: `src/popup/popup.ts` (replace the Task 1 placeholder)
- Create (added during execution): `src/popup/deny-list.ts` + `src/popup/deny-list.test.ts` — the
  deny-list writes, extracted so they can be tested. Each write re-reads settings through
  `store.load()` first; computing from the snapshot captured at render time meant two rapid
  removals silently resurrected the first host.

**Interfaces:**
- Consumes: `createSettingsStore` (Task 7), `normalizeHost` (Task 4), `Theme` (Task 3).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the popup markup**

`src/popup/popup.html` (styling modeled on `../git-path-viewer/src/popup/popup.html`):

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Full Address Bar</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --text: #1f2328;
        --muted: #656d76;
        --accent: #1f6feb;
        --border: #d0d7de;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0d1117;
          --text: #e6edf3;
          --muted: #8b949e;
          --accent: #388bfd;
          --border: #30363d;
        }
      }
      body {
        margin: 0;
        width: 300px;
        padding: 14px 16px;
        background: var(--bg);
        color: var(--text);
        font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      h1 { font-size: 14px; margin: 0 0 10px; }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
      }
      select {
        padding: 4px 6px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: transparent;
        color: var(--text);
        font: inherit;
      }
      button {
        padding: 8px 12px;
        font: inherit;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
      }
      button[hidden] { display: none; }
      #toggle {
        width: 100%;
        color: #fff;
        background: var(--accent);
        border: none;
      }
      #toggle[data-on="true"] {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--border);
      }
      #deny-site {
        width: 100%;
        color: var(--accent);
        background: transparent;
        border: 1px solid var(--border);
      }
      h2 { font-size: 12px; margin: 14px 0 6px; color: var(--muted); font-weight: 600; }
      #denied { list-style: none; margin: 0; padding: 0; }
      #denied li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
        border-top: 1px solid var(--border);
      }
      #denied button {
        padding: 0 6px;
        color: var(--muted);
        background: transparent;
        border: none;
        font-weight: 400;
      }
      #empty { margin: 0; color: var(--muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Full Address Bar</h1>
    <button id="toggle" type="button">…</button>
    <div class="row" style="margin-top: 10px">
      <label for="theme">Theme</label>
      <select id="theme">
        <option value="auto">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
    <button id="deny-site" type="button" hidden>…</button>
    <h2>Disabled on</h2>
    <p id="empty">No sites yet.</p>
    <ul id="denied"></ul>
    <script src="popup.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Implement the popup logic**

`src/popup/popup.ts`:

```ts
// Popup: the global toggle, the theme selector, and the deny-list — including
// a one-click "disable on this site" for the tab the popup was opened from.
// All state lives in extension storage; the content script reacts to changes
// on its own, so nothing is messaged directly.

import { normalizeHost } from '../core/site-rules';
import { addDeniedHost, removeDeniedHost } from './deny-list';
import type { Settings, Theme } from '../core/settings';
import { createSettingsStore } from '../integration/settings-storage';

const store = createSettingsStore();

const toggle = document.getElementById('toggle') as HTMLButtonElement;
const themeSelect = document.getElementById('theme') as HTMLSelectElement;
const denySite = document.getElementById('deny-site') as HTMLButtonElement;
const deniedList = document.getElementById('denied') as HTMLUListElement;
const empty = document.getElementById('empty') as HTMLParagraphElement;

async function currentHost(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? normalizeHost(tab.url) : null;
}

function renderDenied(settings: Settings): void {
  deniedList.replaceChildren(
    ...settings.deniedHosts.map((host) => {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '✕';
      remove.title = `Enable the bar on ${host}`;
      remove.addEventListener('click', () => {
        void removeDeniedHost(store, host).then(refresh);
      });

      const name = document.createElement('span');
      name.textContent = host;

      const item = document.createElement('li');
      item.append(name, remove);
      return item;
    }),
  );
  empty.hidden = settings.deniedHosts.length > 0;
}

async function refresh(): Promise<void> {
  const settings = await store.load();

  toggle.dataset.on = String(settings.enabled);
  toggle.textContent = settings.enabled ? 'Turn off everywhere' : 'Turn on';
  themeSelect.value = settings.theme;
  renderDenied(settings);

  const host = await currentHost();
  const alreadyDenied = host !== null && settings.deniedHosts.includes(host);
  denySite.hidden = host === null || alreadyDenied;
  if (host && !alreadyDenied) {
    denySite.textContent = `Disable on ${host}`;
    denySite.onclick = () => {
      void addDeniedHost(store, host).then(refresh);
    };
  }
}

toggle.addEventListener('click', () => {
  void store.load().then((settings) => store.save({ enabled: !settings.enabled }).then(refresh));
});

themeSelect.addEventListener('change', () => {
  void store.save({ theme: themeSelect.value as Theme }).then(refresh);
});

void refresh();
```

- [ ] **Step 3: Run the checks**

Run: `yarn test && yarn typecheck && yarn lint && yarn build`
Expected: all PASS, exit 0.

- [ ] **Step 4: Manual verification in both browsers**

Reload the unpacked extension, then check and report each:

1. "Turn off everywhere" removes the bar from an already-open tab without reloading it.
2. Turning it back on restores the bar in that same tab.
3. Switching the theme to dark recolors the bar in an open tab immediately.
4. "Disable on \<host\>" removes the bar on that host, and the host appears under "Disabled on".
5. Removing the host from the list brings the bar back.
6. A subdomain of a disabled host also has no bar.

- [ ] **Step 5: Stage and report**

```bash
git add src/popup
```

Suggested message: `feat(popup): add global toggle, theme and deny-list`.

---

### Task 9: Icons, packaging, docs and CI

Deliverable: a releasable repository — icons, zip scripts, README, privacy note and a green CI workflow.

**Files:**
- Create: `scripts/gen-icons.mjs`, `scripts/package.mjs`, `scripts/package-source.mjs`
- Create: `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png` (generated)
- Create: `README.md`, `PRIVACY.md`, `LICENSE`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `yarn build` (Task 1).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Generate the icons**

```bash
mkdir -p scripts
cp ../git-path-viewer/scripts/gen-icons.mjs scripts/gen-icons.mjs
```

Edit the header comment and the `sample()` function so the mark suits this extension: a rounded dark card with a single light rounded bar across the upper third (the address bar) and a shorter accent-blue segment inside it. Keep the file dependency-free — it must still use only `node:zlib` and `node:fs`.

Run: `node scripts/gen-icons.mjs`
Expected: four PNGs in `icons/`. Open `icons/icon-128.png` and confirm the mark reads clearly at that size, then check `icon-16.png` is not mud.

- [ ] **Step 2: Add the packaging scripts**

`scripts/package.mjs` — copy `../git-path-viewer/scripts/package.mjs` and change `GPV_VERSION` to `FAB_VERSION` and the zip name prefix to `full-address-bar`.

`scripts/package-source.mjs` — copy `../git-path-viewer/scripts/package-source.mjs` and make the same two substitutions.

Run: `yarn package`
Expected: `release/full-address-bar-chrome-0.1.0.zip` and `release/full-address-bar-firefox-0.1.0.zip` exist.

- [ ] **Step 3: Write README.md**

Cover: what the extension does; install from source (`yarn install && yarn build`, then load unpacked in Chrome / temporary add-on in Firefox); the interaction table from the spec (click / double click / Esc / close button); popup settings; the known limitation that a site's own `position: fixed; top: 0` header renders under the bar; and the dev scripts (`watch`, `test`, `lint`, `typecheck`, `package`).

- [ ] **Step 4: Write PRIVACY.md**

State plainly: the extension reads the URL of the page it runs on only to display it; nothing is transmitted anywhere; the only stored data is the three settings fields, kept in local extension storage on the user's device; there is no analytics, no network request of any kind, and no remote code.

- [ ] **Step 5: Add the license**

```bash
cp ../git-path-viewer/LICENSE LICENSE
```

Confirm the copyright holder line names the repository owner.

- [ ] **Step 6: Add the CI workflow**

```bash
mkdir -p .github/workflows
cp ../git-path-viewer/.github/workflows/ci.yml .github/workflows/ci.yml
```

The copied workflow already runs typecheck → lint → test → build → `web-ext lint` on `dist-firefox` → artifact upload; no changes are needed beyond confirming the job name still fits.

- [ ] **Step 7: Verify the full pipeline locally**

Run: `yarn typecheck && yarn lint && yarn test && yarn build && npx --yes web-ext@latest lint --source-dir dist-firefox --output text`
Expected: all exit 0; `web-ext lint` reports no errors (warnings are acceptable).

- [ ] **Step 8: Stage and report**

```bash
git add -A
```

Suggested message: `chore: add icons, packaging, docs and CI`.

---

## Post-implementation

After Task 9, report to the owner:

1. The suggested commit sequence (one message per task, listed above) — the owner commits.
2. The manual-verification results from Tasks 7 and 8, including any site where the bar overlapped a sticky header.
3. Whether `web-ext lint` produced warnings, and which.
