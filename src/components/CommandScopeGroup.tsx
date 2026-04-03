"use client";

import type { Command } from "@/lib/types";
import { CommandCard } from "./CommandCard";

export function CommandScopeGroup({
  commands,
  scopePath,
}: {
  commands: Command[];
  scopePath: string;
}) {
  return (
    <div className="space-y-3">
      {commands.map((command) => (
        <CommandCard key={command.filePath} command={command} scopePath={scopePath} />
      ))}
    </div>
  );
}
