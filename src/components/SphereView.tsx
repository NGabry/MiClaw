"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { hierarchy, pack } from "d3-hierarchy";
import type { SphereData, SphereItem, ProjectNode } from "@/lib/sphereData";
import {
  Bot, Zap, Terminal, Plug, FileText, Shield, Webhook, Keyboard, Palette, X,
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

function ItemPill({ item, small }: { item: SphereItem; small?: boolean }) {
  const Icon = TYPE_ICON[item.type];
  const isAccent = TYPE_ACCENT[item.type];
  const inner = (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap
        transition-all hover:ring-1 hover:ring-accent/30 cursor-pointer
        ${isAccent ? "bg-accent/12 text-accent" : "bg-white/[0.04] text-text-muted"}
        ${small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[11px]"}`}
      title={item.description}
    >
      <Icon size={small ? 9 : 11} />
      {item.label}
      {item.model && !small && <span className="opacity-50 text-[9px]">{item.model}</span>}
    </span>
  );
  return item.href ? <a href={item.href}>{inner}</a> : inner;
}

function ItemSummary({ items }: { items: SphereItem[] }) {
  const typeCounts = new Map<SphereItem["type"], number>();
  for (const item of items) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
  return (
    <div className="flex gap-1 justify-center flex-wrap">
      {Array.from(typeCounts.entries()).map(([type, count]) => {
        const Icon = TYPE_ICON[type];
        const isAccent = TYPE_ACCENT[type];
        return (
          <div key={type} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px]
            ${isAccent ? "bg-accent/12 text-accent" : "bg-white/[0.04] text-text-dim"}`}>
            <Icon size={9} />
            {count > 1 && <span>{count}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ItemGroup({ label, items }: { label: string; items: SphereItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <ItemPill key={i.id} item={i} />)}
      </div>
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
  function projectToPackDatum(p: ProjectNode): PackDatum {
    const id = p.path;
    if (p.children.length > 0) {
      return {
        id, name: p.name, kind: "project", items: p.items, projectNode: p,
        children: p.children.map((c) => projectToPackDatum(c)),
      };
    }
    return { id, name: p.name, kind: "project", items: p.items, projectNode: p, value: Math.max(p.items.length * 6, 12) };
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
      if (d.depth === 0) return size * 0.06;
      if (d.depth === 1) return size * 0.03;
      return size * 0.015;
    })(root);

  return packed.descendants().map((d) => ({
    id: d.data.id, name: d.data.name, kind: d.data.kind,
    x: d.x, y: d.y, r: d.r, depth: d.depth,
    items: d.data.items, projectNode: d.data.projectNode,
    parentId: d.parent?.data.id, hasChildren: !!d.children && d.children.length > 0,
  }));
}

// --- Scope block (used in drawer) ---

function ScopeBlock({
  label,
  variant,
  items,
  byType,
  onClick,
}: {
  label: string;
  variant: "primary" | "inherited";
  items: SphereItem[];
  byType: (items: SphereItem[], type: SphereItem["type"]) => SphereItem[];
  onClick?: () => void;
}) {
  const agents = byType(items, "agent");
  const skills = byType(items, "skill");
  const commands = byType(items, "command");
  const mcps = byType(items, "mcp");
  const rules = byType(items, "rule");
  const settings = byType(items, "setting");
  const hooks = byType(items, "hook");
  const other = items.filter(
    (i) => !["agent", "skill", "command", "mcp", "rule", "setting", "hook"].includes(i.type)
  );

  const hasContent = items.length > 0;
  if (!hasContent) return null;

  const isPrimary = variant === "primary";

  return (
    <div className={`py-4 ${!isPrimary ? "border-t border-border" : ""}`}>
      {onClick ? (
        <button
          onClick={onClick}
          className={`text-[11px] font-semibold uppercase tracking-wider mb-3 block
            hover:text-accent transition-colors
            ${isPrimary ? "text-accent" : "text-text-muted"}`}
        >
          {label}
        </button>
      ) : (
        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-3
          ${isPrimary ? "text-accent" : "text-text-muted"}`}>
          {label}
        </p>
      )}

      <div className="space-y-3">
        <ItemGroup label="Agents" items={agents} />
        <ItemGroup label="Skills" items={skills} />
        <ItemGroup label="Commands" items={commands} />
        <ItemGroup label="MCP Servers" items={mcps} />
        <ItemGroup label="Instruction Files" items={rules} />
        <ItemGroup label="Hooks" items={hooks} />
        <ItemGroup label="Settings" items={settings} />
        {other.length > 0 && <ItemGroup label="Other" items={other} />}
      </div>
    </div>
  );
}

// --- Drawer panel ---

function DetailDrawer({
  circle,
  allCircles,
  globalItems,
  onClose,
  onSelect,
}: {
  circle: CircleData;
  allCircles: CircleData[];
  globalItems: SphereItem[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const node = circle.projectNode;
  if (!node) return null;

  const byType = (items: SphereItem[], type: SphereItem["type"]) => items.filter((i) => i.type === type);

  // Find ancestor chain for inherited items
  const ancestors: CircleData[] = [];
  let cur: CircleData | undefined = circle;
  while (cur?.parentId) {
    const parent = allCircles.find((c) => c.id === cur!.parentId);
    if (parent && parent.kind === "project" && parent.projectNode) {
      ancestors.unshift(parent);
    }
    cur = parent;
  }

  return (
    <div
      className="absolute inset-y-0 right-0 w-[420px] max-w-[90%] bg-surface border-l border-border
        shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.5)]
        flex flex-col z-20
        animate-[slideIn_0.3s_ease-out]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
        <div>
          <h2 className="text-base font-medium text-accent">{node.name}</h2>
          <p className="text-[11px] text-text-dim font-mono mt-0.5">
            {node.shortPath}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-sm text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        {/* Project's own items */}
        <ScopeBlock
          label={node.name}
          variant="primary"
          items={node.items}
          byType={byType}
        />

        {/* Child subpackages */}
        {node.children.length > 0 && (
          <div className="py-3">
            <p className="text-[10px] text-text-dim uppercase tracking-wider mb-2">Subpackages</p>
            <div className="flex flex-wrap gap-2">
              {node.children.map((child) => {
                const childCircle = allCircles.find((c) => c.id === child.path);
                return (
                  <button
                    key={child.path}
                    onClick={() => childCircle && onSelect(childCircle.id)}
                    className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]
                      hover:border-accent/25 text-[11px] text-text-muted hover:text-accent transition-all"
                  >
                    {child.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inherited from ancestors */}
        {ancestors.map((ancestor) => (
          <ScopeBlock
            key={ancestor.id}
            label={`From ${ancestor.name}`}
            variant="inherited"
            items={ancestor.projectNode!.items}
            byType={byType}
            onClick={() => onSelect(ancestor.id)}
          />
        ))}

        {/* Inherited from Global */}
        <ScopeBlock
          label="From Global"
          variant="inherited"
          items={globalItems}
          byType={byType}
        />
      </div>
    </div>
  );
}

// --- Main ---

export function SphereView({ data }: { data: SphereData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ w: 900, h: 700 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selectedCircle = selectedId ? circles.find((c) => c.id === selectedId) : null;

  // Always fit the full canvas -- no zoom transform
  const fitDim = Math.min(viewSize.w, viewSize.h);
  const scale = fitDim / canvasSize;
  const tx = (viewSize.w - canvasSize * scale) / 2;
  const ty = (viewSize.h - canvasSize * scale) / 2;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      onClick={() => setSelectedId(null)}
    >
      {/* Circle canvas */}
      <div
        className={`relative transition-all duration-500 ${selectedId ? "opacity-40" : ""}`}
        style={{
          width: canvasSize, height: canvasSize,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {visible.map((c, idx) => {
          const isSelected = c.id === selectedId;

          if (c.kind === "global") {
            return (
              <div
                key={`${c.id}-${idx}`}
                className="absolute rounded-full border border-accent/15 bg-accent/[0.02]"
                style={{ left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2 }}
              >
                <div className="absolute left-0 right-0 text-center" style={{ top: 16 }}>
                  <p className="text-[13px] font-semibold uppercase tracking-wider text-accent">Global</p>
                </div>
                <div className="absolute left-[10%] right-[10%] flex flex-wrap gap-1.5 justify-center" style={{ top: 36 }}>
                  {data.global.map((item) => <ItemPill key={item.id} item={item} />)}
                </div>
              </div>
            );
          }

          if (c.kind === "projects-ring") return null;

          if (c.kind === "project" && c.projectNode) {
            const hasAccent = c.projectNode.items.some((i) => TYPE_ACCENT[i.type]);
            const isParent = c.hasChildren;
            // For parent circles: label at very top, summary just below
            // For leaf circles: label centered in top third, summary below
            const labelTop = isParent ? 6 : Math.max(c.r * 0.15, 6);
            const summaryTop = isParent ? 22 : Math.max(c.r * 0.4, 22);

            return (
              <div
                key={`${c.id}-${idx}`}
                className={`absolute rounded-full border cursor-pointer transition-all duration-300
                  ${isSelected
                    ? "border-accent/40 bg-accent/[0.06] shadow-[0_0_50px_-10px_rgba(217,119,87,0.2)] z-10 !opacity-100"
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
                <div className="absolute left-0 right-0 text-center px-1" style={{ top: labelTop }}>
                  <p className={`font-medium truncate
                    ${isSelected ? "text-accent" : "text-text-muted"}
                    ${isParent ? "text-[10px]" : "text-[11px]"}`}>
                    {c.name}
                  </p>
                </div>
                {/* Only show summary if leaf or parent with enough room */}
                {!isParent && (
                  <div className="absolute left-[5%] right-[5%] flex justify-center" style={{ top: summaryTop }}>
                    <ItemSummary items={c.projectNode.items} />
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Detail drawer */}
      {selectedCircle && selectedCircle.projectNode && (
        <DetailDrawer
          circle={selectedCircle}
          allCircles={circles}
          globalItems={data.global}
          onClose={() => setSelectedId(null)}
          onSelect={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
