import path from "path";
import { scanClaudeConfig } from "@/lib/scanner";
import { SkillCard } from "@/components/SkillCard";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ScopeHeader } from "@/components/ScopeHeader";

export default async function SkillsPage() {
  const config = await scanClaudeConfig();

  const globalSkills = config.skills.filter((s) => s.scope.type === "global");
  const projectSkills = config.skills.filter((s) => s.scope.type === "project");

  return (
    <PageWrapper>
      <PageHeader
        title="Skills"
        description="Reusable prompts and workflows"
        count={config.skills.length}
      />

      {globalSkills.length > 0 && (
        <div className="mb-8">
          <ScopeHeader
            scope={{ type: "global" }}
            filePath={path.dirname(globalSkills[0].filePath)}
          />
          <div className="space-y-3">
            {globalSkills.map((skill) => (
              <SkillCard key={skill.filePath} skill={skill} />
            ))}
          </div>
        </div>
      )}

      {projectSkills.length > 0 && (
        <div>
          <ScopeHeader
            scope={projectSkills[0].scope}
            filePath={path.dirname(projectSkills[0].filePath)}
          />
          <div className="space-y-3">
            {projectSkills.map((skill) => (
              <SkillCard key={skill.filePath} skill={skill} />
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
