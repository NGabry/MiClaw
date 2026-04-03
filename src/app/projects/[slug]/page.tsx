import { scanClaudeConfig } from "@/lib/scanner";
import type { HooksConfig } from "@/lib/types";
import { AgentCard } from "@/components/AgentCard";
import { SkillCard } from "@/components/SkillCard";
import { CommandCard } from "@/components/CommandCard";
import { OutputStyleCard } from "@/components/OutputStyleCard";
import { McpServerCard } from "@/components/McpServerCard";
import { HooksDisplay } from "@/components/HooksDisplay";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { PermissionList } from "@/components/PermissionList";
import { SettingsPriorityChain } from "@/components/SettingsPriorityChain";
import { ExpandableBody } from "@/components/ExpandableBody";
import { notFound } from "next/navigation";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = await scanClaudeConfig();
  const project = config.projects.find(
    (p) => p.name === decodeURIComponent(slug)
  );

  if (!project) {
    notFound();
  }

  const projectHooks: HooksConfig = {};
  for (const source of [project.settings?.shared?.hooks, project.settings?.local?.hooks]) {
    if (!source) continue;
    for (const [event, matchers] of Object.entries(source)) {
      if (matchers) {
        projectHooks[event] = [...(projectHooks[event] ?? []), ...matchers];
      }
    }
  }

  return (
    <PageWrapper>
      <PageHeader title={project.name} description={project.path} />

      {project.agents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Agents ({project.agents.length})
          </h2>
          <div className="space-y-3">
            {project.agents.map((agent) => (
              <AgentCard key={agent.filePath} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {project.skills.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Skills ({project.skills.length})
          </h2>
          <div className="space-y-3">
            {project.skills.map((skill) => (
              <SkillCard key={skill.filePath} skill={skill} />
            ))}
          </div>
        </section>
      )}

      {project.commands.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Commands ({project.commands.length})
          </h2>
          <div className="space-y-3">
            {project.commands.map((cmd) => (
              <CommandCard key={cmd.filePath} command={cmd} />
            ))}
          </div>
        </section>
      )}

      {project.outputStyles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Output Styles ({project.outputStyles.length})
          </h2>
          <div className="space-y-3">
            {project.outputStyles.map((style) => (
              <OutputStyleCard key={style.filePath} style={style} />
            ))}
          </div>
        </section>
      )}

      {project.mcpConfig && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            MCP Servers ({project.mcpConfig.servers.length})
          </h2>
          <div className="space-y-3">
            {project.mcpConfig.servers.map((server) => (
              <McpServerCard key={server.name} server={server} />
            ))}
          </div>
        </section>
      )}

      {Object.keys(projectHooks).length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Hooks
          </h2>
          <HooksDisplay hooks={projectHooks} />
        </section>
      )}

      {project.settings && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Permissions ({project.settings.permissions.allow.length})
          </h2>
          <Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PermissionList permissions={project.settings.permissions} />
              </div>
              <div>
                <p className="text-xs text-text-dim mb-2">Settings Priority</p>
                <SettingsPriorityChain project={project.settings} />
              </div>
            </div>
          </Card>
        </section>
      )}

      {project.instructionFiles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Instruction Files ({project.instructionFiles.length})
          </h2>
          <div className="space-y-3">
            {project.instructionFiles.map((file) => (
              <Card key={file.filePath} id={file.type}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">{file.type}</Badge>
                  <span className="text-xs text-text-dim font-mono">
                    {file.filePath}
                  </span>
                </div>
                <ExpandableBody content={file.content} previewLines={8} />
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageWrapper>
  );
}
