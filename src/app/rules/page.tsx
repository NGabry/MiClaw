import path from "path";
import { scanClaudeConfig } from "@/lib/scanner";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ScopeHeader } from "@/components/ScopeHeader";
import { RuleCard } from "@/components/RuleCard";
import type { Scope } from "@/lib/types";

export default async function RulesPage() {
  const config = await scanClaudeConfig();

  // Group by project
  const grouped = new Map<string, typeof config.instructionFiles>();
  for (const file of config.instructionFiles) {
    if (!grouped.has(file.projectName)) grouped.set(file.projectName, []);
    grouped.get(file.projectName)!.push(file);
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Rules and Instructions"
        description="Repo instruction files that guide agent behavior"
        count={config.instructionFiles.length}
      />

      {Array.from(grouped.entries()).map(([project, files]) => {
        const firstDir = path.dirname(files[0].filePath);
        const scope: Scope =
          project === "Global"
            ? { type: "global" }
            : { type: "project", projectName: project, projectPath: firstDir };
        return (
        <div key={project} className="mb-8">
          <ScopeHeader scope={scope} filePath={firstDir} />
          <div className="space-y-3">
            {files.map((file) => (
              <RuleCard
                key={file.filePath}
                filePath={file.filePath}
                type={file.type}
                content={file.content}
              />
            ))}
          </div>
        </div>
        );
      })}

      {config.instructionFiles.length === 0 && (
        <p className="text-sm text-text-muted">No instruction files found.</p>
      )}
    </PageWrapper>
  );
}
