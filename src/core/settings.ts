// The extension's persisted settings, with a validator that tolerates any
// stored value: corrupted storage must never break the bar.

export type Theme = 'light' | 'dark' | 'auto';
export type Position = 'top' | 'bottom';

const THEMES: readonly Theme[] = ['light', 'dark', 'auto'];
const POSITIONS: readonly Position[] = ['top', 'bottom'];

export interface Settings {
  /** Global on/off switch. */
  enabled: boolean;
  theme: Theme;
  /** Which edge of the viewport the bar is attached to. */
  position: Position;
  /**
   * Hide the bar while scrolling down, bring it back on scroll up or when the
   * pointer reaches its edge. Implies the bar sits over the page instead of
   * pushing it: a bar that both moved the page and hid itself would make the
   * content jump on every scroll.
   */
  autoHide: boolean;
  /** Hosts the bar is suppressed on, including their subdomains. */
  deniedHosts: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  theme: 'auto',
  position: 'top',
  autoHide: false,
  deniedHosts: [],
};

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme);
}

function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && POSITIONS.includes(value as Position);
}

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS, deniedHosts: [] };
  const raw = value as Partial<Record<keyof Settings, unknown>>;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    position: isPosition(raw.position) ? raw.position : DEFAULT_SETTINGS.position,
    autoHide: typeof raw.autoHide === 'boolean' ? raw.autoHide : DEFAULT_SETTINGS.autoHide,
    deniedHosts: Array.isArray(raw.deniedHosts)
      ? raw.deniedHosts.filter((host): host is string => typeof host === 'string')
      : [],
  };
}
