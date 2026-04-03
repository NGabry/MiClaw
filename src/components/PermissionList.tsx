"use client";

import { useState } from "react";
import type { PermissionSet } from "@/lib/types";

function groupPermissions(permissions: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const perm of permissions) {
    const match = perm.match(/^(\w+)/);
    const tool = match ? match[1] : "Other";
    if (!groups[tool]) groups[tool] = [];
    groups[tool].push(perm);
  }
  return groups;
}

const COLLAPSED_LIMIT = 5;

interface VisibleGroup {
  tool: string;
  entries: string[];
}

function getVisibleGroups(
  sortedTools: string[],
  allowGroups: Record<string, string[]>,
): VisibleGroup[] {
  const result: VisibleGroup[] = [];
  let count = 0;
  for (const tool of sortedTools) {
    if (count >= COLLAPSED_LIMIT) break;
    const entries = allowGroups[tool];
    const remaining = COLLAPSED_LIMIT - count;
    const sliced = entries.slice(0, remaining);
    result.push({ tool, entries: sliced });
    count += sliced.length;
  }
  return result;
}

export function PermissionList({ permissions }: { permissions: PermissionSet }) {
  const [expanded, setExpanded] = useState(false);
  const allowGroups = groupPermissions(permissions.allow);
  const sortedTools = Object.keys(allowGroups).sort();

  const totalCount = permissions.allow.length;
  const hiddenCount = totalCount - COLLAPSED_LIMIT;
  const collapsible = totalCount > COLLAPSED_LIMIT;

  const visibleGroups: VisibleGroup[] = expanded
    ? sortedTools.map((tool) => ({ tool, entries: allowGroups[tool] }))
    : getVisibleGroups(sortedTools, allowGroups);

  return (
    <div className="space-y-3">
      {visibleGroups.map(({ tool, entries }) => (
        <div key={tool}>
          <p className="text-xs text-text-dim mb-1">{tool}</p>
          <div className="space-y-0.5">
            {entries.map((perm, i) => (
              <p
                key={i}
                className="text-xs font-mono text-text-muted pl-3 leading-relaxed"
              >
                {perm}
              </p>
            ))}
          </div>
        </div>
      ))}

      {collapsible && !expanded && (
        <p className="text-xs font-mono text-text-dim pl-3">
          ... and {hiddenCount} more
        </p>
      )}

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-mono text-accent cursor-pointer hover:text-accent-dim"
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      )}

      {permissions.deny && permissions.deny.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-accent mb-1">Denied</p>
          {permissions.deny.map((perm, i) => (
            <p
              key={i}
              className="text-xs font-mono text-text-muted pl-3 leading-relaxed"
            >
              {perm}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
