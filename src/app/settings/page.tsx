import { scanClaudeConfig } from "@/lib/scanner";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { PermissionList } from "@/components/PermissionList";
import { KeybindingsDisplay } from "@/components/KeybindingsDisplay";
import { SettingsPriorityChain } from "@/components/SettingsPriorityChain";
import { ScopeHeader } from "@/components/ScopeHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await scanClaudeConfig();
  const globalEntries = Object.entries(config.globalSettings.raw);

  return (
    <PageWrapper>
      <PageHeader
        title="Settings"
        description="Global settings, keybindings, and per-project permissions"
      />

      {globalEntries.length > 0 && (
        <div className="mb-8">
          <ScopeHeader scope={{ type: "global" }} />
          <Card>
            <div className="space-y-1">
              {globalEntries.map(([key, value]) => (
                <div key={key} className="flex gap-3 text-sm">
                  <span className="text-text-muted font-mono">{key}</span>
                  <span className="text-text-dim font-mono break-all">
                    {typeof value === "object"
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {config.keybindings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Keybindings
          </h2>
          <KeybindingsDisplay keybindings={config.keybindings} />
        </div>
      )}

      <div>
        {config.projectSettings.length > 0 ? (
          <div className="space-y-6">
            {config.projectSettings.map((ps) => (
              <div key={ps.projectPath}>
                <ScopeHeader
                  scope={{
                    type: "project",
                    projectName: ps.projectName,
                    projectPath: ps.projectPath,
                  }}
                  filePath={ps.projectPath}
                />
              <Card>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="text-sm font-medium">{ps.projectName}</h3>
                  <span className="text-xs text-text-dim">
                    {ps.permissions.allow.length} allow
                    {ps.permissions.deny
                      ? `, ${ps.permissions.deny.length} deny`
                      : ""}
                    {ps.permissions.ask
                      ? `, ${ps.permissions.ask.length} ask`
                      : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <PermissionList permissions={ps.permissions} />
                  </div>
                  <div>
                    <p className="text-xs text-text-dim mb-2">
                      Settings Priority
                    </p>
                    <SettingsPriorityChain project={ps} />
                  </div>
                </div>
              </Card>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            No project-level permissions configured.
          </p>
        )}
      </div>
    </PageWrapper>
  );
}
