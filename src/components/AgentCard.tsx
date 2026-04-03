import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ModelBadge, ToolBadge } from "./Badge";
import { ExpandableBody } from "./ExpandableBody";

export function AgentCard({ agent }: { agent: Agent }) {
  const { frontmatter, body } = agent;
  const tools = frontmatter.tools?.split(",").map((t) => t.trim()) ?? [];

  return (
    <Card id={agent.frontmatter.name}>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-medium">{frontmatter.name}</h3>
        <ModelBadge model={frontmatter.model} />
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

      {body && <ExpandableBody content={body} />}
    </Card>
  );
}
