import type { Skill } from "@/lib/types";
import { Card } from "./Card";
import { ModelBadge } from "./Badge";
import { ExpandableBody } from "./ExpandableBody";

export function SkillCard({ skill }: { skill: Skill }) {
  const { frontmatter, body } = skill;

  return (
    <Card>
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
