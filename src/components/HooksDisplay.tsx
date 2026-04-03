import type { HooksConfig } from "@/lib/types";
import { Card } from "./Card";


interface HooksDisplayProps {
  hooks: HooksConfig;
  label?: string;
}

export function HooksDisplay({ hooks, label }: HooksDisplayProps) {
  const events = Object.entries(hooks).filter(
    ([, matchers]) => matchers && matchers.length > 0
  );

  if (events.length === 0) return null;

  return (
    <div>
      {label && (
        <p className="text-xs text-text-dim mb-2">{label}</p>
      )}
      <div className="space-y-3">
        {events.map(([event, matchers]) => {
          const entries = matchers ?? [];
          return (
          <Card key={event}>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm font-medium text-accent">{event}</span>
              <span className="text-xs text-text-dim">
                {entries.length} matcher{entries.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {entries.map((m, i) => (
                <div key={i} className="pl-3 border-l border-border">
                  <p className="text-xs font-mono text-text-muted">
                    {m.matcher}
                  </p>
                  {m.hooks.map((hook, j) => (
                    <div key={j} className="mt-1 pl-3">
                      <span className="font-mono text-xs text-text-dim">{hook.type}</span>
                      {hook.command && (
                        <p className="text-xs font-mono text-text-dim mt-1 break-all">
                          {hook.command}
                        </p>
                      )}
                      {hook.url && (
                        <p className="text-xs font-mono text-text-dim mt-1">
                          {hook.url}
                        </p>
                      )}
                      {hook.prompt && (
                        <p className="text-xs text-text-dim mt-1 italic">
                          {hook.prompt.length > 100
                            ? hook.prompt.substring(0, 100) + "..."
                            : hook.prompt}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
