"use client";

import { Pencil } from "lucide-react";

export function EditPencil({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`p-1.5 rounded-sm transition-all duration-200
        ${visible
          ? "text-accent/60 hover:text-accent hover:bg-surface-hover animate-[pencilPulse_2s_ease-in-out_infinite]"
          : "text-transparent pointer-events-none"}`}
    >
      <Pencil size={22} />
    </button>
  );
}
