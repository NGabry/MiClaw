"use client";

import { Plus } from "lucide-react";

export function AddNewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 flex items-center gap-2 py-2.5 px-4 text-xs font-mono text-text-dim
        border border-dashed border-border rounded-sm
        hover:border-accent/30 hover:text-accent transition-colors w-full justify-center"
    >
      <Plus size={14} />
      {label}
    </button>
  );
}
