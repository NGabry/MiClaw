"use client";

import type { Skill } from "@/lib/types";
import { SkillCard } from "./SkillCard";

export function SkillScopeGroup({
  skills,
  scopePath,
  scopeType,
}: {
  skills: Skill[];
  scopePath: string;
  scopeType: "global" | "project";
}) {
  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <SkillCard key={skill.filePath} skill={skill} scopePath={scopePath} scopeType={scopeType} />
      ))}
    </div>
  );
}
