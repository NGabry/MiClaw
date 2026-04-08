export type PaneId = string;

export interface LeafPane {
  type: "leaf";
  id: PaneId;
  tabIds: string[];
  activeTabId: string | null;
}

export interface SplitPane {
  type: "split";
  id: PaneId;
  direction: "horizontal" | "vertical";
  ratio: number;
  children: [PaneNode, PaneNode];
}

export type PaneNode = LeafPane | SplitPane;

export interface PaneLayout {
  root: PaneNode;
  focusedPaneId: PaneId;
}
