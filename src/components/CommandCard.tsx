import type { Command } from "@/lib/types";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";

export function CommandCard({ command }: { command: Command }) {
  return (
    <Card id={command.name}>
      <h3 className="text-sm font-medium">{command.name}</h3>

      <ExpandableBody content={command.body} previewLines={3} />
    </Card>
  );
}
