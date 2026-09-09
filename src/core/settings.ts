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
