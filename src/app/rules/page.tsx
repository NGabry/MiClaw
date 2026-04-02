import path from "path";
import { scanClaudeConfig } from "@/lib/scanner";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { ExpandableBody } from "@/components/ExpandableBody";
import { ScopeHeader } from "@/components/ScopeHeader";
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
              <Card key={file.filePath}>
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
        </div>
        );
      })}

      {config.instructionFiles.length === 0 && (
        <p className="text-sm text-text-muted">No instruction files found.</p>
      )}
    </PageWrapper>
  );
}
