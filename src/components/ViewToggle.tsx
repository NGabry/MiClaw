"use client";

import { Circle, GitFork } from "lucide-react";

export function ViewToggle({
  view,
  onChange,
}: {
  view: "spheres" | "tree";
  onChange: (view: "spheres" | "tree") => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-surface-raised rounded-md p-0.5">
      <button
        onClick={() => onChange("spheres")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
          ${view === "spheres" ? "bg-surface-hover text-accent" : "text-text-dim hover:text-text"}`}
      >
        <Circle size={12} />
        Spheres
      </button>
      <button
        onClick={() => onChange("tree")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
          ${view === "tree" ? "bg-surface-hover text-accent" : "text-text-dim hover:text-text"}`}
      >
        <GitFork size={12} />
        Tree
      </button>
    </div>
  );
}
