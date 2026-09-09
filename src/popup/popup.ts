// Popup: the global toggle, the theme selector, and the deny-list — including
// a one-click "disable on this site" for the tab the popup was opened from.
// All state lives in extension storage; the content script reacts to changes
// on its own, so nothing is messaged directly.

import { isDenied, normalizeHost } from '../core/site-rules';
import type { Settings, Theme } from '../core/settings';
import { api } from '../integration/browser-api';
import { createSettingsStore } from '../integration/settings-storage';
import { addDeniedHost, removeDeniedHost } from './deny-list';

const store = createSettingsStore();

const toggle = document.getElementById('toggle') as HTMLButtonElement;
const themeSelect = document.getElementById('theme') as HTMLSelectElement;
const denySite = document.getElementById('deny-site') as HTMLButtonElement;
const deniedList = document.getElementById('denied') as HTMLUListElement;
const empty = document.getElementById('empty') as HTMLParagraphElement;

async function currentHost(): Promise<string | null> {
  // Anything missing here (no extension API, a tab with no readable URL) means
  // there is no site to offer, not an error worth breaking the popup over.
  try {
    const tabs = await api?.tabs?.query({ active: true, currentWindow: true });
    const url = tabs?.[0]?.url;
    return url ? normalizeHost(url) : null;
  } catch {
    return null;
  }
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
  // The same predicate the content script uses, so the popup never offers to
  // deny a host already covered by a parent-domain entry.
  const alreadyDenied = host !== null && isDenied(host, settings.deniedHosts);
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
