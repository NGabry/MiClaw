import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ModelBadge } from "./Badge";
import { ExpandableBody } from "./ExpandableBody";

export function AgentCard({ agent }: { agent: Agent }) {
  const { frontmatter, body } = agent;

  return (
    <Card id={agent.frontmatter.name}>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-medium">{frontmatter.name}</h3>
        <ModelBadge model={frontmatter.model} />
      </div>

      <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
        {frontmatter.description}
      </p>

      {body && <ExpandableBody content={body} />}
    </Card>
  );
}
