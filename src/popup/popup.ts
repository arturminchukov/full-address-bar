// Popup: the global toggle, the theme selector, and the deny-list — including
// a one-click "disable on this site" for the tab the popup was opened from.
// All state lives in extension storage; the content script reacts to changes
// on its own, so nothing is messaged directly.

import { normalizeHost } from '../core/site-rules';
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
        void store
          .save({ deniedHosts: settings.deniedHosts.filter((h) => h !== host) })
          .then(refresh);
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
      void store.save({ deniedHosts: [...settings.deniedHosts, host] }).then(refresh);
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
