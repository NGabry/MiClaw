import type { Scope } from "@/lib/types";
import { shortenHomePath } from "@/lib/constants";

interface ScopeHeaderProps {
  scope: Scope;
  filePath?: string;
}

export function ScopeHeader({ scope, filePath }: ScopeHeaderProps) {
  const label = scope.type === "global" ? "Global" : scope.projectName;
  const displayPath = filePath ? shortenHomePath(filePath) : undefined;

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-mono text-xs text-text-dim">[{label.toUpperCase()}]</span>
      {displayPath && (
        <span className="text-xs text-text-dim font-mono">{displayPath}</span>
      )}
    </div>
  );
}
