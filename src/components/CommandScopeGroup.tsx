"use client";

import { useState } from "react";
import type { Command } from "@/lib/types";
import { CommandCard } from "./CommandCard";
import { AddNewButton } from "./AddNewButton";

export function CommandScopeGroup({
  commands,
  scopePath,
}: {
  commands: Command[];
  scopePath: string;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      {commands.map((command) => (
        <CommandCard key={command.filePath} command={command} scopePath={scopePath} />
      ))}
      {creating ? (
        <CommandCard isNew scopePath={scopePath} onCancel={() => setCreating(false)} />
      ) : (
        <AddNewButton label="Add command" onClick={() => setCreating(true)} />
      )}
    </div>
  );
}
