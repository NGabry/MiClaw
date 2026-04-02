import { scanClaudeConfig } from "@/lib/scanner";
import { SkillCard } from "@/components/SkillCard";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";

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
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Global
          </h2>
          <div className="space-y-3">
            {globalSkills.map((skill) => (
              <SkillCard key={skill.filePath} skill={skill} />
            ))}
          </div>
        </div>
      )}

      {projectSkills.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Project
          </h2>
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
