// All bar styles, scoped inside the Shadow DOM root and exported as a string
// so the build needs no CSS loader. Themes are driven by `data-theme` on the
// bar element, the viewport edge by `data-position`, and the auto-hidden state
// by `data-hidden`.

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
  --hover: rgba(127, 127, 127, 0.14);
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  position: fixed;
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
  color: var(--text);
  font: 12px/1 var(--font-mono);
  transition: transform 120ms ease-out;
}
.fab-bar[data-position="top"] {
  top: 0;
  border-bottom: 1px solid var(--border);
}
.fab-bar[data-position="bottom"] {
  bottom: 0;
  border-top: 1px solid var(--border);
}
/* Slid out of view rather than removed, so it can come back without a
   relayout. Pointer events go off with it: a hidden bar must never intercept
   a click meant for the page underneath. */
.fab-bar[data-hidden="true"] {
  pointer-events: none;
}
.fab-bar[data-hidden="true"][data-position="top"] {
  transform: translateY(-100%);
}
.fab-bar[data-hidden="true"][data-position="bottom"] {
  transform: translateY(100%);
}
.fab-bar[data-theme="dark"] {
  --bg: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent: #58a6ff;
  --hover: rgba(255, 255, 255, 0.1);
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
.fab-collapse-btn,
.fab-menu-btn {
  padding: 0 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.fab-collapse-btn:hover,
.fab-menu-btn:hover,
.fab-menu-btn[aria-expanded="true"] {
  background: var(--hover);
  color: var(--text);
}
.fab-menu {
  position: absolute;
  right: 6px;
  min-width: 210px;
  padding: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  font: 12px/1.4 var(--font-mono);
}
.fab-bar[data-position="top"] .fab-menu {
  top: 30px;
}
.fab-bar[data-position="bottom"] .fab-menu {
  bottom: 30px;
}
.fab-menu-group {
  padding: 4px 8px 2px;
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.fab-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fab-menu-item:hover {
  background: var(--hover);
}
.fab-menu-item .fab-menu-mark {
  color: var(--accent);
}
.fab-menu-sep {
  height: 1px;
  margin: 4px 0;
  background: var(--border);
}
[hidden] {
  display: none !important;
}
`;
