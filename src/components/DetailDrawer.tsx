"use client";

import type { SphereData, SphereItem, ProjectNode } from "@/lib/sphereData";
import {
  Bot, Zap, Terminal, Plug, FileText, Shield, Webhook, Keyboard, Palette, X,
} from "lucide-react";

const TYPE_ICON: Record<SphereItem["type"], React.ElementType> = {
  agent: Bot, skill: Zap, command: Terminal, mcp: Plug,
  rule: FileText, setting: Shield, hook: Webhook, keybinding: Keyboard, "output-style": Palette,
};
const TYPE_ACCENT: Record<SphereItem["type"], boolean> = {
  agent: true, skill: true, mcp: true, rule: true,
  command: false, setting: false, hook: false, keybinding: false, "output-style": false,
};

function ItemChip({ item }: { item: SphereItem }) {
  const Icon = TYPE_ICON[item.type];
  const isAccent = TYPE_ACCENT[item.type];
  const inner = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        transition-all hover:ring-1 hover:ring-accent/30 cursor-pointer
        ${isAccent ? "bg-accent/12 text-accent" : "bg-white/[0.04] text-text-muted"}`}
      title={item.description}
    >
      <Icon size={12} />
      {item.label}
      {item.model && <span className="opacity-50 text-[10px]">{item.model}</span>}
    </span>
  );
  return item.href ? <a href={item.href}>{inner}</a> : inner;
}

function ItemGroup({ label, items }: { label: string; items: SphereItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <ItemChip key={i.id} item={i} />)}
      </div>
    </div>
  );
}

function ScopeBlock({ label, variant, items }: {
  label: string;
  variant: "primary" | "inherited";
  items: SphereItem[];
}) {
  const byType = (type: SphereItem["type"]) => items.filter((i) => i.type === type);
  if (items.length === 0) return null;
  const isPrimary = variant === "primary";

  return (
    <div className={`py-3 ${!isPrimary ? "border-t border-border" : ""}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-3
        ${isPrimary ? "text-accent" : "text-text-muted"}`}>
        {label}
      </p>
      <div className="space-y-3">
        <ItemGroup label="Agents" items={byType("agent")} />
        <ItemGroup label="Skills" items={byType("skill")} />
        <ItemGroup label="Commands" items={byType("command")} />
        <ItemGroup label="MCP Servers" items={byType("mcp")} />
        <ItemGroup label="Instruction Files" items={byType("rule")} />
        <ItemGroup label="Hooks" items={byType("hook")} />
        <ItemGroup label="Settings" items={byType("setting")} />
      </div>
    </div>
  );
}

function findAncestors(
  data: SphereData,
  targetId: string
): { name: string; items: SphereItem[] }[] {
  const ancestors: { name: string; items: SphereItem[] }[] = [];

  function walk(nodes: ProjectNode[], chain: { name: string; items: SphereItem[] }[]): boolean {
    for (const n of nodes) {
      if (n.path === targetId) {
        ancestors.push(...chain);
        return true;
      }
      if (n.children.length > 0) {
        if (walk(n.children, [...chain, { name: n.name, items: n.items }])) return true;
      }
    }
    return false;
  }

  walk(data.projects, []);
  return ancestors;
}

export function DetailDrawer({
  nodeId,
  data,
  onClose,
}: {
  nodeId: string;
  data: SphereData;
  onClose: () => void;
}) {
  const isGlobal = nodeId === "global";

  // Find the node's items
  let name: string;
  let items: SphereItem[];

  if (isGlobal) {
    name = "Global";
    items = data.global;
  } else {
    // Search for the project node
    function findNode(nodes: ProjectNode[]): ProjectNode | null {
      for (const n of nodes) {
        if (n.path === nodeId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    }
    const node = findNode(data.projects);
    name = node?.name ?? nodeId;
    items = node?.items ?? [];
  }

  const ancestors = isGlobal ? [] : findAncestors(data, nodeId);
  const displayPath = isGlobal
    ? "~/.claude/"
    : nodeId.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div
      className="h-full bg-surface border-l border-border flex flex-col
        shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.5)]
        animate-[slideIn_0.3s_ease-out]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
        <div>
          <h2 className="text-base font-medium text-accent">{name}</h2>
          <p className="text-[11px] text-text-dim font-mono mt-0.5">{displayPath}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-sm text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        <ScopeBlock label={name} variant="primary" items={items} />
        {ancestors.map((ancestor) => (
          <ScopeBlock
            key={ancestor.name}
            label={`From ${ancestor.name}`}
            variant="inherited"
            items={ancestor.items}
          />
        ))}
        {!isGlobal && (
          <ScopeBlock label="From Global" variant="inherited" items={data.global} />
        )}
      </div>
    </div>
  );
}
