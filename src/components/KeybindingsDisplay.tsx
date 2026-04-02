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
                <kbd className="px-1.5 py-0.5 bg-surface-raised rounded-sm text-xs text-accent">
                  {kb.key}
                </kbd>
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
