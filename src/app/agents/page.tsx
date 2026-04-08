import { scanClaudeConfig } from "@/lib/scanner";
import { AgentScopeGroup } from "@/components/AgentScopeGroup";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ScopeHeader } from "@/components/ScopeHeader";
import { CLAUDE_DIR } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const config = await scanClaudeConfig();

  const globalAgents = config.agents.filter((a) => a.scope.type === "global");

  return (
    <PageWrapper>
      <PageHeader
        title="Agents"
        description="Custom subagents across all scopes"
        count={config.agents.length}
      />

      {globalAgents.length > 0 && (
        <div className="mb-8">
          <ScopeHeader
            scope={{ type: "global" }}
            filePath={CLAUDE_DIR}
          />
          <AgentScopeGroup agents={globalAgents} scopePath={CLAUDE_DIR} scopeType="global" />
        </div>
      )}

      {config.projects
        .filter((p) => p.agents.length > 0)
        .map((project) => (
          <div key={project.path} className="mb-8">
            <ScopeHeader
              scope={{ type: "project", projectName: project.name, projectPath: project.path }}
              filePath={project.path}
            />
            <AgentScopeGroup agents={project.agents} scopePath={project.path} scopeType="project" />
          </div>
        ))}
    </PageWrapper>
  );
}
