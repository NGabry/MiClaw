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

export function PermissionList({ permissions }: { permissions: PermissionSet }) {
  const allowGroups = groupPermissions(permissions.allow);
  const sortedTools = Object.keys(allowGroups).sort();

  return (
    <div className="space-y-3">
      {sortedTools.map((tool) => (
        <div key={tool}>
          <p className="text-xs text-text-dim mb-1">{tool}</p>
          <div className="space-y-0.5">
            {allowGroups[tool].map((perm, i) => (
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
