import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";

export function AgentCard({ agent }: { agent: Agent }) {
  const { frontmatter, body } = agent;

  return (
    <Card id={agent.frontmatter.name}>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-mono font-medium text-text">{frontmatter.name}</h3>
        {frontmatter.model && <span className="font-mono text-xs text-text-dim">{frontmatter.model}</span>}
      </div>

      <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
        {frontmatter.description}
      </p>

      {body && <ExpandableBody content={body} />}
    </Card>
  );
}
