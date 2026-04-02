import { scanClaudeConfig } from "@/lib/scanner";
import { HooksDisplay } from "@/components/HooksDisplay";
import { PageHeader } from "@/components/PageHeader";
import { PageWrapper } from "@/components/PageWrapper";

export default async function HooksPage() {
  const config = await scanClaudeConfig();

  const hasGlobalHooks =
    config.globalSettings.hooks &&
    Object.keys(config.globalSettings.hooks).length > 0;

  const projectsWithHooks = config.projectSettings.filter(
    (ps) =>
      (ps.shared?.hooks && Object.keys(ps.shared.hooks).length > 0) ||
      (ps.local?.hooks && Object.keys(ps.local.hooks).length > 0)
  );

  const totalHookEvents =
    (hasGlobalHooks
      ? Object.values(config.globalSettings.hooks!).filter(
          (v) => v && v.length > 0
        ).length
      : 0) +
    projectsWithHooks.reduce((sum, ps) => {
      const sharedCount = ps.shared?.hooks
        ? Object.values(ps.shared.hooks).filter((v) => v && v.length > 0).length
        : 0;
      const localCount = ps.local?.hooks
        ? Object.values(ps.local.hooks).filter((v) => v && v.length > 0).length
        : 0;
      return sum + sharedCount + localCount;
    }, 0);

  return (
    <PageWrapper>
      <PageHeader
        title="Hooks"
        description="Event-driven commands triggered during Claude Code lifecycle"
        count={totalHookEvents}
      />

      {hasGlobalHooks && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
            Global
          </h2>
          <HooksDisplay hooks={config.globalSettings.hooks!} />
        </div>
      )}

      {projectsWithHooks.length > 0 && (
        <div className="space-y-8">
          {projectsWithHooks.map((ps) => (
            <div key={ps.projectPath}>
              <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
                {ps.projectName}
              </h2>
              {ps.shared?.hooks && (
                <HooksDisplay hooks={ps.shared.hooks} label="Shared settings" />
              )}
              {ps.local?.hooks && (
                <div className="mt-3">
                  <HooksDisplay hooks={ps.local.hooks} label="Local settings" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!hasGlobalHooks && projectsWithHooks.length === 0 && (
        <p className="text-sm text-text-muted">No hooks configured.</p>
      )}
    </PageWrapper>
  );
}
