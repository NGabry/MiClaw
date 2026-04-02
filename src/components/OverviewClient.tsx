"use client";

import { useState } from "react";
import type { SphereData } from "@/lib/sphereData";
import { SphereView } from "./SphereView";
import { TreeView } from "./TreeView";
import { ViewToggle } from "./ViewToggle";
import { DetailDrawer } from "./DetailDrawer";

export function OverviewClient({ data }: { data: SphereData }) {
  const [view, setView] = useState<"spheres" | "tree">("spheres");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const drawerOpen = selectedId !== null;

  return (
    <div className="h-full relative overflow-hidden" onClick={() => setSelectedId(null)}>
      {/* Toggle -- highest z-index, always clickable */}
      <div
        className="absolute top-3 right-3 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Sphere view */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${view === "spheres" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
        <SphereView data={data} selectedId={selectedId} onSelectedIdChange={setSelectedId} />
      </div>

      {/* Tree view */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${view === "tree" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
        <TreeView data={data} selectedId={selectedId} onSelectedIdChange={setSelectedId} />
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="absolute inset-y-0 right-0 w-[420px] z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <DetailDrawer
            nodeId={selectedId}
            data={data}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
