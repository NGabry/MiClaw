"use client";

import type { SphereData, SphereItem, ProjectNode } from "@/lib/sphereData";
import { X } from "lucide-react";

const TYPE_LABEL: Record<SphereItem["type"], string> = {
  agent: "agent",
  skill: "skill",
  command: "cmd",
  mcp: "mcp",
  rule: "rule",
  setting: "config",
  hook: "hook",
  keybinding: "keys",
  "output-style": "style",
};

const TYPE_ACCENT: Record<SphereItem["type"], boolean> = {
  agent: true, skill: true, mcp: true, rule: true,
  command: false, setting: false, hook: false, keybinding: false, "output-style": false,
};

function ItemRow({ item }: { item: SphereItem }) {
  const isAccent = TYPE_ACCENT[item.type];
  const inner = (
    <div className="flex items-baseline gap-3 py-1.5 px-1 -mx-1 rounded-sm hover:bg-surface-hover transition-colors cursor-pointer group">
      <span className={`text-[10px] font-mono w-10 shrink-0 ${isAccent ? "text-accent/50" : "text-text-dim"}`}>
        {TYPE_LABEL[item.type]}
      </span>
      <span className={`text-sm font-mono ${isAccent ? "text-text" : "text-text-muted"}`}>
        {item.label}
      </span>
      {item.model && (
        <span className="text-[10px] font-mono text-text-dim ml-auto">{item.model}</span>
      )}
    </div>
  );
  return item.href ? <a href={item.href} className="block">{inner}</a> : inner;
}

function ItemSection({ label, items }: { label: string; items: SphereItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-[10px] text-text-dim font-mono mb-1"># {label}</p>
      {items.map((i) => <ItemRow key={i.id} item={i} />)}
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
    <div className={`py-4 ${!isPrimary ? "border-t border-border" : ""}`}>
      <p className={`text-xs font-mono font-medium mb-2
        ${isPrimary ? "text-accent" : "text-text-dim"}`}>
        {isPrimary ? `[${label}]` : `[${label}]`}
      </p>
      <ItemSection label="agents" items={byType("agent")} />
      <ItemSection label="skills" items={byType("skill")} />
      <ItemSection label="commands" items={byType("command")} />
      <ItemSection label="mcp" items={byType("mcp")} />
      <ItemSection label="rules" items={byType("rule")} />
      <ItemSection label="hooks" items={byType("hook")} />
      <ItemSection label="settings" items={byType("setting")} />
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

  let name: string;
  let items: SphereItem[];

  if (isGlobal) {
    name = "Global";
    items = data.global;
  } else {
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
          <h2 className="text-base font-mono font-medium text-text">{name}</h2>
          <p className="text-[11px] text-text-dim font-mono mt-0.5">{displayPath}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-sm text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-0">
        <ScopeBlock label={name} variant="primary" items={items} />
        {ancestors.map((ancestor) => (
          <ScopeBlock
            key={ancestor.name}
            label={`from ${ancestor.name}`}
            variant="inherited"
            items={ancestor.items}
          />
        ))}
        {!isGlobal && (
          <ScopeBlock label="from Global" variant="inherited" items={data.global} />
        )}
      </div>
    </div>
  );
}
