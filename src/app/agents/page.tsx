import path from "path";
import { scanClaudeConfig } from "@/lib/scanner";
import { AgentCard } from "@/components/AgentCard";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ScopeHeader } from "@/components/ScopeHeader";

export default async function AgentsPage() {
  const config = await scanClaudeConfig();

  const globalAgents = config.agents.filter((a) => a.scope.type === "global");
  const projectAgents = config.agents.filter((a) => a.scope.type === "project");

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
            filePath={path.dirname(globalAgents[0].filePath)}
          />
          <div className="space-y-3">
            {globalAgents.map((agent) => (
              <AgentCard key={agent.filePath} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {projectAgents.length > 0 && (
        <div>
          <ScopeHeader
            scope={projectAgents[0].scope}
            filePath={path.dirname(projectAgents[0].filePath)}
          />
          <div className="space-y-3">
            {projectAgents.map((agent) => (
              <AgentCard key={agent.filePath} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
