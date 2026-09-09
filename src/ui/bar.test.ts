// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BAR_HEIGHT, renderBar, type BarCallbacks } from "./bar";
import { STYLES } from "./styles";

function setup(overrides: Partial<BarCallbacks> = {}) {
  const calls = {
    copy: 0,
    navigate: [] as string[],
    hide: 0,
    denySite: 0,
    position: [] as string[],
    autoHide: [] as boolean[],
    collapse: 0,
  };
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
    onDenySite: () => {
      calls.denySite += 1;
    },
    onSetPosition: (value) => {
      calls.position.push(value);
    },
    onSetAutoHide: (value) => {
      calls.autoHide.push(value);
    },
    onCollapse: () => {
      calls.collapse += 1;
    },
    ...overrides,
  });
  document.body.append(bar.element);
  bar.setUrl(
    "https://example.com/путь",
    "https://example.com/%D0%BF%D1%83%D1%82%D1%8C",
  );

  const text = bar.element.querySelector(".fab-url") as HTMLElement;
  const input = bar.element.querySelector(".fab-input") as HTMLInputElement;
  const menuButton = bar.element.querySelector(
    ".fab-menu-btn",
  ) as HTMLButtonElement;
  const collapseButton = bar.element.querySelector(
    ".fab-collapse-btn",
  ) as HTMLButtonElement;
  const menu = bar.element.querySelector(".fab-menu") as HTMLElement;
  const click = (el: HTMLElement) =>
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const menuItem = (label: string) => {
    const found = [...menu.querySelectorAll(".fab-menu-item")].find((node) =>
      node.textContent?.startsWith(label),
    );
    if (!found) throw new Error(`no menu item labelled ${label}`);
    return found as HTMLElement;
  };
  return {
    bar,
    calls,
    text,
    input,
    menuButton,
    collapseButton,
    menu,
    click,
    menuItem,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("BAR_HEIGHT", () => {
  // Nothing else ties the constant to the CSS, and a divergence means the bar
  // covers content or leaves a gap on every page.
  it("matches the height the stylesheet renders", () => {
    expect(STYLES).toContain(`height: ${BAR_HEIGHT}px`);
  });
});

describe("renderBar", () => {
  it("shows the decoded URL and hides the input initially", () => {
    const { text, input } = setup();
    expect(text.textContent).toBe("https://example.com/путь");
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
  });

  it("copies on a single click, after the double-click window", () => {
    const { text, calls } = setup();
    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls.copy).toBe(0);
    vi.advanceTimersByTime(250);
    expect(calls.copy).toBe(1);
  });

  it("does not copy when the click becomes a double click", () => {
    const { text, calls, input } = setup();
    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(calls.copy).toBe(0);
    expect(input.hidden).toBe(false);
  });

  it("opens edit mode prefilled with the raw URL", () => {
    const { text, input } = setup();
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(input.hidden).toBe(false);
    expect(input.value).toBe("https://example.com/%D0%BF%D1%83%D1%82%D1%8C");
  });

  it("navigates on Enter with the entered value", () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    input.value = "https://other.test/x";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(calls.navigate).toEqual(["https://other.test/x"]);
  });

  it("does not navigate on Enter with an empty value", () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    input.value = "   ";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(calls.navigate).toEqual([]);
  });

  it("reverts to display mode on Escape", () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    input.value = "typed but abandoned";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
    expect(calls.navigate).toEqual([]);
  });

  it("reverts to display mode on blur", () => {
    const { text, input } = setup();
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur"));
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
  });

  it("does not overwrite the input while the user is editing", () => {
    const { bar, text, input } = setup();
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    input.value = "half-typed";
    bar.setUrl("https://later.test/", "https://later.test/");
    expect(input.value).toBe("half-typed");
  });

  it('reports "hide on this page" from the menu', () => {
    const { menuButton, menuItem, click, calls } = setup();
    click(menuButton);
    click(menuItem("Hide on this page"));
    expect(calls.hide).toBe(1);
  });

  it("cancels a pending copy when the menu is opened", () => {
    const { text, menuButton, menuItem, click, calls } = setup();
    click(text);
    click(menuButton);
    click(menuItem("Hide on this page"));
    vi.advanceTimersByTime(250);
    expect(calls.hide).toBe(1);
    expect(calls.copy).toBe(0);
  });

  it("shows a transient hint", () => {
    const { bar } = setup();
    const hint = bar.element.querySelector(".fab-hint") as HTMLElement;
    bar.showHint("Copied");
    expect(hint.textContent).toBe("Copied");
    expect(hint.hidden).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(hint.hidden).toBe(true);
  });

  it("puts the full address in the tooltip, with the interaction hint", () => {
    const { text } = setup();
    expect(text.title).toBe(
      "https://example.com/путь\nClick to copy · double-click to edit",
    );
  });

  it("applies the theme as a data attribute", () => {
    const { bar } = setup();
    bar.setTheme("dark");
    expect(bar.element.dataset.theme).toBe("dark");
  });
});

