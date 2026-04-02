import type { Scope } from "@/lib/types";

type BadgeVariant = "default" | "accent" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-surface-raised text-text-muted",
  accent: "bg-accent/15 text-accent",
  muted: "bg-surface-raised text-text-dim",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}

export function ScopeBadge({ scope }: { scope: Scope }) {
  if (scope.type === "global") {
    return <Badge variant="muted">Global</Badge>;
  }
  return <Badge variant="default">{scope.projectName}</Badge>;
}

export function ModelBadge({ model }: { model?: string }) {
  if (!model) return null;
  const variant = model === "opus" ? "accent" : "default";
  return <Badge variant={variant}>{model}</Badge>;
}

export function ToolBadge({ tool }: { tool: string }) {
  return <Badge variant="muted">{tool.trim()}</Badge>;
}
