"use client";

import type { PaneNode } from "@/lib/paneTypes";
import { usePaneContext } from "@/lib/paneContext";
import { PaneDivider } from "./PaneDivider";
import { PaneLeaf } from "./PaneLeaf";

interface PaneTreeProps {
  node: PaneNode;
}

export function PaneTree({ node }: PaneTreeProps) {
  const { updateSplitRatio } = usePaneContext();

  if (node.type === "leaf") {
    return <PaneLeaf pane={node} />;
  }

  const isHorizontal = node.direction === "horizontal";

  return (
    <div
      className={`flex ${isHorizontal ? "flex-row" : "flex-col"} h-full w-full`}
    >
      <div
        className="overflow-hidden min-w-0 min-h-0"
        style={{ flexBasis: `${node.ratio * 100}%`, flexGrow: 0, flexShrink: 0 }}
      >
        <PaneTree node={node.children[0]} />
      </div>
      <PaneDivider
        direction={node.direction}
        splitId={node.id}
        onResizeCommit={updateSplitRatio}
      />
      <div
        className="overflow-hidden min-w-0 min-h-0"
        style={{ flexBasis: `${(1 - node.ratio) * 100}%`, flexGrow: 0, flexShrink: 0 }}
      >
        <PaneTree node={node.children[1]} />
      </div>
    </div>
  );
}
