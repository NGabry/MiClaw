"use client";

import { useState } from "react";
import type { Skill } from "@/lib/types";
import { SkillCard } from "./SkillCard";
import { AddNewButton } from "./AddNewButton";

export function SkillScopeGroup({
  skills,
  scopePath,
  scopeType,
}: {
  skills: Skill[];
  scopePath: string;
  scopeType: "global" | "project";
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <SkillCard key={skill.filePath} skill={skill} scopePath={scopePath} scopeType={scopeType} />
      ))}
      {creating ? (
        <SkillCard isNew scopePath={scopePath} scopeType={scopeType} onCancel={() => setCreating(false)} />
      ) : (
        <AddNewButton label="Add skill" onClick={() => setCreating(true)} />
      )}
    </div>
  );
}
