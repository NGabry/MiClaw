import { scanClaudeConfig } from "@/lib/scanner";
import { CommandScopeGroup } from "@/components/CommandScopeGroup";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ScopeHeader } from "@/components/ScopeHeader";

export const dynamic = "force-dynamic";

export default async function CommandsPage() {
  const config = await scanClaudeConfig();

  return (
    <PageWrapper>
      <PageHeader
        title="Commands"
        description="Procedural commands across projects"
        count={config.commands.length}
      />

      {config.projects
        .filter((p) => p.commands.length > 0)
        .map((project) => (
          <div key={project.path} className="mb-8">
            <ScopeHeader
              scope={{ type: "project", projectName: project.name, projectPath: project.path }}
              filePath={project.path}
            />
            <CommandScopeGroup commands={project.commands} scopePath={project.path} />
          </div>
        ))}

      {config.commands.length === 0 && (
        <p className="text-sm text-text-muted">No commands found.</p>
      )}
    </PageWrapper>
  );
}
