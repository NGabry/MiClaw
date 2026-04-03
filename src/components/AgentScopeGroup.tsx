"use client";

import { useState } from "react";
import type { Agent } from "@/lib/types";
import { AgentCard } from "./AgentCard";
import { AddNewButton } from "./AddNewButton";

export function AgentScopeGroup({
  agents,
  scopePath,
  scopeType,
}: {
  agents: Agent[];
  scopePath: string;
  scopeType: "global" | "project";
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <AgentCard key={agent.filePath} agent={agent} scopePath={scopePath} scopeType={scopeType} />
      ))}
      {creating ? (
        <AgentCard isNew scopePath={scopePath} scopeType={scopeType} onCancel={() => setCreating(false)} />
      ) : (
        <AddNewButton label="Add agent" onClick={() => setCreating(true)} />
      )}
    </div>
  );
}
