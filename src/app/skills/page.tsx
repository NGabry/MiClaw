import { scanClaudeConfig } from "@/lib/scanner";
import { SkillScopeGroup } from "@/components/SkillScopeGroup";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ScopeHeader } from "@/components/ScopeHeader";
import { CLAUDE_DIR } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const config = await scanClaudeConfig();

  const globalSkills = config.skills.filter((s) => s.scope.type === "global");

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
            filePath={CLAUDE_DIR}
          />
          <SkillScopeGroup skills={globalSkills} scopePath={CLAUDE_DIR} scopeType="global" />
        </div>
      )}

      {config.projects
        .filter((p) => p.skills.length > 0)
        .map((project) => (
          <div key={project.path} className="mb-8">
            <ScopeHeader
              scope={{ type: "project", projectName: project.name, projectPath: project.path }}
              filePath={project.path}
            />
            <SkillScopeGroup skills={project.skills} scopePath={project.path} scopeType="project" />
          </div>
        ))}
    </PageWrapper>
  );
}
