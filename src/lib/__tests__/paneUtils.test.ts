import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  findLeaf,
  collectLeaves,
  splitLeaf,
  removeLeaf,
  moveTab,
  updateRatio,
  reconcileTabs,
  saveLayout,
  loadLayout,
  defaultLayout,
} from "../paneUtils";
import type { PaneLayout, LeafPane, SplitPane } from "../paneTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLeaf(id: string, tabIds: string[] = [], activeTabId: string | null = null): LeafPane {
  return { type: "leaf", id, tabIds, activeTabId };
}

function makeSplit(
  id: string,
  direction: "horizontal" | "vertical",
  left: LeafPane | SplitPane,
  right: LeafPane | SplitPane,
  ratio = 0.5,
): SplitPane {
  return { type: "split", id, direction, ratio, children: [left, right] };
}

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

describe("generateId", () => {
  it("returns a UUID string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^test-uuid-/);
  });

  it("returns unique IDs on successive calls", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// findLeaf
// ---------------------------------------------------------------------------

describe("findLeaf", () => {
  it("finds a leaf at the root", () => {
    const leaf = makeLeaf("a");
    expect(findLeaf(leaf, "a")).toEqual(leaf);
  });

  it("returns null when leaf not found at root", () => {
    const leaf = makeLeaf("a");
    expect(findLeaf(leaf, "b")).toBeNull();
  });

  it("finds a leaf nested in a split", () => {
    const left = makeLeaf("a");
    const right = makeLeaf("b");
    const split = makeSplit("s", "horizontal", left, right);
    expect(findLeaf(split, "b")).toEqual(right);
  });

  it("finds a deeply nested leaf", () => {
    const deep = makeLeaf("deep");
    const inner = makeSplit("i", "vertical", makeLeaf("x"), deep);
    const root = makeSplit("r", "horizontal", makeLeaf("y"), inner);
    expect(findLeaf(root, "deep")).toEqual(deep);
  });

  it("returns null for a missing leaf in a split tree", () => {
    const root = makeSplit("r", "horizontal", makeLeaf("a"), makeLeaf("b"));
    expect(findLeaf(root, "missing")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// collectLeaves
// ---------------------------------------------------------------------------

describe("collectLeaves", () => {
  it("returns single leaf in array", () => {
    const leaf = makeLeaf("a");
    expect(collectLeaves(leaf)).toEqual([leaf]);
  });

  it("collects all leaves from a split tree", () => {
    const a = makeLeaf("a");
    const b = makeLeaf("b");
    const c = makeLeaf("c");
    const inner = makeSplit("i", "vertical", b, c);
    const root = makeSplit("r", "horizontal", a, inner);
    const leaves = collectLeaves(root);
    expect(leaves).toHaveLength(3);
    expect(leaves.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// splitLeaf
// ---------------------------------------------------------------------------

describe("splitLeaf", () => {
  it("splits a root leaf horizontally", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1"], "t1"),
      focusedPaneId: "a",
    };
    const result = splitLeaf(layout, "a", "horizontal");

    expect(result.root.type).toBe("split");
    const split = result.root as SplitPane;
    expect(split.direction).toBe("horizontal");
    expect(split.ratio).toBe(0.5);
    expect(split.children[0].type).toBe("leaf");
    expect((split.children[0] as LeafPane).tabIds).toEqual(["t1"]);
    expect(split.children[1].type).toBe("leaf");
    expect((split.children[1] as LeafPane).tabIds).toEqual([]);
    // Focus moves to the new leaf
    expect(result.focusedPaneId).toBe(split.children[1].id);
  });

  it("splits a root leaf vertically", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a"),
      focusedPaneId: "a",
    };
    const result = splitLeaf(layout, "a", "vertical");
    const split = result.root as SplitPane;
    expect(split.direction).toBe("vertical");
  });

  it("splits a nested leaf", () => {
    const a = makeLeaf("a", ["t1"], "t1");
    const b = makeLeaf("b", ["t2"], "t2");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = splitLeaf(layout, "b", "vertical");
    const root = result.root as SplitPane;
    // Left child should still be leaf a
    expect(root.children[0].id).toBe("a");
    // Right child should now be a split containing old b + new leaf
    expect(root.children[1].type).toBe("split");
    const innerSplit = root.children[1] as SplitPane;
    expect(innerSplit.direction).toBe("vertical");
    expect((innerSplit.children[0] as LeafPane).tabIds).toEqual(["t2"]);
  });

  it("does not modify a node that is not the target", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1"], "t1"),
      focusedPaneId: "a",
    };
    // Split a non-existent ID: should still return a valid layout
    // (mapNode won't find it, so root stays the same type)
    const result = splitLeaf(layout, "nonexistent", "horizontal");
    expect(result.root.type).toBe("leaf");
  });
});

// ---------------------------------------------------------------------------
// removeLeaf
// ---------------------------------------------------------------------------

describe("removeLeaf", () => {
  it("returns null when removing the only root leaf", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a"),
      focusedPaneId: "a",
    };
    expect(removeLeaf(layout, "a")).toBeNull();
  });

  it("removes the left child and promotes the right", () => {
    const a = makeLeaf("a");
    const b = makeLeaf("b");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = removeLeaf(layout, "a");
    expect(result).not.toBeNull();
    expect(result!.root).toEqual(b);
    expect(result!.focusedPaneId).toBe("b");
  });

  it("removes the right child and promotes the left", () => {
    const a = makeLeaf("a");
    const b = makeLeaf("b");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "b",
    };
    const result = removeLeaf(layout, "b");
    expect(result).not.toBeNull();
    expect(result!.root).toEqual(a);
    expect(result!.focusedPaneId).toBe("a");
  });

  it("preserves focus when removing a non-focused leaf", () => {
    const a = makeLeaf("a");
    const b = makeLeaf("b");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "b",
    };
    const result = removeLeaf(layout, "a");
    expect(result!.focusedPaneId).toBe("b");
  });

  it("removes a deeply nested leaf", () => {
    const a = makeLeaf("a");
    const b = makeLeaf("b");
    const c = makeLeaf("c");
    const inner = makeSplit("i", "vertical", b, c);
    const layout: PaneLayout = {
      root: makeSplit("r", "horizontal", a, inner),
      focusedPaneId: "a",
    };
    const result = removeLeaf(layout, "b");
    expect(result).not.toBeNull();
    // After removing b, inner split collapses to just c
    const root = result!.root as SplitPane;
    expect(root.children[0].id).toBe("a");
    expect(root.children[1].id).toBe("c");
  });

  it("returns null when target leaf does not exist in a leaf-only tree", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a"),
      focusedPaneId: "a",
    };
    // Trying to remove a leaf that doesn't exist from a leaf root
    expect(removeLeaf(layout, "nonexistent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// moveTab
// ---------------------------------------------------------------------------

describe("moveTab", () => {
  it("moves a tab from one pane to another", () => {
    const a = makeLeaf("a", ["t1", "t2"], "t1");
    const b = makeLeaf("b", ["t3"], "t3");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = moveTab(layout, "t2", "a", "b");
    const root = result.root as SplitPane;
    const left = root.children[0] as LeafPane;
    const right = root.children[1] as LeafPane;
    expect(left.tabIds).toEqual(["t1"]);
    expect(right.tabIds).toEqual(["t3", "t2"]);
    expect(right.activeTabId).toBe("t2");
  });

  it("updates activeTabId in source when moving the active tab", () => {
    const a = makeLeaf("a", ["t1", "t2"], "t1");
    const b = makeLeaf("b", [], null);
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = moveTab(layout, "t1", "a", "b");
    const root = result.root as SplitPane;
    const left = root.children[0] as LeafPane;
    expect(left.activeTabId).toBe("t2");
  });

  it("sets activeTabId to null when moving the last tab", () => {
    const a = makeLeaf("a", ["t1"], "t1");
    const b = makeLeaf("b", [], null);
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = moveTab(layout, "t1", "a", "b");
    const left = (result.root as SplitPane).children[0] as LeafPane;
    expect(left.activeTabId).toBeNull();
    expect(left.tabIds).toEqual([]);
  });

  it("does not duplicate a tab already in the target pane", () => {
    const a = makeLeaf("a", ["t1"], "t1");
    const b = makeLeaf("b", ["t1"], "t1");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = moveTab(layout, "t1", "a", "b");
    const right = (result.root as SplitPane).children[1] as LeafPane;
    expect(right.tabIds).toEqual(["t1"]);
  });

  it("preserves focusedPaneId", () => {
    const a = makeLeaf("a", ["t1"], "t1");
    const b = makeLeaf("b", [], null);
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = moveTab(layout, "t1", "a", "b");
    expect(result.focusedPaneId).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// updateRatio
// ---------------------------------------------------------------------------

describe("updateRatio", () => {
  it("updates ratio on a split node", () => {
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", makeLeaf("a"), makeLeaf("b"), 0.5),
      focusedPaneId: "a",
    };
    const result = updateRatio(layout, "s", 0.7);
    expect((result.root as SplitPane).ratio).toBe(0.7);
  });

  it("clamps ratio to minimum 0.1", () => {
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", makeLeaf("a"), makeLeaf("b")),
      focusedPaneId: "a",
    };
    const result = updateRatio(layout, "s", 0.01);
    expect((result.root as SplitPane).ratio).toBe(0.1);
  });

  it("clamps ratio to maximum 0.9", () => {
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", makeLeaf("a"), makeLeaf("b")),
      focusedPaneId: "a",
    };
    const result = updateRatio(layout, "s", 0.99);
    expect((result.root as SplitPane).ratio).toBe(0.9);
  });

  it("does not modify a leaf node even if ID matches", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a"),
      focusedPaneId: "a",
    };
    const result = updateRatio(layout, "a", 0.7);
    expect(result.root.type).toBe("leaf");
  });
});

// ---------------------------------------------------------------------------
// reconcileTabs
// ---------------------------------------------------------------------------

describe("reconcileTabs", () => {
  it("removes dead tabs not in allTabIds", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1", "t2", "t3"], "t2"),
      focusedPaneId: "a",
    };
    const result = reconcileTabs(layout, ["t1", "t3"]);
    const leaf = result.root as LeafPane;
    expect(leaf.tabIds).toEqual(["t1", "t3"]);
    expect(leaf.activeTabId).toBe("t1"); // t2 was removed, falls back to first
  });

  it("adds unassigned tabs to the focused pane", () => {
    const a = makeLeaf("a", ["t1"], "t1");
    const b = makeLeaf("b", ["t2"], "t2");
    const layout: PaneLayout = {
      root: makeSplit("s", "horizontal", a, b),
      focusedPaneId: "a",
    };
    const result = reconcileTabs(layout, ["t1", "t2", "t3", "t4"]);
    const root = result.root as SplitPane;
    const left = root.children[0] as LeafPane;
    const right = root.children[1] as LeafPane;
    expect(left.tabIds).toEqual(["t1", "t3", "t4"]);
    expect(right.tabIds).toEqual(["t2"]);
  });

  it("preserves activeTabId when it still exists", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1", "t2"], "t2"),
      focusedPaneId: "a",
    };
    const result = reconcileTabs(layout, ["t1", "t2"]);
    expect((result.root as LeafPane).activeTabId).toBe("t2");
  });

  it("returns unchanged layout when no tabs to add or remove", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1"], "t1"),
      focusedPaneId: "a",
    };
    const result = reconcileTabs(layout, ["t1"]);
    expect((result.root as LeafPane).tabIds).toEqual(["t1"]);
  });

  it("handles empty allTabIds by clearing all tabs", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1", "t2"], "t1"),
      focusedPaneId: "a",
    };
    const result = reconcileTabs(layout, []);
    expect((result.root as LeafPane).tabIds).toEqual([]);
    expect((result.root as LeafPane).activeTabId).toBeNull();
  });

  it("sets activeTabId when unassigned tabs are added to a pane with no active", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", [], null),
      focusedPaneId: "a",
    };
    const result = reconcileTabs(layout, ["t1"]);
    const leaf = result.root as LeafPane;
    expect(leaf.tabIds).toEqual(["t1"]);
    expect(leaf.activeTabId).toBe("t1");
  });
});

