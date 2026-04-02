import type { Skill } from "@/lib/types";
import { Card } from "./Card";
import { Badge, ModelBadge, ScopeBadge } from "./Badge";
import { ExpandableBody } from "./ExpandableBody";

export function SkillCard({ skill }: { skill: Skill }) {
  const { frontmatter, body, scope, referencedAgents } = skill;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium">{frontmatter.name}</h3>
          <ScopeBadge scope={scope} />
          <ModelBadge model={frontmatter.model} />
          {frontmatter.version && (
            <Badge variant="muted">v{frontmatter.version}</Badge>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
        {frontmatter.description}
      </p>

      {frontmatter["when-to-use"] && (
        <p className="mt-1 text-xs text-text-dim italic">
          {frontmatter["when-to-use"]}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {frontmatter["user-invocable"] !== false && (
          <Badge variant="accent">user-invocable</Badge>
        )}
        {frontmatter["disable-model-invocation"] && (
          <Badge variant="muted">manual only</Badge>
        )}
        {frontmatter["argument-hint"] && (
          <Badge variant="default">{frontmatter["argument-hint"]}</Badge>
        )}
        {frontmatter.context === "fork" && (
          <Badge variant="default">forked context</Badge>
        )}
        {frontmatter.agent && (
          <Badge variant="accent">agent: {frontmatter.agent}</Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
        {frontmatter.effort && <span>Effort: {frontmatter.effort}</span>}
        {frontmatter.shell && <span>Shell: {frontmatter.shell}</span>}
        {frontmatter.paths && (
          <span>
            Paths:{" "}
            {Array.isArray(frontmatter.paths)
              ? frontmatter.paths.join(", ")
              : frontmatter.paths}
          </span>
        )}
        {frontmatter["allowed-tools"] && (
          <span>Tools: {frontmatter["allowed-tools"]}</span>
        )}
      </div>

      {referencedAgents.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-text-dim mb-1.5">Orchestrates:</p>
          <div className="flex flex-wrap gap-1.5">
            {referencedAgents.map((name) => (
              <Badge key={name} variant="accent">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {body && <ExpandableBody content={body} />}
    </Card>
  );
}
