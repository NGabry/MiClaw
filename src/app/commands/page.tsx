import { scanClaudeConfig } from "@/lib/scanner";
import { CommandCard } from "@/components/CommandCard";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";

export default async function CommandsPage() {
  const config = await scanClaudeConfig();

  // Group commands by project
  const grouped = new Map<string, typeof config.commands>();
  for (const cmd of config.commands) {
    const key =
      cmd.scope.type === "global" ? "Global" : cmd.scope.projectName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(cmd);
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Commands"
        description="Procedural commands across projects"
        count={config.commands.length}
      />

      {Array.from(grouped.entries()).map(([group, commands]) => (
        <div key={group} className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            {group}
          </h2>
          <div className="space-y-3">
            {commands.map((cmd) => (
              <CommandCard key={cmd.filePath} command={cmd} />
            ))}
          </div>
        </div>
      ))}

      {config.commands.length === 0 && (
        <p className="text-sm text-text-muted">No commands found.</p>
      )}
    </PageWrapper>
  );
}
