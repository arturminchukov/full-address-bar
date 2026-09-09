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
