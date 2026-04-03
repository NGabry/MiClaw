import type { OutputStyle } from "@/lib/types";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";

export function OutputStyleCard({ style }: { style: OutputStyle }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-mono font-medium">{style.name}</h3>
      </div>
      <ExpandableBody content={style.body} previewLines={4} />
    </Card>
  );
}
