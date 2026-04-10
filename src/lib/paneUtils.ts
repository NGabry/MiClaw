import type { PaneNode, PaneLayout, LeafPane, SplitPane, PaneId } from "./paneTypes";

const STORAGE_KEY = "miclaw:pane-layout";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(): PaneId {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Generic tree walker: applies `fn` to the node matching `paneId`
// ---------------------------------------------------------------------------

function mapNode(
  node: PaneNode,
  paneId: PaneId,
  fn: (node: PaneNode) => PaneNode,
): PaneNode {
  if (node.id === paneId) return fn(node);
  if (node.type === "split") {
    return {
      ...node,
      children: [
        mapNode(node.children[0], paneId, fn),
        mapNode(node.children[1], paneId, fn),
      ],
    };
  }
  return node;
}

// ---------------------------------------------------------------------------
// Tree queries
// ---------------------------------------------------------------------------

export function findLeaf(node: PaneNode, paneId: PaneId): LeafPane | null {
  if (node.type === "leaf") return node.id === paneId ? node : null;
  return findLeaf(node.children[0], paneId) ?? findLeaf(node.children[1], paneId);
}

export function collectLeaves(node: PaneNode): LeafPane[] {
  if (node.type === "leaf") return [node];
  return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
}

// ---------------------------------------------------------------------------
// Layout mutations (all return new PaneLayout)
// ---------------------------------------------------------------------------

export function splitLeaf(
  layout: PaneLayout,
  paneId: PaneId,
  direction: "horizontal" | "vertical",
): PaneLayout {
  const newLeafId = generateId();
  const newRoot = mapNode(layout.root, paneId, (node) => {
    if (node.type !== "leaf") return node;
    const newLeaf: LeafPane = {
      type: "leaf",
      id: newLeafId,
      tabIds: [],
      activeTabId: null,
    };
    const split: SplitPane = {
      type: "split",
      id: generateId(),
      direction,
      ratio: 0.5,
      children: [{ ...node }, newLeaf],
    };
    return split;
  });
  return { root: newRoot, focusedPaneId: newLeafId };
}

export function removeLeaf(
  layout: PaneLayout,
  paneId: PaneId,
): PaneLayout | null {
  if (layout.root.type === "leaf" && layout.root.id === paneId) return null;

  function remove(node: PaneNode): PaneNode | null {
    if (node.type === "leaf") return null;
    const [left, right] = node.children;

    // Check if one of the direct children is the target leaf
    if (left.type === "leaf" && left.id === paneId) return right;
    if (right.type === "leaf" && right.id === paneId) return left;

    // Recurse into children
    const newLeft = remove(left);
    if (newLeft !== null) {
      return { ...node, children: [newLeft, right] };
    }
    const newRight = remove(right);
    if (newRight !== null) {
      return { ...node, children: [left, newRight] };
    }
    return null;
  }

  const result = remove(layout.root);
  if (!result) return null;

  // If the focused pane was removed, focus the first remaining leaf
  const leaves = collectLeaves(result);
  const focusedStillExists = leaves.some((l) => l.id === layout.focusedPaneId);
  return {
    root: result,
    focusedPaneId: focusedStillExists
      ? layout.focusedPaneId
      : (leaves[0]?.id ?? layout.focusedPaneId),
  };
}

export function moveTab(
  layout: PaneLayout,
  tabId: string,
  fromPaneId: PaneId,
  toPaneId: PaneId,
): PaneLayout {
  return moveTabs(layout, [tabId], fromPaneId, toPaneId);
}

export function moveTabs(
  layout: PaneLayout,
  tabIds: string[],
  fromPaneId: PaneId,
  toPaneId: PaneId,
): PaneLayout {
  const moveSet = new Set(tabIds);
  // Remove tabs from source pane
  let newRoot = mapNode(layout.root, fromPaneId, (node) => {
    if (node.type !== "leaf") return node;
    const newTabIds = node.tabIds.filter((id) => !moveSet.has(id));
    return {
      ...node,
      tabIds: newTabIds,
      activeTabId: node.activeTabId && moveSet.has(node.activeTabId)
        ? (newTabIds[0] ?? null)
        : node.activeTabId,
    };
  });
  // Add tabs to target pane
  const lastTabId = tabIds[tabIds.length - 1];
  newRoot = mapNode(newRoot, toPaneId, (node) => {
    if (node.type !== "leaf") return node;
    const toAdd = tabIds.filter((id) => !node.tabIds.includes(id));
    if (toAdd.length === 0) return node;
    return { ...node, tabIds: [...node.tabIds, ...toAdd], activeTabId: lastTabId };
  });
  return { root: newRoot, focusedPaneId: layout.focusedPaneId };
}

export function updateRatio(
  layout: PaneLayout,
  splitId: PaneId,
  ratio: number,
): PaneLayout {
  const clamped = Math.max(0.1, Math.min(0.9, ratio));
  const newRoot = mapNode(layout.root, splitId, (node) => {
    if (node.type !== "split") return node;
    return { ...node, ratio: clamped };
  });
  return { root: newRoot, focusedPaneId: layout.focusedPaneId };
}

/**
 * Remove any leaf panes with zero tabs. Collapses parent splits by promoting
 * the sibling. Safe to call repeatedly — stops when only one leaf remains.
 */
export function collapseEmptyLeaves(layout: PaneLayout): PaneLayout {
  function hasEmptyLeaf(node: PaneNode): boolean {
    if (node.type === "leaf") return node.tabIds.length === 0;
    return hasEmptyLeaf(node.children[0]) || hasEmptyLeaf(node.children[1]);
  }

  let current = layout;
  while (current.root.type === "split" && hasEmptyLeaf(current.root)) {
    const leaves = collectLeaves(current.root);
    const empty = leaves.find((l) => l.tabIds.length === 0);
    if (!empty) break;
    const result = removeLeaf(current, empty.id);
    if (!result) break;
    current = result;
  }
  return current;
}

export function reconcileTabs(
  layout: PaneLayout,
  allTabIds: string[],
): PaneLayout {
  const allSet = new Set(allTabIds);
  const assigned = new Set<string>();

  // First pass: remove dead tab IDs and collect assigned ones
  function cleanNode(node: PaneNode): PaneNode {
    if (node.type === "leaf") {
      const cleaned = node.tabIds.filter((id) => allSet.has(id));
      cleaned.forEach((id) => assigned.add(id));
      return {
        ...node,
        tabIds: cleaned,
        activeTabId: node.activeTabId && allSet.has(node.activeTabId)
          ? node.activeTabId
          : (cleaned[0] ?? null),
      };
    }
    return {
      ...node,
      children: [cleanNode(node.children[0]), cleanNode(node.children[1])],
    };
  }

  const cleaned = cleanNode(layout.root);

  // Second pass: add unassigned tab IDs to the focused pane
  const unassigned = allTabIds.filter((id) => !assigned.has(id));
  if (unassigned.length === 0) {
    return { root: cleaned, focusedPaneId: layout.focusedPaneId };
  }

  const newRoot = mapNode(cleaned, layout.focusedPaneId, (node) => {
    if (node.type !== "leaf") return node;
    const newTabIds = [...node.tabIds, ...unassigned];
    return {
      ...node,
      tabIds: newTabIds,
      activeTabId: node.activeTabId ?? (newTabIds[0] ?? null),
    };
  });

  return { root: newRoot, focusedPaneId: layout.focusedPaneId };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function saveLayout(layout: PaneLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // storage full or unavailable
  }
}

export function loadLayout(): PaneLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PaneLayout;
    // Minimal validation: must have root and focusedPaneId
    if (!parsed.root || !parsed.focusedPaneId) return null;
    if (parsed.root.type !== "leaf" && parsed.root.type !== "split") return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Default layout
// ---------------------------------------------------------------------------

export function defaultLayout(tabIds: string[]): PaneLayout {
  const id = generateId();
  return {
    root: {
      type: "leaf",
      id,
      tabIds,
      activeTabId: tabIds[0] ?? null,
    },
    focusedPaneId: id,
  };
}
