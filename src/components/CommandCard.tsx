import type { Command } from "@/lib/types";
import { Card } from "./Card";
import { ScopeBadge } from "./Badge";
import { ExpandableBody } from "./ExpandableBody";

export function CommandCard({ command }: { command: Command }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{command.name}</h3>
        <ScopeBadge scope={command.scope} />
      </div>

      <ExpandableBody content={command.body} previewLines={3} />
    </Card>
  );
}