describe("bar menu", () => {
  it("starts closed and opens on the menu button", () => {
    const { menuButton, menu, click, bar } = setup();
    expect(menu.hidden).toBe(true);
    expect(bar.isMenuOpen()).toBe(false);

    click(menuButton);
    expect(menu.hidden).toBe(false);
    expect(bar.isMenuOpen()).toBe(true);
    expect(menuButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles shut when the button is pressed again", () => {
    const { menuButton, menu, click } = setup();
    click(menuButton);
    click(menuButton);
    expect(menu.hidden).toBe(true);
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when a click lands elsewhere in the bar", () => {
    const { menuButton, menu, text, click } = setup();
    click(menuButton);
    click(text);
    expect(menu.hidden).toBe(true);
  });

  it("reports a position choice and closes", () => {
    const { menuButton, menu, menuItem, click, calls } = setup();
    click(menuButton);
    click(menuItem("Bottom of the page"));
    expect(calls.position).toEqual(["bottom"]);
    expect(menu.hidden).toBe(true);
  });

  it("marks the current position", () => {
    const { bar, menuButton, menuItem, click } = setup();
    bar.setPosition("bottom");
    click(menuButton);
    expect(menuItem("Bottom of the page").textContent).toContain("✓");
    expect(menuItem("Top of the page").textContent).not.toContain("✓");
  });

  it("toggles auto-hide to the opposite of the current value", () => {
    const { bar, menuButton, menuItem, click, calls } = setup();
    click(menuButton);
    click(menuItem("Hide while scrolling"));
    expect(calls.autoHide).toEqual([true]);

    bar.setAutoHide(true);
    click(menuButton);
    click(menuItem("Hide while scrolling"));
    expect(calls.autoHide).toEqual([true, false]);
  });

  it("reports turning the bar off for the site", () => {
    const { menuButton, menuItem, click, calls } = setup();
    click(menuButton);
    click(menuItem("Turn off on this site"));
    expect(calls.denySite).toBe(1);
  });
});

describe("collapse button", () => {
  it("is hidden unless auto-hide is enabled", () => {
    const { bar, collapseButton } = setup();
    expect(collapseButton.hidden).toBe(true);
    bar.setAutoHide(true);
    expect(collapseButton.hidden).toBe(false);
  });

  it("reports a manual collapse", () => {
    const { bar, collapseButton, click, calls } = setup();
    bar.setAutoHide(true);
    click(collapseButton);
    expect(calls.collapse).toBe(1);
  });
});

describe("position and hidden state", () => {
  it("defaults to the top edge", () => {
    const { bar } = setup();
    expect(bar.element.dataset.position).toBe("top");
    expect(bar.element.dataset.hidden).toBe("false");
  });

  it("moves to the bottom edge and points collapse downward", () => {
    const { bar, collapseButton } = setup();
    bar.setPosition("bottom");
    expect(bar.element.dataset.position).toBe("bottom");
    expect(collapseButton.textContent).toBe("⌄");
  });

  it("slides out of view and back", () => {
    const { bar } = setup();
    bar.setHidden(true);
    expect(bar.element.dataset.hidden).toBe("true");
    bar.setHidden(false);
    expect(bar.element.dataset.hidden).toBe("false");
  });

  it("closes an open menu when the bar hides", () => {
    const { bar, menuButton, menu, click } = setup();
    click(menuButton);
    bar.setHidden(true);
    expect(menu.hidden).toBe(true);
    expect(bar.isMenuOpen()).toBe(false);
  });
});