// ---------------------------------------------------------------------------
// saveLayout / loadLayout
// ---------------------------------------------------------------------------

describe("saveLayout / loadLayout", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
    });
  });

  it("round-trips a layout through save/load", () => {
    const layout: PaneLayout = {
      root: makeLeaf("a", ["t1"], "t1"),
      focusedPaneId: "a",
    };
    saveLayout(layout);
    const loaded = loadLayout();
    expect(loaded).toEqual(layout);
  });

  it("returns null when no layout is saved", () => {
    expect(loadLayout()).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    storage["miclaw:pane-layout"] = "not-json";
    expect(loadLayout()).toBeNull();
  });

  it("returns null for object missing root", () => {
    storage["miclaw:pane-layout"] = JSON.stringify({ focusedPaneId: "a" });
    expect(loadLayout()).toBeNull();
  });

  it("returns null for object missing focusedPaneId", () => {
    storage["miclaw:pane-layout"] = JSON.stringify({ root: makeLeaf("a") });
    expect(loadLayout()).toBeNull();
  });

  it("returns null for invalid root type", () => {
    storage["miclaw:pane-layout"] = JSON.stringify({
      root: { type: "invalid", id: "x" },
      focusedPaneId: "x",
    });
    expect(loadLayout()).toBeNull();
  });

  it("handles localStorage errors gracefully on save", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceeded"); },
    });
    // Should not throw
    expect(() => saveLayout({ root: makeLeaf("a"), focusedPaneId: "a" })).not.toThrow();
  });

  it("handles localStorage errors gracefully on load", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => {},
    });
    expect(loadLayout()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// defaultLayout
// ---------------------------------------------------------------------------

describe("defaultLayout", () => {
  it("creates a layout with tabs", () => {
    const layout = defaultLayout(["t1", "t2"]);
    expect(layout.root.type).toBe("leaf");
    const leaf = layout.root as LeafPane;
    expect(leaf.tabIds).toEqual(["t1", "t2"]);
    expect(leaf.activeTabId).toBe("t1");
    expect(layout.focusedPaneId).toBe(leaf.id);
  });

  it("creates a layout with no tabs", () => {
    const layout = defaultLayout([]);
    const leaf = layout.root as LeafPane;
    expect(leaf.tabIds).toEqual([]);
    expect(leaf.activeTabId).toBeNull();
  });
});
