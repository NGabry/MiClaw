import type { ProjectSettings } from "@/lib/types";


interface SettingsPriorityChainProps {
  project: ProjectSettings;
}

const PRIORITY_LEVELS = [
  { label: "Enterprise", desc: "managed-settings.json", level: "highest" },
  { label: "CLI Flag", desc: "--settings", level: "high" },
  { label: "Project Local", desc: ".claude/settings.local.json", level: "medium" },
  { label: "Project Shared", desc: ".claude/settings.json", level: "low" },
  { label: "User Global", desc: "~/.claude/settings.json", level: "lowest" },
] as const;

export function SettingsPriorityChain({
  project,
}: SettingsPriorityChainProps) {
  const hasShared = project.shared !== null;
  const hasLocal = project.local !== null;

  return (
    <div className="flex flex-col gap-0">
      {PRIORITY_LEVELS.map((level, i) => {
        const isActive =
          (level.label === "Project Local" && hasLocal) ||
          (level.label === "Project Shared" && hasShared) ||
          level.label === "User Global";

        return (
          <div key={level.label} className="flex items-stretch">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div
                className={`w-2 h-2 rounded-full shrink-0 mt-2.5 ${
                  isActive ? "bg-accent" : "bg-surface-raised"
                }`}
              />
              {i < PRIORITY_LEVELS.length - 1 && (
                <div className="w-px flex-1 bg-border-strong" />
              )}
            </div>
            <div className="pb-3 pl-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    isActive ? "text-text" : "text-text-dim"
                  }`}
                >
                  {level.label}
                </span>
                {isActive && <span className="font-mono text-[10px] text-accent">*</span>}
              </div>
              <p className="text-xs font-mono text-text-dim">{level.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
