"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import type { SphereData, SphereItem, ProjectNode } from "@/lib/sphereData";
import {
  Bot, Zap, Terminal, Plug, FileText, Shield, Webhook, Keyboard, Palette,
} from "lucide-react";

// --- Config ---

const TYPE_ICON: Record<SphereItem["type"], React.ElementType> = {
  agent: Bot, skill: Zap, command: Terminal, mcp: Plug,
  rule: FileText, setting: Shield, hook: Webhook, keybinding: Keyboard, "output-style": Palette,
};
const TYPE_ACCENT: Record<SphereItem["type"], boolean> = {
  agent: true, skill: true, mcp: true, rule: true,
  command: false, setting: false, hook: false, keybinding: false, "output-style": false,
};

// --- Build tree data for d3 ---

interface TreeDatum {
  id: string;
  name: string;
  items: SphereItem[];
  childNodes?: TreeDatum[];
}

function buildTreeData(data: SphereData): TreeDatum {
  function projectToTree(p: ProjectNode): TreeDatum {
    return {
      id: p.path,
      name: p.name,
      items: p.items,
      childNodes: p.children.length > 0 ? p.children.map(projectToTree) : undefined,
    };
  }

  return {
    id: "global",
    name: "Global",
    items: data.global,
    childNodes: data.projects.map(projectToTree),
  };
}

interface LayoutNode {
  id: string;
  name: string;
  items: SphereItem[];
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

function computeTreeLayout(data: SphereData, width: number, height: number): LayoutNode[] {
  const treeData = buildTreeData(data);

  const root = hierarchy(treeData, (d) => d.childNodes);

  const treeLayout = tree<TreeDatum>()
    .size([width - 80, height - 160])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

  treeLayout(root);

  return root.descendants().map((d) => ({
    id: d.data.id,
    name: d.data.name,
    items: d.data.items,
    x: (d.x ?? 0) + 60,
    y: (d.y ?? 0) + 80,
    parentX: d.parent ? (d.parent.x ?? 0) + 60 : undefined,
    parentY: d.parent ? (d.parent.y ?? 0) + 80 : undefined,
  }));
}

// --- Item summary for node bubbles ---

function ItemSummary({ items }: { items: SphereItem[] }) {
  const typeCounts = new Map<SphereItem["type"], number>();
  for (const item of items) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
  return (
    <div className="flex gap-1 justify-center flex-wrap">
      {Array.from(typeCounts.entries()).map(([type, count]) => {
        const Icon = TYPE_ICON[type];
        const isAccent = TYPE_ACCENT[type];
        return (
          <div key={type} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]
            ${isAccent ? "bg-accent/12 text-accent" : "bg-white/[0.04] text-text-dim"}`}>
            <Icon size={10} />
            {count > 1 && <span>{count}</span>}
          </div>
        );
      })}
    </div>
  );
}

// --- Main ---

export function TreeView({ data, selectedId, onSelectedIdChange }: {
  data: SphereData;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}) {
  const setSelectedId = onSelectedIdChange;
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ w: 900, h: 700 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setViewSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const drawerOpen = selectedId !== null;
  const canvasW = Math.max(drawerOpen ? viewSize.w - 420 : viewSize.w, 600);
  const canvasH = Math.max(viewSize.h, 500);

  const nodes = useMemo(() => computeTreeLayout(data, canvasW, canvasH), [data, canvasW, canvasH]);

  const actualCanvasW = canvasW;

  // Compute ancestor path for selected node
  const ancestorIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>();
    ids.add(selectedId);
    // Walk up parent chain
    let currentId = selectedId;
    for (let i = 0; i < 10; i++) {
      const node = nodes.find((n) => n.id === currentId);
      if (!node?.parentX) break;
      // Find parent by matching parentX/parentY
      const parent = nodes.find((n) => Math.abs(n.x - node.parentX!) < 1 && Math.abs(n.y - node.parentY!) < 1);
      if (!parent) break;
      ids.add(parent.id);
      currentId = parent.id;
    }
    return ids;
  }, [selectedId, nodes]);

  // Build connector lines (SVG paths)
  const lines = nodes
    .filter((n) => n.parentX !== undefined && n.parentY !== undefined)
    .map((n) => {
      const px = n.parentX!;
      const py = n.parentY!;
      // Elbow connector: go down from parent, then horizontal to child
      const midY = py + (n.y - py) * 0.5;
      return {
        id: n.id,
        d: `M ${px} ${py + 24} L ${px} ${midY} L ${n.x} ${midY} L ${n.x} ${n.y - 24}`,
      };
    });

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto relative"
      onClick={() => setSelectedId(null)}
    >
      <div
        className="transition-all duration-500 ease-out"
      >
      {/* SVG layer for connector lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={actualCanvasW}
        height={canvasH}
      >
        {lines.map((line) => {
          const onPath = ancestorIds.has(line.id);
          return (
            <path
              key={line.id}
              d={line.d}
              fill="none"
              stroke={onPath ? "#d97757" : "rgba(255,255,255,0.08)"}
              strokeWidth={onPath ? 2.5 : 2}
              style={onPath ? { animation: "pulsePathGlow 3s ease-in-out infinite" } : undefined}
            />
          );
        })}
        {/* Dots at connection points */}
        {nodes
          .filter((n) => n.parentX !== undefined)
          .map((n) => {
            const onPath = ancestorIds.has(n.id);
            return (
              <circle
                key={`dot-${n.id}`}
                cx={n.x}
                cy={n.y - 24}
                r={onPath ? 4 : 3}
                fill={onPath ? "rgba(217,119,87,0.5)" : "rgba(255,255,255,0.12)"}
              />
            );
          })}
      </svg>

      {/* HTML layer for node bubbles */}
      <div
        className="relative transition-all duration-500"
        style={{ width: actualCanvasW, height: canvasH }}
      >
        {nodes.map((node) => {
          const isSelected = node.id === selectedId;
          const isOnPath = ancestorIds.has(node.id);
          const hasAccent = node.items.some((i) => TYPE_ACCENT[i.type]);
          const isGlobal = node.id === "global";

          return (
            <div
              key={node.id}
              className={`absolute cursor-pointer transition-all duration-300 flex flex-col items-center
                ${isSelected ? "z-10" : ""}`}
              style={{
                left: node.x - 60,
                top: node.y - 24,
                width: 120,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(isSelected ? null : node.id);
              }}
            >
              {/* Circle node */}
              <div
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSelected
                    ? "border-accent bg-accent/15 animate-[pulseGlow_2s_ease-in-out_infinite]"
                    : isOnPath
                      ? "border-accent/40 bg-accent/[0.08] shadow-[0_0_15px_-3px_rgba(217,119,87,0.25)]"
                      : isGlobal
                        ? "border-accent/30 bg-accent/[0.06] hover:border-accent/50"
                        : hasAccent
                          ? "border-accent/20 bg-white/[0.03] hover:border-accent/40"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"}`}
              >
                <span className={`text-xs font-medium ${isSelected || isGlobal ? "text-accent" : "text-text-muted"}`}>
                  {node.items.length}
                </span>
              </div>

              {/* Label */}
              <p className={`text-xs font-medium mt-1.5 text-center truncate w-full
                ${isSelected ? "text-accent" : isGlobal ? "text-accent" : "text-text-muted"}`}>
                {node.name}
              </p>

              {/* Item type chips */}
              <div className="mt-1">
                <ItemSummary items={node.items} />
              </div>
            </div>
          );
        })}
      </div>

      </div>{/* end transform wrapper */}
    </div>
  );
}
