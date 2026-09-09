// Firefox exposes the promise-based extension APIs on `browser`; its `chrome`
// alias is callback-flavoured, so awaiting it yields undefined and every read
// silently falls back to defaults. Chrome has no `browser`, so this resolves
// to the right namespace in both. Every extension API call in this project
// goes through here.

type ExtensionApi = typeof chrome;

export const api: ExtensionApi | undefined =
  (globalThis as { browser?: ExtensionApi }).browser ?? globalThis.chrome;
