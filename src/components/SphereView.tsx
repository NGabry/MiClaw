"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { hierarchy, pack } from "d3-hierarchy";
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
  agent: true, skill: true, mcp: true,
  command: false, rule: true, setting: false, hook: false, keybinding: false, "output-style": false,
};

// --- Components ---



function ItemSummary({ items, expanded, onToggle }: {
  items: SphereItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const typeCounts = new Map<SphereItem["type"], number>();
  for (const item of items) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);

  if (!expanded) {
    // Collapsed: single chip showing total count
    return (
      <div
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] font-medium
          bg-accent/10 text-accent cursor-pointer hover:bg-accent/20 transition-colors"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        <span>{items.length}</span>
      </div>
    );
  }

  // Expanded: full type breakdown
  return (
    <div className="flex gap-1.5 justify-center flex-wrap">
      {Array.from(typeCounts.entries()).map(([type, count]) => {
        const Icon = TYPE_ICON[type];
        const isAccent = TYPE_ACCENT[type];
        return (
          <div key={type} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] font-medium
            ${isAccent ? "bg-accent/12 text-accent" : "bg-white/[0.04] text-text-dim"}`}>
            <Icon size={13} />
            {count > 1 && <span>{count}</span>}
          </div>
        );
      })}
    </div>
  );
}


// --- D3 pack layout ---

interface PackDatum {
  id: string;
  name: string;
  kind: "global" | "projects-ring" | "project" | "leaf";
  items?: SphereItem[];
  projectNode?: ProjectNode;
  children?: PackDatum[];
  value?: number;
}

interface CircleData {
  id: string;
  name: string;
  kind: "global" | "projects-ring" | "project" | "leaf";
  x: number;
  y: number;
  r: number;
  depth: number;
  items?: SphereItem[];
  projectNode?: ProjectNode;
  parentId?: string;
  hasChildren: boolean;
}

function buildPackData(data: SphereData): PackDatum {
  function projectToPackDatum(p: ProjectNode, depth: number = 0): PackDatum {
    const id = p.path;
    if (p.children.length > 0) {
      return {
        id, name: p.name, kind: "project", items: p.items, projectNode: p,
        children: [
          // Spacer to keep parent visually larger than children
          { id: `${id}/_spacer`, name: "", kind: "leaf", value: 20 },
          ...p.children.map((c) => projectToPackDatum(c, depth + 1)),
        ],
      };
    }
    // All leaf nodes get a uniform base size so circles are consistent
    // Deeper nodes (subpackages) get slightly smaller
    const baseValue = depth === 0 ? 10 : 5;
    return { id, name: p.name, kind: "project", items: p.items, projectNode: p, value: baseValue };
  }

  return {
    id: "global", name: "Global", kind: "global", items: data.global,
    children: data.projects.map((p) => projectToPackDatum(p)),
  };
}

function computePackLayout(data: SphereData, size: number): CircleData[] {
  const root = hierarchy(buildPackData(data))
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const packed = pack<PackDatum>()
    .size([size, size])
    .padding((d) => {
      if (d.depth === 0) return size * 0.22;
      if (d.depth === 1) return size * 0.1;
      return size * 0.05;
    })(root);

  return packed.descendants().map((d) => ({
    id: d.data.id, name: d.data.name, kind: d.data.kind,
    x: d.x, y: d.y, r: d.r, depth: d.depth,
    items: d.data.items, projectNode: d.data.projectNode,
    parentId: d.parent?.data.id, hasChildren: !!d.children && d.children.length > 0,
  }));
}

// --- Main ---

export function SphereView({ data, selectedId, onSelectedIdChange, drawerOpen = false }: {
  data: SphereData;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  drawerOpen?: boolean;
}) {
  const setSelectedId = onSelectedIdChange;
  const [expandedChipId, setExpandedChipId] = useState<string | null>(null);
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

  const canvasSize = 1000;
  const circles = useMemo(() => computePackLayout(data, canvasSize), [data]);
  const visible = circles.filter((c) => c.kind !== "leaf");

  // Compute ancestor path for selected node
  const ancestorIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>();
    ids.add(selectedId);
    let currentId: string | undefined = selectedId;
    while (currentId) {
      const node = circles.find((c) => c.id === currentId);
      if (!node?.parentId) break;
      ids.add(node.parentId);
      currentId = node.parentId;
    }
    return ids;
  }, [selectedId, circles]);

  const fitDim = Math.min(viewSize.w, viewSize.h);
  const scale = fitDim / canvasSize;
  const drawerOffset = drawerOpen ? -210 : 0;
  const tx = (viewSize.w - canvasSize * scale) / 2 + drawerOffset;
  const ty = (viewSize.h - canvasSize * scale) / 2;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      onClick={() => setSelectedId(null)}
    >
      {/* Circle canvas */}
      <div
        className="relative transition-all duration-500"
        style={{
          width: canvasSize, height: canvasSize,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {visible.map((c, idx) => {
          const isSelected = c.id === selectedId;
          const isOnPath = ancestorIds.has(c.id);

          if (c.kind === "global") {
            const isGlobalSelected = selectedId === "global";
            return (
              <div
                key={`${c.id}-${idx}`}
                className={`absolute rounded-full border cursor-pointer transition-all duration-300 z-10
                  ${isGlobalSelected
                    ? "border-accent/40 bg-accent/[0.06] animate-[pulseGlow_2s_ease-in-out_infinite]"
                  : isOnPath
                    ? "border-accent/30 bg-accent/[0.03]"
                    : "border-accent/15 bg-accent/[0.02] hover:border-accent/25"}`}
                style={{ left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(isGlobalSelected ? null : "global");
                }}
              >
                <div className="absolute left-0 right-0 text-center z-30" style={{ top: 12 }}>
                  <p className="text-[22px] font-semibold uppercase tracking-wider text-accent pointer-events-none">Global</p>
                  <div className="flex justify-center mt-1">
                    <ItemSummary
                      items={data.global}
                      expanded={expandedChipId === "global"}
                      onToggle={() => setExpandedChipId((prev) => prev === "global" ? null : "global")}
                    />
                  </div>
                </div>
              </div>
            );
          }

          if (c.kind === "projects-ring") return null;

          if (c.kind === "project" && c.projectNode) {
            const hasAccent = c.projectNode.items.some((i) => TYPE_ACCENT[i.type]);
            const isParent = c.hasChildren;
            const nameFitsInside = c.r >= 60;
            const center = canvasSize / 2;
            const goRight = c.x > center;

            return (
              <div key={`${c.id}-${idx}`}>
                {/* Circle */}
                <div
                  className={`absolute rounded-full border cursor-pointer transition-all duration-300 z-20
                    ${isSelected
                      ? "border-accent/40 bg-accent/[0.06] animate-[pulseGlow_2s_ease-in-out_infinite]"
                      : isOnPath
                        ? "border-accent/25 bg-accent/[0.03] shadow-[0_0_15px_-3px_rgba(217,119,87,0.2)]"
                        : hasAccent
                          ? "border-accent/12 bg-white/[0.02] hover:border-accent/25"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"}`}
                  style={{
                    left: c.x - c.r, top: c.y - c.r,
                    width: c.r * 2, height: c.r * 2,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(isSelected ? null : c.id);
                  }}
                >
                  {/* Name inside circle only if it fits */}
                  {nameFitsInside && (
                    <div className="absolute left-0 right-0 text-center px-2" style={{ top: isParent ? 8 : Math.max(c.r * 0.12, 8) }}>
                      <p className={`font-medium truncate
                        ${isSelected ? "text-accent" : "text-text-muted"}
                        ${isParent ? "text-[16px]" : "text-[18px]"}`}>
                        {c.name}
                      </p>
                    </div>
                  )}
                  {/* Chips (collapsed by default, expand on click) */}
                  <div className={`absolute z-30 ${
                    isParent
                      ? "left-0 right-0 flex justify-center"
                      : "inset-0 flex items-center justify-center"
                  }`} style={isParent ? { top: nameFitsInside ? 30 : 4 } : undefined}>
                    <ItemSummary
                        items={c.projectNode.items}
                        expanded={expandedChipId === c.id}
                        onToggle={() => setExpandedChipId((prev) => prev === c.id ? null : c.id)}
                      />
                  </div>
                </div>

                {/* External name + leader line for small circles */}
                {!nameFitsInside && (
                  <>
                    <svg
                      className="absolute pointer-events-none z-10"
                      style={{
                        left: goRight ? c.x + c.r : 0,
                        top: c.y - 0.5,
                        width: goRight ? 80 : c.x - c.r,
                        height: 1,
                      }}
                    >
                      <line x1="0" y1="0" x2="100%" y2="0" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                    </svg>
                    <div
                      className="absolute z-30 cursor-pointer"
                      style={goRight
                        ? { left: c.x + c.r + 6, top: c.y - 8 }
                        : { left: c.x - c.r - 6, top: c.y - 8, transform: "translateX(-100%)" }}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : c.id); }}
                    >
                      <p className={`font-mono text-[11px] font-medium whitespace-nowrap
                        ${isSelected ? "text-accent" : "text-text-muted"}`}>
                        {c.name}
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>

    </div>
  );
}
