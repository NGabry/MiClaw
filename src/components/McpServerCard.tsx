import type { McpServer } from "@/lib/types";
import { Card } from "./Card";

export function McpServerCard({ server }: { server: McpServer }) {
  return (
    <Card id={server.name}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-mono font-medium">{server.name}</h3>
        <span className="font-mono text-xs text-text-dim">{server.type}</span>
      </div>

      <div className="mt-2 space-y-1">
        {server.command && (
          <p className="text-xs font-mono text-text-muted">
            {server.command}
            {server.args && server.args.length > 0 && (
              <span className="text-text-dim">
                {" "}
                {server.args.join(" ")}
              </span>
            )}
          </p>
        )}
        {server.url && (
          <p className="text-xs font-mono text-text-muted">{server.url}</p>
        )}
      </div>

      {server.env && Object.keys(server.env).length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-text-dim mb-1">Environment</p>
          {Object.entries(server.env).map(([key, value]) => (
            <p key={key} className="text-xs font-mono text-text-muted pl-3">
              <span className="text-text-dim">{key}</span>={" "}
              {value.startsWith("$") || value.length > 40
                ? value.substring(0, 40) + "..."
                : value}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
