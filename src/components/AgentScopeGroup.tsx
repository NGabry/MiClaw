"use client";

import type { Agent } from "@/lib/types";
import { AgentCard } from "./AgentCard";

export function AgentScopeGroup({
  agents,
  scopePath,
  scopeType,
}: {
  agents: Agent[];
  scopePath: string;
  scopeType: "global" | "project";
}) {
  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <AgentCard key={agent.filePath} agent={agent} scopePath={scopePath} scopeType={scopeType} />
      ))}
    </div>
  );
}
