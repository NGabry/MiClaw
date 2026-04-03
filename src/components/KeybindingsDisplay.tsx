import type { Keybinding } from "@/lib/types";
import { Card } from "./Card";

export function KeybindingsDisplay({
  keybindings,
}: {
  keybindings: Keybinding[];
}) {
  if (keybindings.length === 0) return null;

  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-text-dim">
            <th className="pb-2 font-medium">Key</th>
            <th className="pb-2 font-medium">Command</th>
            <th className="pb-2 font-medium">When</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {keybindings.map((kb, i) => (
            <tr key={i} className="border-t border-border">
              <td className="py-2 pr-4">
                <span className="font-mono text-sm text-accent">{kb.key}</span>
              </td>
              <td className="py-2 pr-4 text-xs text-text-muted">
                {kb.command}
              </td>
              <td className="py-2 text-xs text-text-dim">{kb.when ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
