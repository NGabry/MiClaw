import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { Badge, ModelBadge, ScopeBadge, ToolBadge } from "./Badge";
import { ExpandableBody } from "./ExpandableBody";

export function AgentCard({ agent }: { agent: Agent }) {
  const { frontmatter, body, scope } = agent;
  const tools = frontmatter.tools?.split(",").map((t) => t.trim()) ?? [];
  const disallowed = typeof frontmatter.disallowedTools === "string"
    ? frontmatter.disallowedTools.split(",").map((t) => t.trim())
    : frontmatter.disallowedTools ?? [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium">{frontmatter.name}</h3>
          <ScopeBadge scope={scope} />
          <ModelBadge model={frontmatter.model} />
          {frontmatter.color && (
            <Badge variant="muted">{frontmatter.color}</Badge>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
        {frontmatter.description}
      </p>

      {tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <ToolBadge key={tool} tool={tool} />
          ))}
        </div>
      )}

      {disallowed.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-text-dim mb-1">Disallowed:</p>
          <div className="flex flex-wrap gap-1.5">
            {disallowed.map((tool) => (
              <span key={tool} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm bg-accent/10 text-accent line-through">
                {tool.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
        {frontmatter.memory && <span>Memory: {frontmatter.memory}</span>}
        {frontmatter.isolation && <span>Isolation: {frontmatter.isolation}</span>}
        {frontmatter.effort && <span>Effort: {frontmatter.effort}</span>}
        {frontmatter.maxTurns && <span>Max turns: {frontmatter.maxTurns}</span>}
        {frontmatter.permissionMode && <span>Permissions: {frontmatter.permissionMode}</span>}
        {frontmatter.background && <span>Background</span>}
        {frontmatter.omitClaudeMd && <span>Omits CLAUDE.md</span>}
      </div>

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-text-dim mb-1">Preloaded skills:</p>
          <div className="flex flex-wrap gap-1.5">
            {frontmatter.skills.map((skill) => (
              <Badge key={skill} variant="accent">{skill}</Badge>
            ))}
          </div>
        </div>
      )}

      {frontmatter.mcpServers && frontmatter.mcpServers.length > 0 && (
        <p className="mt-2 text-xs text-text-dim">
          MCP servers: {frontmatter.mcpServers.length}
        </p>
      )}

      {body && <ExpandableBody content={body} />}
    </Card>
  );
}
