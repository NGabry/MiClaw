import { scanClaudeConfig } from "@/lib/scanner";
import { McpServerCard } from "@/components/McpServerCard";
import { ScopeBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";

export default async function McpPage() {
  const config = await scanClaudeConfig();

  const totalServers = config.mcpConfigs.reduce(
    (sum, c) => sum + c.servers.length,
    0
  );

  return (
    <PageWrapper>
      <PageHeader
        title="MCP Servers"
        description="Model Context Protocol server configurations"
        count={totalServers}
      />

      {config.mcpConfigs.length > 0 ? (
        <div className="space-y-6">
          {config.mcpConfigs.map((mcpConfig) => (
            <div key={mcpConfig.filePath}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide">
                  <ScopeBadge scope={mcpConfig.scope} />
                </h2>
                <span className="text-xs text-text-dim font-mono">
                  {mcpConfig.filePath}
                </span>
              </div>
              <div className="space-y-3">
                {mcpConfig.servers.map((server) => (
                  <McpServerCard key={server.name} server={server} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          No MCP server configurations found.
        </p>
      )}
    </PageWrapper>
  );
}
